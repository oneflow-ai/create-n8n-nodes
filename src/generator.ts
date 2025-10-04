/**
 * This module generates a code skeleton for an API using OpenAPI.
 */
import os from 'os';
import path from 'path';
import fs from 'fs';
import Handlebars from 'handlebars';
import * as _ from 'lodash';
import xfs from 'fs.extra';
import randomName from 'project-name-generator';
import registerPartial from './register-partial';
import bundler from './bundler';
const yellow = (text: string) => `\x1b[33m${text}\x1b[0m`;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const prettifier = require('prettier-standard');
import { buildNodeProperties, buildExtraOptions } from './n8n-descriptor';

const HELPERS_DIRNAME = '.helpers';
const PARTIALS_DIRNAME = '.partials';
const EXTENSIONS_DIRNAME = 'extensions';

const deleteFolders = (config: any) =>
  new Promise<void>((resolve, reject) => {
    try {
      const folder = config.targetDir;
      console.log('Deleting target folder:', folder);
      (xfs as any).rmrfSync(folder);
      resolve();
    } catch (e) {
      reject(e);
    }
  });

function isSkipedFile(final_path: string, config: any) {
  const isFileExist = fs.existsSync(final_path);
  const relativePath = path.relative(config.targetDir, final_path);
  const isContinuousGenerationFile = (config.continuosGenerationFiles as string[]).some((file: string) =>
    relativePath.startsWith(file),
  );
  return isFileExist && !isContinuousGenerationFile;
}

const handleGenerateFile = async ({ content, data, file_name, targetDir, rendered_path }: any) =>
  new Promise<void>((resolve, reject) => {
    try {
      const template = Handlebars.compile(content, { noEscape: true });
      let parsed_content = file_name.endsWith('.hbs') ? template(data) : content;
      const generated_path = path.resolve(targetDir, rendered_path).replace(/.hbs$/, '');
      const final_path = generated_path.replace('[$nodeName]', data.nodeName);
      const skipFile = isSkipedFile(final_path, data);
      if (skipFile) {
        return resolve();
      }
      if (generated_path.endsWith('.ts')) {
        try {
          parsed_content = prettifier.format(parsed_content, { filepath: generated_path, parser: 'typescript' });
        } catch (e) {
          console.log(e);
          console.log('Prettify error:', generated_path);
        }
      }
      fs.writeFile(final_path, parsed_content, 'utf8', (err) => {
        if (err) return reject(err);
        resolve();
      });
      if (file_name.endsWith('.hbs')) {
        try {
          fs.unlinkSync(path.resolve(targetDir, rendered_path));
        } catch (e) {}
      }
    } catch (e) {
      reject(e);
    }
  });

const generateFile = (options: any) =>
  new Promise<void>((resolve, reject) => {
    const templates_dir = options.templates_dir;
    const targetDir = options.targetDir;
    const file_name = options.file_name;
    const root = options.root;
    const data = options.data;
    const template_path = path.relative(templates_dir, path.resolve(root, file_name));
    const target_path = options.target_path || path.resolve(targetDir, template_path);
    const rendered_path = target_path.replace('[$nodeName]', data.nodeName);
    fs.readFile(path.resolve(root, file_name), 'utf8', (err, content) => {
      if (err) return reject(err);
      handleGenerateFile({ content, data, file_name, targetDir, rendered_path }).then(resolve).catch(reject);
    });
  });

const findFieldByOperation = (properties: any[], operation: any, data: any) => {
  const tailPropertiesKeys = _.get(data, 'tailProperties', []);
  const fields = properties.filter((property) => {
    const displayOptionsRes = _.get(property, 'displayOptions.show.operation', []);
    const isDisplayOptionsRes = displayOptionsRes.includes(operation.value);
    const isTailProperty = (tailPropertiesKeys as string[]).includes(property.name);
    return isDisplayOptionsRes && !isTailProperty;
  });
  const deDupFields = _.uniqBy(fields, 'name');
  return deDupFields;
};

const getOperationContext = (data: any, operation: any) => {
  const parameters = findFieldByOperation(data.properties, operation, data);
  return { operation, parameters };
};

