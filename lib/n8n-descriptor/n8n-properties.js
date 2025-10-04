"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.modifyNodeProperties = void 0;
const mock_json_schema_1 = require("mock-json-schema");
const to_json_schema_1 = __importDefault(require("to-json-schema"));
const lodash_1 = __importDefault(require("lodash"));
const utils_1 = require("./utils");
function findKey(obj, regexp) {
    const key = Object.keys(obj).find((key) => regexp.test(key));
    return key;
}
function flattenObj(obj, parent, res = {}) {
    for (const key in obj) {
        const propName = parent ? `${parent}_${key}` : key;
        if (typeof obj[key] == 'object') {
            flattenObj(obj[key], propName, res);
        }
        else {
            res[propName] = obj[key];
        }
    }
    return res;
}
function modifyNodeProperties(n8nNodeProperties) {
    const originalFromSchema = n8nNodeProperties.fromSchema;
    const originalFromRequestBody = n8nNodeProperties.fromRequestBody;
    const originalFromRefResolver = n8nNodeProperties.refResolver;
    const originalFromRefResolverresolveRef = originalFromRefResolver.resolveRef;
    n8nNodeProperties.refResolver.resolveRef = function (ref) {
        const resolved = originalFromRefResolverresolveRef.call(this, ref);
        return resolved;
    };
    n8nNodeProperties.fromArraySchema = function (schema, property) {
        const { items } = schema;
        const { type, enum: values } = items || {};
        if (type === 'string' && values) {
            property.type = 'multiOptions';
            property.options = values.map((value) => ({ name: value, value }));
            property.default = [];
            return property;
        }
        if (type === 'string' && (!values || values.length === 0)) {
            const newProperty = {
                type: 'fixedCollection',
                default: [],
                typeOptions: { multipleValues: true },
                displayName: (0, utils_1.normalizeDisplayName)(property.displayName),
                name: property.name,
                description: (0, utils_1.normalizeDesc)(property.description),
                placeholder: property.placeholder || 'Add item',
                options: [
                    { name: 'items', displayName: 'Items', values: [{ name: 'Item', displayName: 'Item', type: 'string', default: '' }] },
                ],
            };
            return newProperty;
        }
        if (type === 'object') {
            const itemProperty = this.fromSchema(items, property);
            itemProperty.displayName = itemProperty.displayName || 'Item';
            itemProperty.name = itemProperty.name || 'item';
            let optionValues = [];
            if (itemProperty.type === 'fixedCollection') {
                optionValues = itemProperty.options[0].values;
            }
            else {
                optionValues = [itemProperty];
            }
            const newProperty = {
                type: 'fixedCollection',
                default: [],
                typeOptions: { multipleValues: true },
                displayName: (0, utils_1.normalizeDisplayName)(property.displayName),
                name: property.name,
                description: (0, utils_1.normalizeDesc)(property.description),
                placeholder: property.placeholder || 'Add item',
                options: [{ name: 'items', displayName: 'Items', values: lodash_1.default.compact(optionValues) }],
            };
            return newProperty;
        }
        return property;
    };
    n8nNodeProperties.fromStringEnumSchema = function (schema, property) {
        const { enum: values } = schema;
        if (values && values.length > 0) {
            property.type = 'options';
            property.options = values.map((value) => ({ name: value, value }));
        }
        return property;
    };
    n8nNodeProperties.getObjectDepth = function (obj) {
        if (typeof obj !== 'object')
            return 0;
        let level = 1;
        for (const key in obj) {
            if (!Object.prototype.hasOwnProperty.call(obj, key))
                continue;
            if (typeof obj[key] == 'object') {
                const depth = this.getObjectDepth(obj[key]) + 1;
                level = Math.max(depth, level);
            }
        }
        return level;
    };
    n8nNodeProperties.isValidJsonObject = function (str) {
        try {
            const json = JSON.parse(str);
            if (typeof json !== 'object')
                return false;
        }
        catch (e) {
            return false;
        }
        return true;
    };
    n8nNodeProperties.isDoubleStringifiedJson = function (str) {
        try {
            const json = JSON.parse(str);
            if (typeof json === 'string') {
                return this.isValidJsonObject(json);
            }
        }
        catch (e) {
            return false;
        }
        return false;
    };
    n8nNodeProperties.extractBodyExample = function (body) {
        if (!body)
            return null;
        const { schema } = this.resolveBodySchema(body);
        const { example } = schema;
        if (example)
            return example;
        const schemaMocked = (0, mock_json_schema_1.mock)(schema);
        return schemaMocked;
    };
    n8nNodeProperties.fromObjectSchema = function (schema, property) {
        const { properties, example } = schema;
        if (!properties && !example)
            return property;
        const examole = example || (0, mock_json_schema_1.mock)(schema);
        const examoleFlat = flattenObj(examole);
        if (Object.keys(examoleFlat).length > 10) {
            const options = Object.entries(properties).map(([key, prop]) => {
                const subProperty = this.fromSchema(prop);
                return lodash_1.default.merge(subProperty, {
                    name: key,
                    description: (0, utils_1.normalizeDesc)(prop.description || subProperty.description),
                    displayName: (0, utils_1.normalizeDisplayName)(prop.displayName || key),
                });
            });
            const newProperty = {
                type: 'collection',
                default: {},
                typeOptions: {},
                displayName: (0, utils_1.normalizeDisplayName)(property.displayName),
                name: property.name,
                description: (0, utils_1.normalizeDesc)(property.description),
                placeholder: property.placeholder || 'Add item',
                options,
            };
            return newProperty;
        }
        if (!properties && example) {
            const schemaMocked = (0, to_json_schema_1.default)(example);
            return this.fromSchema(schemaMocked);
        }
        property.type = 'fixedCollection';
        property.default = {};
        const values = Object.entries(properties).map(([key, prop]) => {
            const subProperty = this.fromSchema(prop);
            return lodash_1.default.merge(subProperty, {
                name: key,
                description: (0, utils_1.normalizeDesc)(prop.description || subProperty.description),
                displayName: (0, utils_1.normalizeDisplayName)(prop.displayName || key),
            });
        });
        property.options = [{ name: 'items', displayName: 'Items', values: lodash_1.default.compact(values) }];
        return property;
    };
    n8nNodeProperties.fromSchema = function (schema) {
        const property = originalFromSchema.call(this, schema);
        schema = this.refResolver.resolve(schema);
        if (schema.type === 'array') {
            return this.fromArraySchema(schema, property);
        }
        if (schema.type === 'string' && schema.enum) {
            return this.fromStringEnumSchema(schema, property);
        }
        if (schema.type == 'object') {
            return this.fromObjectSchema(schema, property);
        }
        if (schema.type === 'string' && this.isValidJsonObject(schema.example)) {
            property.type = 'json';
            property.default = JSON.stringify(JSON.parse(schema.example), null, 2);
            return property;
        }
        if (schema.description) {
            property.description = (0, utils_1.normalizeDesc)(schema.description);
        }
        if (Array.isArray(schema.type)) {
            if (schema.type.includes('string')) {
                property.type = 'string';
            }
        }
        if (schema.type === 'null' || schema.type === 'undefined' || schema.type === '') {
            property.type = 'string';
        }
        return property;
    };
    n8nNodeProperties.fixBadSchema = function (schema) {
        if (!schema)
            return schema;
        if (typeof schema === 'object') {
            for (const key in schema) {
                schema[key] = this.fixBadSchema(schema[key]);
            }
        }
        if (schema.$ref) {
            schema.$ref = schema.$ref.replace(/%3C/g, '<').replace(/%3E/g, '>');
            return schema;
        }
        return schema;
    };
    n8nNodeProperties.resolveBodySchema = function (body) {
        body = this.fixBadSchema(body);
        body = this.refResolver.resolve(body);
        const regexp = /application\/json.*/;
        let contentKey = findKey(body.content, regexp);
        if (!contentKey) {
            const contentKeys = Object.keys(body.content);
            for (const key of contentKeys) {
                const schema = body.content[key].schema;
                if (schema) {
                    contentKey = key;
                    break;
                }
            }
            if (!contentKey) {
                throw new Error(`No '${regexp}' content found`);
            }
        }
        const content = body.content[contentKey];
        if (!content)
            throw new Error(`No '${regexp}' content found`);
        const requestBodySchema = content.schema;
        const schema = this.refResolver.resolve(requestBodySchema);
        return { schema, contentKey };
    };
    n8nNodeProperties.fromRequestBody = function (body) {
        if (!body)
            return [];
        if (body && body.content && Object.keys(body.content).length === 0) {
            return [];
        }
        const { schema, contentKey } = this.resolveBodySchema(body);
        if (schema.type === 'object' && !schema.properties && schema.example) {
            const schemaMocked = (0, to_json_schema_1.default)(schema.example);
            body.content[contentKey].schema = schemaMocked;
        }
        if (schema.type === 'string' && this.isValidJsonObject(schema.example)) {
            const example = JSON.parse(schema.example);
            const schemaMocked = (0, to_json_schema_1.default)(example);
            body.content[contentKey].schema = schemaMocked;
            body.content[contentKey].schema.type = 'object';
            body.content['application/json'] = body.content[contentKey];
        }
        if (schema.type === 'string' && this.isDoubleStringifiedJson(schema.example)) {
            const example = JSON.parse(JSON.parse(schema.example));
            const schemaMocked = (0, to_json_schema_1.default)(example);
            body.content[contentKey].schema = schemaMocked;
            body.content[contentKey].schema.type = 'object';
            body.content['application/json'] = body.content[contentKey];
        }
        const fields = originalFromRequestBody.call(this, body);
        const modifiedFields = fields.map((field) => {
            if (field.type === 'fixedCollection') {
                const routingBody = lodash_1.default.get(field, 'routing.request.body');
                for (const routingFieldName in routingBody) {
                    field.routing.request.body[routingFieldName] = '={{$value.items}}';
                }
            }
            field.displayOptions = { hide: { useCustomBody: [true] } };
            field.description = (0, utils_1.normalizeDesc)(field.description);
            return field;
        });
        return modifiedFields;
    };
    return n8nNodeProperties;
}
exports.modifyNodeProperties = modifyNodeProperties;
