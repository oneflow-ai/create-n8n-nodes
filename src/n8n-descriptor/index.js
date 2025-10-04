const _ = require('lodash');
let pino;
try {
  pino = require('pino');
} catch (e) {
  // Fallback lightweight logger if pino is not installed
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
const N8nOperationsCollector = require('./N8nOperationsCollector');
const N8NResourceParser = require('./N8NResourceParser');
const N8nOperationParser = require('./N8nOperationParser');
const N8nResourceCollector = require('./N8nResourceCollector');
const N8NPropertiesBuilder = require('./N8NPropertiesBuilder');

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

      // merge properties
      if (set === false) {
        unset = true;
      } else if (typeof set === 'object') {
        newProperty = _.merge(newProperty, set);
      } else if (typeof set === 'function') {
        newProperty = set(newProperty);
      }

      // replace properties
      if (replace) {
        newProperty = replace;
      }

      // add new properties
      if (add) {
        const { field } = add;

        if (field) {
          const newField = _.merge({}, field, {
            displayOptions: newProperty.displayOptions,
          });
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

// hide the resource properties when having only one resource
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
  // wark through all path, clean up the doc
  const newDOc = _.cloneDeep(doc);

  const paths = newDOc.paths;

  // convert path keys /a /b to -> /a
  // keep the first part of the path
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
    logger: pino({
      enabled: true,
      level: 40,
    }),
    OperationsCollector: N8nOperationsCollector,
    ResourcePropertiesCollector: N8nResourceCollector,
    operation: new N8nOperationParser(config),
    resource: new N8NResourceParser(config),
  };

  const parser = new N8NPropertiesBuilder(doc, builderConfig);
  const properties = parser.build();

  const filteredProperties = filterResourcesWithoutOperations(properties);

  const overWrittenProperties = overWriteProperties(filteredProperties, config);

  const hiddenUnusedProperties = hideUnusedProperties(overWrittenProperties);

  return hiddenUnusedProperties;
}

function buildExtraOptions(config) {
  const extraOptions = addingAdditionalProperties(config);

  return extraOptions;
}

function findPropertiesByDisplayOptions(properties, value) {
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

    if (match) {
      return _.isMatch(property, match);
    }

    if (has) {
      return _.has(property, has);
    }

    return false;
  });
}

module.exports = {
  buildNodeProperties,
  buildExtraOptions,
};