const getResourcesContext = (data: any) => {
  const resources = _.get(data.properties, '0.options', []);
  return { resources };
};

const getExtraContext = (data: any) => {
  const extraPropertiesOrg = _.get(data, 'extraProperties', {});
  const tailPropertiesKeys = _.get(data, 'tailProperties', []);
  const allProperties = _.get(data, 'properties', []);
  const tailProperties = allProperties.filter((property: any) => (tailPropertiesKeys as string[]).includes(property.name));
  const extraProperties = ([] as any[]).concat(extraPropertiesOrg, tailProperties);
  return { extraProperties };
};

const getTriggerContext = (data: any) => {
  const options = data.resources.map((resource: any) => ({
    name: resource.displayName || resource.name,
    value: resource.name,
  }));
  const resourceSelect = {
    name: 'resource',
    displayName: 'Resource',
    type: 'options',
    options,
    default: data.resources[0].name,
  };
  const events: any[] = [];
  for (const resource of data.resources) {
    const eventOptions = resource.events.map((event: any) => ({ name: event.displayName || event.name, value: event.value }));
    const eventSelect = {
      name: 'event',
      displayName: 'Event',
      type: 'options',
      options: eventOptions,
      default: resource.events[0].value,
      displayOptions: { show: { resource: [resource.value] } },
    };
    events.push(eventSelect);
  }
  return { resourceSelect, events };
};

const createFileContext = (data: any, res: any = null, operationSelect: any = {}, operation: any = null) => {
  const operationContext = operation ? getOperationContext(data, operation) : null;
  const resourcesContext = data.mode === 'trigger' ? {} : getResourcesContext(data);
  const operations = operationSelect.options;
  const resourceSelect = data.mode === 'trigger' ? {} : data.properties[0];
  const extraContext = getExtraContext(data);
  const triggerContext = data.mode === 'trigger' ? getTriggerContext(data) : null;
  const additional = _.merge(
    {},
    { res, resourceSelect, operationSelect, operations },
    operationContext,
    resourcesContext,
    triggerContext,
    extraContext,
  );
  return _.merge({}, data, additional);
};

const findOperationByResource = (properties: any[], resource: any) => {
  const operation = properties.find((property) => {
    const displayOptionsRes = _.get(property, 'displayOptions.show.resource', []);
    return property.name === 'operation' && displayOptionsRes.includes(resource.value);
  });
  return operation;
};

const getOperationSlug = (operation: any) => _.kebabCase(getOperationName(operation));

const generateOperationFiles = ({ root, templates_dir, targetDir, data, file_name, res }: any) =>
  new Promise<void>((resolve, reject) => {
    const operationSelect = findOperationByResource(data.properties, res);
    const operations = operationSelect.options;
    const createFiles = operations.map((operation: any) => {
      const template_path = path.relative(templates_dir, path.resolve(root, file_name));
      const target_path = path
        .resolve(targetDir, template_path)
        .replace('[$resource]', _.kebabCase(res.name))
        .replace('[$operation]', getOperationSlug(operation))
        .replace('//', '/');
      const context = createFileContext(data, res, operationSelect, operation);
      return generateFile({ templates_dir, targetDir, file_name, target_path, root, data: context });
    });
    Promise.all(createFiles).then(() => resolve()).catch(reject);
  });

const generateResourcesFile = ({ root, templates_dir, targetDir, data, file_name }: any) =>
  new Promise<void>((resolve, reject) => {
    const resources = _.get(data.properties, '0.options', []);
    const createFiles = resources.map((res: any) => {
      if (file_name.includes('[$operation]') || root.includes('[$operation]')) {
        return generateOperationFiles({ root, templates_dir, targetDir, data, file_name, res });
      }
      const template_path = path.relative(templates_dir, path.resolve(root, file_name));
      const target_path = path.resolve(targetDir, template_path).replace('[$resource]', _.kebabCase(res.name));
      const operationSelect = findOperationByResource(data.properties, res);
      const context = createFileContext(data, res, operationSelect, null);
      return generateFile({ templates_dir, targetDir, file_name, target_path, root, data: context });
    });
    Promise.all(createFiles).then(() => resolve()).catch(reject);
  });

