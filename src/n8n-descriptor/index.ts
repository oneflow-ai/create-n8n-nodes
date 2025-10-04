import * as _ from 'lodash';
let pino: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  pino = require('pino');
} catch (e) {
  pino = function fallbackPino() {
    const log = (...args: any[]) => console.log(...args);
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
import N8nOperationsCollector from './N8nOperationsCollector';
import N8NResourceParser from './N8NResourceParser';
import N8nOperationParser from './N8nOperationParser';
import N8nResourceCollector from './N8nResourceCollector';
import N8NPropertiesBuilder from './N8NPropertiesBuilder';

function overWriteProperties(properties: any[], config: any) {
  const overWrittenProperties: any[] = [];
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
      } else if (typeof set === 'object') {
        newProperty = _.merge(newProperty, set);
      } else if (typeof set === 'function') {
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

function hideUnusedProperties(properties: any[]) {
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

function cleanDoc(doc: any) {
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

export function buildNodeProperties(config: any) {
  const doc = cleanDoc(config.openapi);
  const builderConfig = {
    logger: pino({ enabled: true, level: 40 }),
    OperationsCollector: N8nOperationsCollector as any,
    ResourcePropertiesCollector: N8nResourceCollector as any,
    operation: new N8nOperationParser(config),
    resource: new N8NResourceParser(config),
  } as any;
  const parser = new N8NPropertiesBuilder(doc, builderConfig);
  const properties = parser.build();
  const filteredProperties = filterResourcesWithoutOperations(properties);
  const overWrittenProperties = overWriteProperties(filteredProperties, config);
  const hiddenUnusedProperties = hideUnusedProperties(overWrittenProperties);
  return hiddenUnusedProperties;
}

export function buildExtraOptions(config: any) {
  const extraOptions = addingAdditionalProperties();
  return extraOptions;
}

function findPropertiesByDisplayOptions(properties: any[], value: string) {
  return properties.filter((property) => {
    const { displayOptions } = property;
    return (
      displayOptions &&
      displayOptions.show &&
      displayOptions.show.resource &&
      displayOptions.show.resource.includes(value)
    );
  });
}

function filterResourcesWithoutOperations(properties: any[]) {
  const resources = properties[0];
  resources.options = resources.options.filter((option: any) => {
    const { value } = option;
    const props = findPropertiesByDisplayOptions(properties, value);
    return props.length > 0;
  });
  return properties;
}

function findOverWritesOfProperties(config: any, property: any) {
  const overWrites = _.get(config, 'overwrites.operations');
  if (!overWrites) {
    return [];
  }
  return overWrites.filter((overWrite: any) => {
    const { match, has } = overWrite;
    if (match) return _.isMatch(property, match);
    if (has) return _.has(property, has);
    return false;
  });
}
