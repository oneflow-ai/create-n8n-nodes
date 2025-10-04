/**
 * This module generates a code skeleton for an API using OpenAPI.
 * @module codegen
 */

const os = require('os');
const path = require('path');
const fs = require('fs');
const Handlebars = require('handlebars');
const _ = require('lodash');
const xfs = require('fs.extra');
const randomName = require('project-name-generator');
const registerPartial = require('./register-partial');
const bundler = require('./bundler');
const yellow = (text) => `\x1b[33m${text}\x1b[0m`;
const prettifier = require('prettier-standard');
const { buildNodeProperties, buildExtraOptions } = require('./n8n-descriptor');
const codegen = module.exports;

const HELPERS_DIRNAME = '.helpers';
const PARTIALS_DIRNAME = '.partials';
const EXTENSIONS_DIRNAME = 'extensions';

/**
 * Deletes all matching subfolders in target directory
 *
 * @param   {Object}  config Configuration options
 * @returns {Promise}
 */
const deleteFolders = (config) =>
  new Promise((resolve, reject) => {
    try {
      // delete target folders
      const folder = config.targetDir;

      console.log('Deleting target folder:', folder);
      xfs.rmrfSync(folder);

      resolve();
    } catch (e) {
      reject(e);
    }
  });

function isSkipedFile(final_path, config) {
  const isFileExist = fs.existsSync(final_path);
  const relativePath = path.relative(config.targetDir, final_path);

  // if file already exists, skip it unless it's a continuous generation file
  const isContinuousGenerationFile = config.continuosGenerationFiles.some((file) =>
    relativePath.startsWith(file)
  );

  return isFileExist && !isContinuousGenerationFile;
}
/**
 * Handle generate file
 */
