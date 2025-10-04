"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildExtraOptions = exports.buildNodeProperties = void 0;
const _ = __importStar(require("lodash"));
let pino;
try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    pino = require('pino');
}
catch (e) {
    pino = function fallbackPino() {
        const log = (...args) => console.log(...args);
        return {
            trace: log,
            debug: log,
            info: log,
            warn: console.warn.bind(console),
            error: console.error.bind(console),
            fatal: console.error.bind(console),
        };
    };
}
const N8nOperationsCollector_1 = __importDefault(require("./N8nOperationsCollector"));
const N8NResourceParser_1 = __importDefault(require("./N8NResourceParser"));
const N8nOperationParser_1 = __importDefault(require("./N8nOperationParser"));
const N8nResourceCollector_1 = __importDefault(require("./N8nResourceCollector"));
const N8NPropertiesBuilder_1 = __importDefault(require("./N8NPropertiesBuilder"));
function overWriteProperties(properties, config) {
    const overWrittenProperties = [];
    for (const property of properties) {
        const overWrites = findOverWritesOfProperties(config, property);
        if (!overWrites || overWrites.length === 0) {
            overWrittenProperties.push(property);
            continue;
        }
        let newProperty = _.cloneDeep(property);
        let unset = false;
        for (const overWrite of overWrites) {
            const { set, replace, add } = overWrite;
            if (set === false) {
                unset = true;
            }
            else if (typeof set === 'object') {
                newProperty = _.merge(newProperty, set);
            }
            else if (typeof set === 'function') {
                newProperty = set(newProperty);
            }
            if (replace) {
                newProperty = replace;
            }
            if (add) {
                const { field } = add;
                if (field) {
                    const newField = _.merge({}, field, { displayOptions: newProperty.displayOptions });
                    overWrittenProperties.push(newField);
                    _.set(newProperty, `displayOptions.show.${newField.name}`, [true]);
                }
            }
        }
        if (!unset) {
            overWrittenProperties.push(newProperty);
        }
    }
    return overWrittenProperties;
}
function hideUnusedProperties(properties) {
    const resource = properties.find((property) => property.name === 'resource');
    if (resource.options.length === 1) {
        resource.type = 'hidden';
    }
    return properties;
}
function addingAdditionalProperties() {
    const additionalProperties = [
        {
            displayName: 'Use Custom Body',
            name: 'useCustomBody',
            type: 'boolean',
            description: 'Whether to use a custom body',
            required: false,
            default: false,
        },
    ];
    return additionalProperties;
}
function cleanDoc(doc) {
    const newDOc = _.cloneDeep(doc);
    const paths = newDOc.paths;
    for (const path in paths) {
        const newPath = path.trim().split(' ')[0];
        if (newPath !== path) {
            newDOc.paths[newPath] = paths[path];
            delete newDOc.paths[path];
        }
    }
    return newDOc;
}
function buildNodeProperties(config) {
    const doc = cleanDoc(config.openapi);
    const builderConfig = {
        logger: pino({ enabled: true, level: 40 }),
        OperationsCollector: N8nOperationsCollector_1.default,
        ResourcePropertiesCollector: N8nResourceCollector_1.default,
        operation: new N8nOperationParser_1.default(config),
        resource: new N8NResourceParser_1.default(config),
    };
    const parser = new N8NPropertiesBuilder_1.default(doc, builderConfig);
    const properties = parser.build();
    const filteredProperties = filterResourcesWithoutOperations(properties);
    const overWrittenProperties = overWriteProperties(filteredProperties, config);
    const hiddenUnusedProperties = hideUnusedProperties(overWrittenProperties);
    return hiddenUnusedProperties;
}
exports.buildNodeProperties = buildNodeProperties;
function buildExtraOptions(config) {
    const extraOptions = addingAdditionalProperties();
    return extraOptions;
}
exports.buildExtraOptions = buildExtraOptions;
function findPropertiesByDisplayOptions(properties, value) {
    return properties.filter((property) => {
        const { displayOptions } = property;
        return (displayOptions &&
            displayOptions.show &&
            displayOptions.show.resource &&
            displayOptions.show.resource.includes(value));
    });
}
function filterResourcesWithoutOperations(properties) {
    const resources = properties[0];
    resources.options = resources.options.filter((option) => {
        const { value } = option;
        const props = findPropertiesByDisplayOptions(properties, value);
        return props.length > 0;
    });
    return properties;
}
function findOverWritesOfProperties(config, property) {
    const overWrites = _.get(config, 'overwrites.operations');
    if (!overWrites) {
        return [];
    }
    return overWrites.filter((overWrite) => {
        const { match, has } = overWrite;
        if (match)
            return _.isMatch(property, match);
        if (has)
            return _.has(property, has);
        return false;
    });
}