function getOperationName(operation: any) {
  return _.kebabCase(operation.name);
}

const generateResourceFolder = async (config: any, tag: any, operation?: any) => {
  if (config.file_name.includes('[$resource]') && !tag) {
    throw new Error(`Tag is required for this template ${config.file_name}`);
  }
  const newFolderName = config.file_name.replace('[$resource]', _.kebabCase(tag.name));
  const subdir = path
    .resolve(config.targetDir, path.relative(config.templates_dir, config.root))
    .replace('[$nodeName]', config.data.nodeName)
    .replace('[$resource]', _.kebabCase(tag.name));
  let targetPath = path.resolve(config.targetDir, subdir, newFolderName);
  if (targetPath.includes('[$operation]')) {
    const operationName = getOperationName(operation);
    targetPath = (targetPath as string).split('[$operation]').join(operationName);
  }
  if ((targetPath as string).includes('$')) {
    throw new Error(`Invalid target path: ${targetPath}`);
  }
  (xfs as any).mkdirpSync(targetPath);
};

const generateOperationFolders = async (config: any, res: any) => {
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

const generateResourceFolders = async (config: any) => {
  const resources = _.get(config.data.properties, '0.options', []);
  for (const res of resources) {
    if (config.file_name.includes('[$operation]') || config.root.includes('[$operation]')) {
      await generateOperationFolders(config, res);
    } else {
      await generateResourceFolder(config, res);
    }
  }
};

const generateDirectoryStructure = (config: any) =>
  new Promise<void>((resolve, reject) => {
    console.log('Generating directory structure');
    const targetDir = config.targetDir;
    const templates_dir = config.templateRootDir;
    console.log('Target directory:', targetDir);
    const walker = (xfs as any).walk(templates_dir, { followLinks: false });
    const context = createFileContext(config);
    walker.on('file', (root: string, stats: any, next: () => void) => {
      const skipFiles = [PARTIALS_DIRNAME, HELPERS_DIRNAME, '.git'];
      if (skipFiles.some((file) => root.includes(file))) {
        return next();
      }
      try {
        if (root.includes('[$resource]')) {
          generateResourcesFile({ root, templates_dir, targetDir, data: context, file_name: stats.name })
            .then(next)
            .catch(reject);
        } else {
          generateFile({ root, templates_dir, targetDir, data: context, file_name: stats.name })
            .then(next)
            .catch(reject);
        }
      } catch (e) {
        reject(e);
      }
    });
    walker.on('directory', async (root: string, stats: any, next: () => void) => {
      const skipFolders = [PARTIALS_DIRNAME, HELPERS_DIRNAME, '.git'];
      const dirPathTpl = path.resolve(targetDir, path.relative(templates_dir, path.resolve(root, stats.name)));
      const dirPath = dirPathTpl.replace('[$nodeName]', config.nodeName);
      if (skipFolders.some((folder) => dirPath.includes(folder))) {
        return next();
      }
      try {
        if (stats.name.includes('[$resource]') || root.includes('[$resource]')) {
          await generateResourceFolders({ root, templates_dir, targetDir, data: config, file_name: stats.name });
        } else {
          (xfs as any).mkdirpSync(dirPath);
        }
        next();
      } catch (e) {
        reject(e);
      }
    });
    walker.on('errors', (root: string, nodeStatsArray: any) => {
      reject(nodeStatsArray);
    });
    walker.on('end', async () => {
      console.log('Directory structure generated');
      resolve();
    });
  });

const registerHelpers = (config: any) =>
  new Promise<void>((resolve, reject) => {
    const helpers_dir = path.resolve(config.templates, HELPERS_DIRNAME);
    if (!fs.existsSync(helpers_dir)) return resolve();
    const walker = (xfs as any).walk(helpers_dir, { followLinks: false });
    walker.on('file', async (root: string, stats: any, next: () => void) => {
      try {
        const file_path = path.resolve(config.templates, path.resolve(root, stats.name));
        const mod = require(file_path);
        if (typeof mod === 'function') mod(Handlebars, _);
        next();
      } catch (e) {
        reject(e);
      }
    });
    walker.on('errors', (root: string, nodeStatsArray: any) => {
      reject(nodeStatsArray);
    });
    walker.on('end', async () => {
      resolve();
    });
  });

const registerPartials = (config: any) =>
  new Promise<void>((resolve, reject) => {
    const partials_dir = path.resolve(config.templates, PARTIALS_DIRNAME);
    if (!fs.existsSync(partials_dir)) return resolve();
    const walker = (xfs as any).walk(partials_dir, { followLinks: false });
    walker.on('file', async (root: string, stats: any, next: () => void) => {
      try {
        const file_path = path.resolve(config.templates, path.resolve(root, stats.name));
        await registerPartial(file_path);
        next();
      } catch (e) {
        reject(e);
      }
    });
    walker.on('errors', (root: string, nodeStatsArray: any) => {
      reject(nodeStatsArray);
    });
    walker.on('end', () => {
      resolve();
    });
  });

const bundle = async (openapi: any, baseDir: string) => {
  if (typeof openapi === 'string') {
    try {
      const schema = await bundler(openapi, baseDir);
      return schema;
    } catch (e) {
      throw e;
    }
  } else if (typeof openapi !== 'object') {
    throw new Error(`Could not find a valid OpenAPI definition: ${openapi}`);
  }
};

function updatePackageJson(config: any) {
  const packageJsonPath = path.resolve(config.baseDir, 'package.json');
  const packageJson = require(packageJsonPath);
  packageJson.name = config.package.name;
  packageJson.n8n = packageJson.n8n || { nodes: [], credentials: [] };
  packageJson.n8n.credentials = packageJson.n8n.credentials || [];
  packageJson.n8n.nodes = packageJson.n8n.nodes || [];
  const nodeDistPath = `dist/nodes/${config.nodeName}/${config.nodeName}.node.js`;
  if (!packageJson.n8n.nodes.includes(nodeDistPath)) {
    packageJson.n8n.nodes.push(nodeDistPath);
  }
  if (config && config.credentialDefs) {
    for (const credential of Object.values(config.credentialDefs as any)) {
      (packageJson.n8n.credentials as string[]).push(`dist/credentials/${(credential as any).className}.credentials.js`);
    }
  }
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
}

function titleCase(str: string) {
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => word.replace(word[0], word[0].toUpperCase()))
    .join(' ');
}