const handleGenerateFile = async ({
  content,
  data,
  file_name,
  targetDir,
  rendered_path,
}) =>
  new Promise((resolve, reject) => {
    try {
      const template = Handlebars.compile(content, {
        noEscape: true,
      });

      let parsed_content = file_name.endsWith('.hbs')
        ? template(data)
        : content;

      const generated_path = path
        .resolve(targetDir, rendered_path)
        .replace(/.hbs$/, '');

      const final_path = generated_path.replace('[$nodeName]', data.nodeName);

      const skipFile = isSkipedFile(final_path, data);

      if (skipFile) {
        return resolve();
      }

      if (generated_path.endsWith('.ts')) {
        try {
          parsed_content = prettifier.format(parsed_content, {
            filepath: generated_path,
            parser: 'typescript',
          });
        } catch (e) {
          console.log(e);
          console.log('Prettify error:', generated_path);
        }
      }

      fs.writeFile(final_path, parsed_content, 'utf8', (err) => {
        if (err) return reject(err);
        resolve();
      });

      // unlink the original file
      if (file_name.endsWith('.hbs')) {
        try {
          fs.unlinkSync(path.resolve(targetDir, rendered_path));
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      reject(e);
    }
  });

/**
 * Generates a file.
 *
 * @private
 * @param  {Object} options
 * @param  {String} options.templates_dir Directory where the templates live.
 * @param  {String} options.targetDir    Directory where the file will be generated.
 * @param  {String} options.file_name     Name of the generated file.
 * @param  {String} options.root          Root directory.
 * @param  {Object} options.target_path   Path to the target file.
 * @param  {Object} options.data          Data to pass to the template.
 * @return {Promise}
 */
const generateFile = (options) =>
  new Promise((resolve, reject) => {
    const templates_dir = options.templates_dir;
    const targetDir = options.targetDir;
    const file_name = options.file_name;
    const root = options.root;
    const data = options.data;

    const template_path = path.relative(
      templates_dir,
      path.resolve(root, file_name)
    );
    const target_path =
      options.target_path || path.resolve(targetDir, template_path);
    const rendered_path = target_path.replace('[$nodeName]', data.nodeName);

    fs.readFile(path.resolve(root, file_name), 'utf8', (err, content) => {
      if (err) return reject(err);
      handleGenerateFile({
        content,
        data,
        file_name,
        targetDir,
        rendered_path,
      })
        .then(resolve)
        .catch(reject);
    });
  });

const findFieldByOperation = (properties, operation, data) => {

  const tailPropertiesKeys = _.get(data, 'tailProperties', []);

  const fields = properties.filter((property) => {
    const displayOptionsRes = _.get(
      property,
      'displayOptions.show.operation',
      []
    );
    const isDisplayOptionsRes = displayOptionsRes.includes(operation.value);
    const isTailProperty = tailPropertiesKeys.includes(property.name);
    return isDisplayOptionsRes && !isTailProperty;
  });

  // hotfix: đe-duplicate fields by name and value
  // TODO: remove this hotfix
  const deDupFields = _.uniqBy(fields, 'name');

  return deDupFields;
};

const getOperationContext = (data, operation) => {
  const parameters = findFieldByOperation(data.properties, operation, data);

  return {
    operation,
    parameters
  };
};

const getResourcesContext = (data) => {
  const resources = _.get(data.properties, '0.options', []);

  return {
    resources,
  };
};

const getExtraContext = (data) => {
  const extraPropertiesOrg = _.get(data, 'extraProperties', {});
  const tailPropertiesKeys = _.get(data, 'tailProperties', []);

  const allProperties = _.get(data, 'properties', []);

  const tailProperties = allProperties.filter((property) =>
    tailPropertiesKeys.includes(property.name)
  );

  const extraProperties = [].concat(extraPropertiesOrg, tailProperties);

  return {
    extraProperties
  };
};

const getTriggerContext = (data) => {
  const options = data.resources.map((resource) => {
    return {
      name: resource.displayName || resource.name,
      value: resource.name,
    };
  });
  const resourceSelect = {
    name: 'resource',
    displayName: 'Resource',
    type: 'options',
    options,
    default: data.resources[0].name,
  };

  const events = [];

  for (const resource of data.resources) {
    const eventOptions = resource.events.map((event) => {
      return {
        name: event.displayName || event.name,
        value: event.value,
      };
    });
    const eventSelect = {
      name: 'event',
      displayName: 'Event',
      type: 'options',
      options: eventOptions,
      default: resource.events[0].value,
      displayOptions: {
        show: {
          resource: [resource.value],
        },
      },
    };

    events.push(eventSelect);
  }

  return {
    resourceSelect,
    events,
  };
};

const createFileContext = (
  data,
  res = null,
  operationSelect = {},
  operation = null
) => {
  const operationContext = operation
    ? getOperationContext(data, operation)
    : null;
  const resourcesContext = data.mode === 'trigger' ? {} : getResourcesContext(data);
  const operations = operationSelect.options;

  const resourceSelect = data.mode === 'trigger' ? {} : data.properties[0];
  const extraContext = getExtraContext(data);

  const triggerContext = data.mode === 'trigger' ? getTriggerContext(data, operation) : null;

  const additional = _.merge(
    {},
    {
      res,
      resourceSelect,
      operationSelect,
      operations,
    },
    operationContext,
    resourcesContext,
    triggerContext,
    extraContext
  );

  return _.merge({}, data, additional);
};

const findOperationByResource = (properties, resource) => {
  const operation = properties.find((property) => {
    const displayOptionsRes = _.get(
      property,
      'displayOptions.show.resource',
      []
    );
    return (
      property.name === 'operation' &&
      displayOptionsRes.includes(resource.value)
    );
  });
  return operation;
};
const getOperationSlug = (operation) => {
  return _.kebabCase(getOperationName(operation));
};

const generateOperationFiles = ({
  root,
  templates_dir,
  targetDir,
  data,
  file_name,
  res,
}) =>
  new Promise((resolve, reject) => {
    const operationSelect = findOperationByResource(data.properties, res);
    const operations = operationSelect.options;

    const createFiles = operations.map((operation) => {
      const template_path = path.relative(
        templates_dir,
        path.resolve(root, file_name)
      );

      const target_path = path
        .resolve(targetDir, template_path)
        .replace('[$resource]', _.kebabCase(res.name))
        .replace('[$operation]', getOperationSlug(operation))
        .replace('//', '/');

      const context = createFileContext(data, res, operationSelect, operation);

      return generateFile({
        templates_dir,
        targetDir,
        file_name,
        target_path,
        root,
        data: context,
      });
    });

    Promise.all(createFiles).then(resolve).catch(reject);
  });

/**
 * Generates a file for every resource.
 */
const generateResourcesFile = ({
  root,
  templates_dir,
  targetDir,
  data,
  file_name,
}) =>
  new Promise((resolve, reject) => {
    const resources = _.get(data.properties, '0.options', []);

    const createFiles = resources.map((res) => {
      if (file_name.includes('[$operation]') || root.includes('[$operation]')) {
        return generateOperationFiles({
          root,
          templates_dir,
          targetDir,
          data,
          file_name,
          res,
        });
      }

      const template_path = path.relative(
        templates_dir,
        path.resolve(root, file_name)
      );
      const target_path = path
        .resolve(targetDir, template_path)
        .replace('[$resource]', _.kebabCase(res.name));
      const operationSelect = findOperationByResource(data.properties, res);
      const context = createFileContext(data, res, operationSelect, null);

      return generateFile({
        templates_dir,
        targetDir,
        file_name,
        target_path,
        root,
        data: context,
      });
    });

    Promise.all(createFiles).then(resolve).catch(reject);
  });

function getOperationName(operation) {
  return _.kebabCase(operation.name);
}

/**
 * Generates a resource folder.
 *
 * @param config
 * @param operation
 * @param operation_name
 * @returns {Promise}
 */
const generateResourceFolder = async (config, tag, operation) => {
  if (config.file_name.includes('[$resource]') && !tag) {
    throw new Error(`Tag is required for this template ${config.file_name}`);
  }
  const newFolderName = config.file_name.replace(
    '[$resource]',
    _.kebabCase(tag.name)
  );

  const subdir = path
    .resolve(
      config.targetDir,
      path.relative(config.templates_dir, config.root)
    )
    .replace('[$nodeName]', config.data.nodeName)
    .replace('[$resource]', _.kebabCase(tag.name));

  let targetPath = path.resolve(config.targetDir, subdir, newFolderName);

  if (targetPath.includes('[$operation]')) {
    const operationName = getOperationName(operation);
    targetPath = targetPath.replaceAll('[$operation]', operationName);
  }

  if (targetPath.includes('$')) {
    throw new Error(`Invalid target path: ${targetPath}`);
  }
  xfs.mkdirpSync(targetPath);
};

/**
 * Generates operation folders for a resource.
 */
const generateOperationFolders = async (config, res) => {
  const operation = findOperationByResource(config.data.properties, res);
  if (!operation) {
    console.log('No operations found for resource', res.name);
    return;
  }

  const operations = operation.options;
  for (const operationOpt of operations) {
    await generateResourceFolder(config, res, operationOpt);
  }
};

/**
 * Generates all the resource folders.
 *
 * @param   {Object}  config Configuration options
 * @returns {Promise}
 */
const generateResourceFolders = async (config) => {
  // const tags = _.get(config.data.openapi, 'tags', []);
  const resources = _.get(config.data.properties, '0.options', []);
  for (const res of resources) {
    if (
      config.file_name.includes('[$operation]') ||
      config.root.includes('[$operation]')
    ) {
      await generateOperationFolders(config, res);
    } else {
      await generateResourceFolder(config, res);
    }
  }
};

/**
 * Generates the directory structure.
 *
 * @private
 * @param  {Object}        config Configuration options
 * @param  {Object|String} config.openapi OpenAPI JSON or a string pointing to a OpenAPI file.
 * @param  {String}        config.targetDir Absolute path to the directory where the files will be generated.
 * @param  {String}        config.templates Absolute path to the templates that should be used.
 * @return {Promise}
 */
const generateDirectoryStructure = (config) =>
  new Promise((resolve, reject) => {
    console.log('Generating directory structure');

    const targetDir = config.targetDir;
    const templates_dir = config.templateRootDir;

    console.log('Target directory:', targetDir);

    const walker = xfs.walk(templates_dir, {
      followLinks: false,
    });

    const context = createFileContext(config);

    walker.on('file', (root, stats, next) => {
      const skipFiles = [PARTIALS_DIRNAME, HELPERS_DIRNAME, '.git'];

      if (skipFiles.some((file) => root.includes(file))) {
        return next();
      }

      try {
        if (root.includes('[$resource]')) {
          generateResourcesFile({
            root,
            templates_dir,
            targetDir,
            data: context,
            file_name: stats.name,
          })
            .then(next)
            .catch(reject);
        } else {
          // this file should only exist once.
          generateFile({
            root,
            templates_dir,
            targetDir,
            data: context,
            file_name: stats.name,
          })
            .then(next)
            .catch(reject);
        }
      } catch (e) {
        reject(e);
      }
    });

    walker.on('directory', async (root, stats, next) => {
      const skipFolders = [PARTIALS_DIRNAME, HELPERS_DIRNAME, '.git'];
      const dirPathTpl = path.resolve(
        targetDir,
        path.relative(templates_dir, path.resolve(root, stats.name))
      );
      const dirPath = dirPathTpl.replace('[$nodeName]', config.nodeName);

      // Skip all folders that dirPath contains skipFolders
      if (skipFolders.some((folder) => dirPath.includes(folder))) {
        return next();
      }

      try {
        if (
          stats.name.includes('[$resource]') ||
          root.includes('[$resource]')
        ) {
          await generateResourceFolders({
            root,
            templates_dir,
            targetDir,
            data: config,
            file_name: stats.name,
          });
        } else {
          xfs.mkdirpSync(dirPath);
        }

        next();
      } catch (e) {
        reject(e);
      }
    });

    walker.on('errors', (root, nodeStatsArray) => {
      reject(nodeStatsArray);
    });

    walker.on('end', async () => {
      console.log('Directory structure generated');
      resolve();
    });
  });

/**
 * Register the template partials
 *
 * @private
 * @param  {Object}   config Configuration options
 * @param  {String}   config.templates Absolute path to the templates that should be used.
 * @return {Promise}
 */
const registerHelpers = (config) =>
  new Promise((resolve, reject) => {
    const helpers_dir = path.resolve(config.templates, HELPERS_DIRNAME);

    if (!fs.existsSync(helpers_dir)) return resolve();

    const walker = xfs.walk(helpers_dir, {
      followLinks: false,
    });

    walker.on('file', async (root, stats, next) => {
      try {
        const file_path = path.resolve(
          config.templates,
          path.resolve(root, stats.name)
        );
        // If it's a module constructor, inject dependencies to ensure consistent usage in remote templates in other projects or plain directories.
        const mod = require(file_path);
        if (typeof mod === 'function') mod(Handlebars, _);
        next();
      } catch (e) {
        reject(e);
      }
    });

    walker.on('errors', (root, nodeStatsArray) => {
      reject(nodeStatsArray);
    });

    walker.on('end', async () => {
      resolve();
    });
  });

/**
 * Register the template helpers
 *
 * @private
 * @param  {Object}   config Configuration options
 * @param  {String}   config.templates Absolute path to the templates that should be used.
 * @return {Promise}
 */
const registerPartials = (config) =>
  new Promise((resolve, reject) => {
    const partials_dir = path.resolve(config.templates, PARTIALS_DIRNAME);

    if (!fs.existsSync(partials_dir)) return resolve();

    const walker = xfs.walk(partials_dir, {
      followLinks: false,
    });

    walker.on('file', async (root, stats, next) => {
      try {
        const file_path = path.resolve(
          config.templates,
          path.resolve(root, stats.name)
        );
        await registerPartial(file_path);
        next();
      } catch (e) {
        reject(e);
      }
    });

    walker.on('errors', (root, nodeStatsArray) => {
      reject(nodeStatsArray);
    });

    walker.on('end', () => {
      resolve();
    });
  });

/**
 * Bundles the JSON obtained from the content of the Swagger specification file
 * @param {*} openapi
 * @param {*} baseDir
 * @returns
 */
const bundle = async (openapi, baseDir) => {
  if (typeof openapi === 'string') {
    // eslint-disable-next-line no-useless-catch
    try {
      const schema = await bundler(openapi, baseDir);
      // return beautifier(schema);
      return schema;
    } catch (e) {
      throw e;
    }
  } else if (typeof openapi !== 'object') {
    throw new Error(`Could not find a valid OpenAPI definition: ${openapi}`);
  }
};

function updatePackageJson(config) {
  const packageJsonPath = path.resolve(config.baseDir, 'package.json');
  const packageJson = require(packageJsonPath);

  packageJson.name = config.package.name;

  packageJson.n8n.credentials = [];
  packageJson.n8n.nodes = packageJson.n8n.nodes || [];

  const nodeDistPath = `dist/nodes/${config.nodeName}/${config.nodeName}.node.js`;

  // add node to package.json if it doesn't exist
  if (!packageJson.n8n.nodes.includes(nodeDistPath)) {
    packageJson.n8n.nodes.push(nodeDistPath);
  }

  if (config && config.credentialDefs) {
    for (const credential of Object.values(config.credentialDefs)) {
      packageJson.n8n.credentials.push(
        `dist/credentials/${credential.className}.credentials.js`
      );
    }
  }

  fs.writeFileSync(
    packageJsonPath,
    JSON.stringify(packageJson, null, 2),
    'utf8'
  );
}
// capitalize first letter of each word
function titleCase(str) {
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => {
      return word.replace(word[0], word[0].toUpperCase());
    })
    .join(' ');
}

/**
 * parse string to extract dynamic parameters
 * {{[operation]}} => operation, iteraable
 * {{operation}} => operation, single
 * @param {*} str
 * @returns {Array<Params>} dynamicParams
 * @typedef {Object} Params
 * @property {String} name
 * @property {Boolean} iterable
 */
function extractDynamicParams(str) {
  const dynamicParams = [];
  const regex = /{{(.*?)}}/g;
  const matches = str.match(regex);

  if (matches) {
    matches.forEach((match) => {
      const name = match.replace(/{{|}}/g, '');
      const iterable = name.startsWith('[') && name.endsWith(']');
      dynamicParams.push({
        name: name.replace(/\[|\]/g, ''),
        iterable,
      });
    });
  }

  return dynamicParams;
}

// render dynamic params by handlebars
const renderDynamicParams = (str, dynamicParams, context) => {
  const strPathEscaped = str.replace(/\//g, '%2F')
    .replace(/\\/g, '%5C');

  const template = Handlebars.compile(strPathEscaped);
  const result = template(context);

  return result.replace(/%2F/g, '/')
    .replace(/%5C/g, '\\');
};

const executeDynamicGeneration = (dynamicParams, srcFilePath, targetFilePath, config) =>
  new Promise((resolve) => {
    const targetFilePathRendered = renderDynamicParams(targetFilePath, dynamicParams, config);
    // copy file from src to target
    fs.copyFileSync(srcFilePath, targetFilePathRendered);
    resolve();
  });

/**
 * Execute the extension script, replace the default files with the custom ones
 *
 * @private
 * @param  {Object}   config Configuration options
 * @return {Promise}
 */
const executeExtensionScript = (config) =>
  new Promise((resolve, reject) => {
    const extensions_dir = path.resolve(config.baseDir, EXTENSIONS_DIRNAME);

    if (!fs.existsSync(extensions_dir)) return resolve();

    console.log('Executing extension script');

    const walker = xfs.walk(extensions_dir, {
      followLinks: false,
    });

    walker.on('file', async (root, stats, next) => {
      try {
        // ignore hidden files and folders, windows and unix
        if (stats.name.startsWith('.') || root.includes('/.') || root.includes('\\.')) {
          return next();
        }

        const srcFilePath = path.resolve(
          extensions_dir,
          path.resolve(root, stats.name)
        );

        const srcFileSubPath = path.relative(extensions_dir, srcFilePath);

        const targetFilePath = path.resolve(config.baseDir, srcFileSubPath);

        const dynamicParams = extractDynamicParams(srcFilePath);
        if (dynamicParams.length > 0) {
          // handle dynamic generation
          executeDynamicGeneration(dynamicParams, srcFilePath, targetFilePath, config);
        } else {
          // replace the default file with the custom one
          if (fs.existsSync(targetFilePath)) {
            fs.unlinkSync(targetFilePath);
          }

          fs.copyFileSync(srcFilePath, targetFilePath);
        }

        next();
      } catch (e) {
        reject(e);
      }
    });

    walker.on('errors', (root, nodeStatsArray) => {
      reject(nodeStatsArray);
    });

    walker.on('end', () => {
      resolve();
    });
  });

const copyNodeIcons = (config) =>
  new Promise((resolve) => {
    console.log('Copying node icons');

    // try to resolve the icon path
    const iconPath = path.resolve(config.baseDir, config.icon);
    if (fs.existsSync(iconPath)) {
      const fileName = path.basename(iconPath);
      const nodePath = path.resolve(
        config.targetDir,
      );

      const targetPath = path.resolve(nodePath);

      xfs.mkdirpSync(targetPath);

      // copy file to target path
      fs.copyFileSync(iconPath, path.resolve(targetPath, fileName));
    }

    resolve();
  });

/**
 * Generates a code skeleton for an API given an OpenAPI file.
 *
 * @module codegen.generate
 * @param  {Object}        config Configuration options
 * @param  {Object|String} config.openapi OpenAPI JSON or a string pointing to an OpenAPI file.
 * @param  {String}        config.targetDir Path to the directory where the files will be generated.
 * @return {Promise}
 */
codegen.generate = async (config) => {
  try {
    console.log('Generating code skeleton');

    // Bundling the OpenAPI file or JSON
    const openapi = await bundle(config.api, config.baseDir);

    // Generate random title if necessary and set default configuration
    const randomTitle = randomName().dashed;
    config.openapi = openapi;

    _.defaultsDeep(config, {
      openapi: {
        info: {
          title: randomTitle,
        },
      },
      icon: 'fa:code',
      package: {
        name: _.kebabCase(_.result(config, 'openapi.info.title', randomTitle)),
      },
      templates: path.resolve(__dirname, '../templates'),
    });

    config.templatesPaths = config.templatesPaths || [];

    config.nodeName =
      config.name || titleCase(_.camelCase(config.openapi.info.title));

    config.displayName = config.displayName || config.nodeName;
    config.defaultName = config.defaultName || config.displayName;

    config.targetDir = config.targetDir || path.resolve(config.output, 'nodes', config.nodeName);

    config.tailProperties = config.tailProperties || ['customBody'];

    if (!fs.existsSync(config.templates)) {
      throw new Error(`Could not find templates at ${config.templates}`);
    }

    if (config.tags && config.tags.length) {
      console.log('Filtering tags:', config.tags);
      config.isFiltered = true;
    }

    config.skipExistingFiles = [];
    config.continuosGenerationFiles = [
      'credentials/',
      'nodes/',
    ];

    config.deleteFolders = config.deleteFolders || ['nodes/{{nodeName}}'];

    config.templateRootDir = config.templatesRoot ? path.resolve(config.templates, config.templatesRoot) : config.templates;

    config.isVersioned = config.preset === 'versioned';

    // Start generating the code skeleton
    console.log('Generating code skeleton');
    console.log('OpenAPI file:', config.openapi.info.title);
    console.log('Base directory:', config.baseDir);
    console.log('Templates directory:', config.templates);
    console.log('Template root directory:', config.templateRootDir);
    console.log('Target directory:', config.targetDir);

    // Execute tasks sequentially with await
    await deleteFolders(config);
    await registerHelpers(config);
    await registerPartials(config);

    // Ensure the target directory exists and write the OpenAPI file
    xfs.mkdirpSync(config.targetDir);

    config.properties = buildNodeProperties(config);
    config.extraProperties = buildExtraOptions(config);

    // dump the properties into a properties.json file
    // fs.writeFileSync(
    //   path.resolve(config.targetDir, 'properties.json'),
    //   JSON.stringify(config.properties, null, 2),
    //   'utf8'
    // );

    // Generate the directory structure
    await generateDirectoryStructure(config);

    // run extension script
    await executeExtensionScript(config);

    // update package.json
    config.package.name =
      config.packageName || config.packageName ||
      `n8n-nodes-${_.kebabCase(config.nodeName)}`;

    await updatePackageJson(config);

    // copy node icons
    await copyNodeIcons(config);
  } catch (error) {
    // If any error occurs, reject the promise
    console.error('Error generating code skeleton:', error);
    throw error;
  }
};


/**
 * Extend any file by copy the target file to extension folder
 */
codegen.extend = async (config) => {
  try {
    const { source, baseDir, force } = config;
    const extensionsDir = path.resolve(baseDir, EXTENSIONS_DIRNAME);

    const srcFilePath = path.resolve(baseDir, source);
    const srcFileSubPath = path.relative(baseDir, srcFilePath);
    const targetFilePath = path.resolve(extensionsDir, srcFileSubPath);

    // check src file exists
    if (!fs.existsSync(srcFilePath)) {
      console.error('File not found:', srcFilePath);
      return;
    }

    // create extension directory if not exists
    xfs.mkdirpSync(extensionsDir);

    // check if the file already exists
    if (fs.existsSync(targetFilePath) && !force) {
      console.log('File already exists:', targetFilePath);
      return;
    }

    // check sub directories
    const subDirs = path.dirname(targetFilePath);
    xfs.mkdirpSync(subDirs);

    // copy file from src to target
    fs.copyFileSync(srcFilePath, targetFilePath);
  } catch (error) {
    // If any error occurs, reject the promise
    console.error('Error extending file:', error);
    throw error;
  }
};