function extractDynamicParams(str: string) {
  const dynamicParams: Array<{ name: string; iterable: boolean }> = [];
  const regex = /{{(.*?)}}/g;
  const matches = str.match(regex);
  if (matches) {
    matches.forEach((match) => {
      const name = match.replace(/{{|}}/g, '');
      const iterable = name.startsWith('[') && name.endsWith(']');
      dynamicParams.push({ name: name.replace(/\[|\]/g, ''), iterable });
    });
  }
  return dynamicParams;
}

const renderDynamicParams = (str: string, dynamicParams: any, context: any) => {
  const strPathEscaped = str.replace(/\//g, '%2F').replace(/\\/g, '%5C');
  const template = Handlebars.compile(strPathEscaped);
  const result = template(context);
  return result.replace(/%2F/g, '/').replace(/%5C/g, '\\');
};

const executeDynamicGeneration = (dynamicParams: any, srcFilePath: string, targetFilePath: string, config: any) =>
  new Promise<void>((resolve) => {
    const targetFilePathRendered = renderDynamicParams(targetFilePath, dynamicParams, config);
    fs.copyFileSync(srcFilePath, targetFilePathRendered);
    resolve();
  });

const executeExtensionScript = (config: any) =>
  new Promise<void>((resolve, reject) => {
    const extensions_dir = path.resolve(config.baseDir, EXTENSIONS_DIRNAME);
    if (!fs.existsSync(extensions_dir)) return resolve();
    console.log('Executing extension script');
    const walker = (xfs as any).walk(extensions_dir, { followLinks: false });
    walker.on('file', async (root: string, stats: any, next: () => void) => {
      try {
        if (stats.name.startsWith('.') || root.includes('/.') || root.includes('\\.')) {
          return next();
        }
        const srcFilePath = path.resolve(extensions_dir, path.resolve(root, stats.name));
        const srcFileSubPath = path.relative(extensions_dir, srcFilePath);
        const targetFilePath = path.resolve(config.baseDir, srcFileSubPath);
        const dynamicParams = extractDynamicParams(srcFilePath);
        if (dynamicParams.length > 0) {
          executeDynamicGeneration(dynamicParams, srcFilePath, targetFilePath, config);
        } else {
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
    walker.on('errors', (root: string, nodeStatsArray: any) => {
      reject(nodeStatsArray);
    });
    walker.on('end', () => {
      resolve();
    });
  });

const copyNodeIcons = (config: any) =>
  new Promise<void>((resolve) => {
    console.log('Copying node icons');
    const iconPath = path.resolve(config.baseDir, config.icon);
    if (fs.existsSync(iconPath)) {
      const fileName = path.basename(iconPath);
      const nodePath = path.resolve(config.targetDir);
      const targetPath = path.resolve(nodePath);
      (xfs as any).mkdirpSync(targetPath);
      fs.copyFileSync(iconPath, path.resolve(targetPath, fileName));
    }
    resolve();
  });

export const generate = async (config: any) => {
  try {
    console.log('Generating code skeleton');
    const openapi = await bundle(config.api, config.baseDir);
    const randomTitle = (randomName() as any).dashed;
    config.openapi = openapi;
    _.defaultsDeep(config, {
      openapi: { info: { title: randomTitle } },
      icon: 'fa:code',
      package: { name: _.kebabCase(_.result(config, 'openapi.info.title', randomTitle)) },
      templates: path.resolve(__dirname, '../templates'),
    });
    config.templatesPaths = config.templatesPaths || [];
    config.nodeName = config.name || titleCase(_.camelCase(config.openapi.info.title));
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
    config.continuosGenerationFiles = ['credentials/', 'nodes/'];
    config.deleteFolders = config.deleteFolders || ['nodes/{{nodeName}}'];
    config.templateRootDir = config.templatesRoot ? path.resolve(config.templates, config.templatesRoot) : config.templates;
    config.isVersioned = config.preset === 'versioned';
    console.log('Generating code skeleton');
    console.log('OpenAPI file:', config.openapi.info.title);
    console.log('Base directory:', config.baseDir);
    console.log('Templates directory:', config.templates);
    console.log('Template root directory:', config.templateRootDir);
    console.log('Target directory:', config.targetDir);
    await deleteFolders(config);
    await registerHelpers(config);
    await registerPartials(config);
    (xfs as any).mkdirpSync(config.targetDir);
    config.properties = buildNodeProperties(config);
    config.extraProperties = buildExtraOptions(config);
    await generateDirectoryStructure(config);
    await executeExtensionScript(config);
    config.package.name = config.packageName || config.packageName || `n8n-nodes-${_.kebabCase(config.nodeName)}`;
    await updatePackageJson(config);
    await copyNodeIcons(config);
  } catch (error) {
    console.error('Error generating code skeleton:', error);
    throw error;
  }
};

export const extend = async (config: any) => {
  try {
    const { source, baseDir, force } = config;
    const extensionsDir = path.resolve(baseDir, EXTENSIONS_DIRNAME);
    const srcFilePath = path.resolve(baseDir, source);
    const srcFileSubPath = path.relative(baseDir, srcFilePath);
    const targetFilePath = path.resolve(extensionsDir, srcFileSubPath);
    if (!fs.existsSync(srcFilePath)) {
      console.error('File not found:', srcFilePath);
      return;
    }
    (xfs as any).mkdirpSync(extensionsDir);
    if (fs.existsSync(targetFilePath) && !force) {
      console.log('File already exists:', targetFilePath);
      return;
    }
    const subDirs = path.dirname(targetFilePath);
    (xfs as any).mkdirpSync(subDirs);
    fs.copyFileSync(srcFilePath, targetFilePath);
  } catch (error) {
    console.error('Error extending file:', error);
    throw error;
  }
};
