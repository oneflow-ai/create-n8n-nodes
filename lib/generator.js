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
exports.extend = exports.generate = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const handlebars_1 = __importDefault(require("handlebars"));
const _ = __importStar(require("lodash"));
const fs_extra_1 = __importDefault(require("fs.extra"));
const project_name_generator_1 = __importDefault(require("project-name-generator"));
const register_partial_1 = __importDefault(require("./register-partial"));
const bundler_1 = __importDefault(require("./bundler"));
const yellow = (text) => `\x1b[33m${text}\x1b[0m`;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const prettifier = require('prettier-standard');
const n8n_descriptor_1 = require("./n8n-descriptor");
const HELPERS_DIRNAME = '.helpers';
const PARTIALS_DIRNAME = '.partials';
const EXTENSIONS_DIRNAME = 'extensions';
const deleteFolders = (config) => new Promise((resolve, reject) => {
    try {
        const folder = config.targetDir;
        console.log('Deleting target folder:', folder);
        fs_extra_1.default.rmrfSync(folder);
        resolve();
    }
    catch (e) {
        reject(e);
    }
});
function isSkipedFile(final_path, config) {
    const isFileExist = fs_1.default.existsSync(final_path);
    const relativePath = path_1.default.relative(config.targetDir, final_path);
    const isContinuousGenerationFile = config.continuosGenerationFiles.some((file) => relativePath.startsWith(file));
    return isFileExist && !isContinuousGenerationFile;
}
const handleGenerateFile = async ({ content, data, file_name, targetDir, rendered_path }) => new Promise((resolve, reject) => {
    try {
        const template = handlebars_1.default.compile(content, { noEscape: true });
        let parsed_content = file_name.endsWith('.hbs') ? template(data) : content;
        const generated_path = path_1.default.resolve(targetDir, rendered_path).replace(/.hbs$/, '');
        const final_path = generated_path.replace('[$nodeName]', data.nodeName);
        const skipFile = isSkipedFile(final_path, data);
        if (skipFile) {
            return resolve();
        }
        if (generated_path.endsWith('.ts')) {
            try {
                parsed_content = prettifier.format(parsed_content, { filepath: generated_path, parser: 'typescript' });
            }
            catch (e) {
                console.log(e);
                console.log('Prettify error:', generated_path);
            }
        }
        fs_1.default.writeFile(final_path, parsed_content, 'utf8', (err) => {
            if (err)
                return reject(err);
            resolve();
        });
        if (file_name.endsWith('.hbs')) {
            try {
                fs_1.default.unlinkSync(path_1.default.resolve(targetDir, rendered_path));
            }
            catch (e) { }
        }
    }
    catch (e) {
        reject(e);
    }
});
const generateFile = (options) => new Promise((resolve, reject) => {
    const templates_dir = options.templates_dir;
    const targetDir = options.targetDir;
    const file_name = options.file_name;
    const root = options.root;
    const data = options.data;
    const template_path = path_1.default.relative(templates_dir, path_1.default.resolve(root, file_name));
    const target_path = options.target_path || path_1.default.resolve(targetDir, template_path);
    const rendered_path = target_path.replace('[$nodeName]', data.nodeName);
    fs_1.default.readFile(path_1.default.resolve(root, file_name), 'utf8', (err, content) => {
        if (err)
            return reject(err);
        handleGenerateFile({ content, data, file_name, targetDir, rendered_path }).then(resolve).catch(reject);
    });
});
const findFieldByOperation = (properties, operation, data) => {
    const tailPropertiesKeys = _.get(data, 'tailProperties', []);
    const fields = properties.filter((property) => {
        const displayOptionsRes = _.get(property, 'displayOptions.show.operation', []);
        const isDisplayOptionsRes = displayOptionsRes.includes(operation.value);
        const isTailProperty = tailPropertiesKeys.includes(property.name);
        return isDisplayOptionsRes && !isTailProperty;
    });
    const deDupFields = _.uniqBy(fields, 'name');
    return deDupFields;
};
const getOperationContext = (data, operation) => {
    const parameters = findFieldByOperation(data.properties, operation, data);
    return { operation, parameters };
};
const getResourcesContext = (data) => {
    const resources = _.get(data.properties, '0.options', []);
    return { resources };
};
const getExtraContext = (data) => {
    const extraPropertiesOrg = _.get(data, 'extraProperties', {});
    const tailPropertiesKeys = _.get(data, 'tailProperties', []);
    const allProperties = _.get(data, 'properties', []);
    const tailProperties = allProperties.filter((property) => tailPropertiesKeys.includes(property.name));
    const extraProperties = [].concat(extraPropertiesOrg, tailProperties);
    return { extraProperties };
};
const getTriggerContext = (data) => {
    const options = data.resources.map((resource) => ({
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
    const events = [];
    for (const resource of data.resources) {
        const eventOptions = resource.events.map((event) => ({ name: event.displayName || event.name, value: event.value }));
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
const createFileContext = (data, res = null, operationSelect = {}, operation = null) => {
    const operationContext = operation ? getOperationContext(data, operation) : null;
    const resourcesContext = data.mode === 'trigger' ? {} : getResourcesContext(data);
    const operations = operationSelect.options;
    const resourceSelect = data.mode === 'trigger' ? {} : data.properties[0];
    const extraContext = getExtraContext(data);
    const triggerContext = data.mode === 'trigger' ? getTriggerContext(data) : null;
    const additional = _.merge({}, { res, resourceSelect, operationSelect, operations }, operationContext, resourcesContext, triggerContext, extraContext);
    return _.merge({}, data, additional);
};
const findOperationByResource = (properties, resource) => {
    const operation = properties.find((property) => {
        const displayOptionsRes = _.get(property, 'displayOptions.show.resource', []);
        return property.name === 'operation' && displayOptionsRes.includes(resource.value);
    });
    return operation;
};
const getOperationSlug = (operation) => _.kebabCase(getOperationName(operation));
const generateOperationFiles = ({ root, templates_dir, targetDir, data, file_name, res }) => new Promise((resolve, reject) => {
    const operationSelect = findOperationByResource(data.properties, res);
    const operations = operationSelect.options;
    const createFiles = operations.map((operation) => {
        const template_path = path_1.default.relative(templates_dir, path_1.default.resolve(root, file_name));
        const target_path = path_1.default
            .resolve(targetDir, template_path)
            .replace('[$resource]', _.kebabCase(res.name))
            .replace('[$operation]', getOperationSlug(operation))
            .replace('//', '/');
        const context = createFileContext(data, res, operationSelect, operation);
        return generateFile({ templates_dir, targetDir, file_name, target_path, root, data: context });
    });
    Promise.all(createFiles).then(() => resolve()).catch(reject);
});
const generateResourcesFile = ({ root, templates_dir, targetDir, data, file_name }) => new Promise((resolve, reject) => {
    const resources = _.get(data.properties, '0.options', []);
    const createFiles = resources.map((res) => {
        if (file_name.includes('[$operation]') || root.includes('[$operation]')) {
            return generateOperationFiles({ root, templates_dir, targetDir, data, file_name, res });
        }
        const template_path = path_1.default.relative(templates_dir, path_1.default.resolve(root, file_name));
        const target_path = path_1.default.resolve(targetDir, template_path).replace('[$resource]', _.kebabCase(res.name));
        const operationSelect = findOperationByResource(data.properties, res);
        const context = createFileContext(data, res, operationSelect, null);
        return generateFile({ templates_dir, targetDir, file_name, target_path, root, data: context });
    });
    Promise.all(createFiles).then(() => resolve()).catch(reject);
});
function getOperationName(operation) {
    return _.kebabCase(operation.name);
}
const generateResourceFolder = async (config, tag, operation) => {
    if (config.file_name.includes('[$resource]') && !tag) {
        throw new Error(`Tag is required for this template ${config.file_name}`);
    }
    const newFolderName = config.file_name.replace('[$resource]', _.kebabCase(tag.name));
    const subdir = path_1.default
        .resolve(config.targetDir, path_1.default.relative(config.templates_dir, config.root))
        .replace('[$nodeName]', config.data.nodeName)
        .replace('[$resource]', _.kebabCase(tag.name));
    let targetPath = path_1.default.resolve(config.targetDir, subdir, newFolderName);
    if (targetPath.includes('[$operation]')) {
        const operationName = getOperationName(operation);
        targetPath = targetPath.split('[$operation]').join(operationName);
    }
    if (targetPath.includes('$')) {
        throw new Error(`Invalid target path: ${targetPath}`);
    }
    fs_extra_1.default.mkdirpSync(targetPath);
};
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
const generateResourceFolders = async (config) => {
    const resources = _.get(config.data.properties, '0.options', []);
    for (const res of resources) {
        if (config.file_name.includes('[$operation]') || config.root.includes('[$operation]')) {
            await generateOperationFolders(config, res);
        }
        else {
            await generateResourceFolder(config, res);
        }
    }
};
const generateDirectoryStructure = (config) => new Promise((resolve, reject) => {
    console.log('Generating directory structure');
    const targetDir = config.targetDir;
    const templates_dir = config.templateRootDir;
    console.log('Target directory:', targetDir);
    const walker = fs_extra_1.default.walk(templates_dir, { followLinks: false });
    const context = createFileContext(config);
    walker.on('file', (root, stats, next) => {
        const skipFiles = [PARTIALS_DIRNAME, HELPERS_DIRNAME, '.git'];
        if (skipFiles.some((file) => root.includes(file))) {
            return next();
        }
        try {
            if (root.includes('[$resource]')) {
                generateResourcesFile({ root, templates_dir, targetDir, data: context, file_name: stats.name })
                    .then(next)
                    .catch(reject);
            }
            else {
                generateFile({ root, templates_dir, targetDir, data: context, file_name: stats.name })
                    .then(next)
                    .catch(reject);
            }
        }
        catch (e) {
            reject(e);
        }
    });
    walker.on('directory', async (root, stats, next) => {
        const skipFolders = [PARTIALS_DIRNAME, HELPERS_DIRNAME, '.git'];
        const dirPathTpl = path_1.default.resolve(targetDir, path_1.default.relative(templates_dir, path_1.default.resolve(root, stats.name)));
        const dirPath = dirPathTpl.replace('[$nodeName]', config.nodeName);
        if (skipFolders.some((folder) => dirPath.includes(folder))) {
            return next();
        }
        try {
            if (stats.name.includes('[$resource]') || root.includes('[$resource]')) {
                await generateResourceFolders({ root, templates_dir, targetDir, data: config, file_name: stats.name });
            }
            else {
                fs_extra_1.default.mkdirpSync(dirPath);
            }
            next();
        }
        catch (e) {
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
const registerHelpers = (config) => new Promise((resolve, reject) => {
    const helpers_dir = path_1.default.resolve(config.templates, HELPERS_DIRNAME);
    if (!fs_1.default.existsSync(helpers_dir))
        return resolve();
    const walker = fs_extra_1.default.walk(helpers_dir, { followLinks: false });
    walker.on('file', async (root, stats, next) => {
        try {
            const file_path = path_1.default.resolve(config.templates, path_1.default.resolve(root, stats.name));
            const mod = require(file_path);
            if (typeof mod === 'function')
                mod(handlebars_1.default, _);
            next();
        }
        catch (e) {
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
const registerPartials = (config) => new Promise((resolve, reject) => {
    const partials_dir = path_1.default.resolve(config.templates, PARTIALS_DIRNAME);
    if (!fs_1.default.existsSync(partials_dir))
        return resolve();
    const walker = fs_extra_1.default.walk(partials_dir, { followLinks: false });
    walker.on('file', async (root, stats, next) => {
        try {
            const file_path = path_1.default.resolve(config.templates, path_1.default.resolve(root, stats.name));
            await (0, register_partial_1.default)(file_path);
            next();
        }
        catch (e) {
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
const bundle = async (openapi, baseDir) => {
    if (typeof openapi === 'string') {
        try {
            const schema = await (0, bundler_1.default)(openapi, baseDir);
            return schema;
        }
        catch (e) {
            throw e;
        }
    }
    else if (typeof openapi !== 'object') {
        throw new Error(`Could not find a valid OpenAPI definition: ${openapi}`);
    }
};
function updatePackageJson(config) {
    const packageJsonPath = path_1.default.resolve(config.baseDir, 'package.json');
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
        for (const credential of Object.values(config.credentialDefs)) {
            packageJson.n8n.credentials.push(`dist/credentials/${credential.className}.credentials.js`);
        }
    }
    fs_1.default.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
}
function titleCase(str) {
    return str
        .toLowerCase()
        .split(' ')
        .map((word) => word.replace(word[0], word[0].toUpperCase()))
        .join(' ');
}
function extractDynamicParams(str) {
    const dynamicParams = [];
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
const renderDynamicParams = (str, dynamicParams, context) => {
    const strPathEscaped = str.replace(/\//g, '%2F').replace(/\\/g, '%5C');
    const template = handlebars_1.default.compile(strPathEscaped);
    const result = template(context);
    return result.replace(/%2F/g, '/').replace(/%5C/g, '\\');
};
const executeDynamicGeneration = (dynamicParams, srcFilePath, targetFilePath, config) => new Promise((resolve) => {
    const targetFilePathRendered = renderDynamicParams(targetFilePath, dynamicParams, config);
    fs_1.default.copyFileSync(srcFilePath, targetFilePathRendered);
    resolve();
});
const executeExtensionScript = (config) => new Promise((resolve, reject) => {
    const extensions_dir = path_1.default.resolve(config.baseDir, EXTENSIONS_DIRNAME);
    if (!fs_1.default.existsSync(extensions_dir))
        return resolve();
    console.log('Executing extension script');
    const walker = fs_extra_1.default.walk(extensions_dir, { followLinks: false });
    walker.on('file', async (root, stats, next) => {
        try {
            if (stats.name.startsWith('.') || root.includes('/.') || root.includes('\\.')) {
                return next();
            }
            const srcFilePath = path_1.default.resolve(extensions_dir, path_1.default.resolve(root, stats.name));
            const srcFileSubPath = path_1.default.relative(extensions_dir, srcFilePath);
            const targetFilePath = path_1.default.resolve(config.baseDir, srcFileSubPath);
            const dynamicParams = extractDynamicParams(srcFilePath);
            if (dynamicParams.length > 0) {
                executeDynamicGeneration(dynamicParams, srcFilePath, targetFilePath, config);
            }
            else {
                if (fs_1.default.existsSync(targetFilePath)) {
                    fs_1.default.unlinkSync(targetFilePath);
                }
                fs_1.default.copyFileSync(srcFilePath, targetFilePath);
            }
            next();
        }
        catch (e) {
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
const copyNodeIcons = (config) => new Promise((resolve) => {
    console.log('Copying node icons');
    const iconPath = path_1.default.resolve(config.baseDir, config.icon);
    if (fs_1.default.existsSync(iconPath)) {
        const fileName = path_1.default.basename(iconPath);
        const nodePath = path_1.default.resolve(config.targetDir);
        const targetPath = path_1.default.resolve(nodePath);
        fs_extra_1.default.mkdirpSync(targetPath);
        fs_1.default.copyFileSync(iconPath, path_1.default.resolve(targetPath, fileName));
    }
    resolve();
});
const generate = async (config) => {
    try {
        console.log('Generating code skeleton');
        const openapi = await bundle(config.api, config.baseDir);
        const randomTitle = (0, project_name_generator_1.default)().dashed;
        config.openapi = openapi;
        _.defaultsDeep(config, {
            openapi: { info: { title: randomTitle } },
            icon: 'fa:code',
            package: { name: _.kebabCase(_.result(config, 'openapi.info.title', randomTitle)) },
            templates: path_1.default.resolve(__dirname, '../templates'),
        });
        config.templatesPaths = config.templatesPaths || [];
        config.nodeName = config.name || titleCase(_.camelCase(config.openapi.info.title));
        config.displayName = config.displayName || config.nodeName;
        config.defaultName = config.defaultName || config.displayName;
        config.targetDir = config.targetDir || path_1.default.resolve(config.output, 'nodes', config.nodeName);
        config.tailProperties = config.tailProperties || ['customBody'];
        if (!fs_1.default.existsSync(config.templates)) {
            throw new Error(`Could not find templates at ${config.templates}`);
        }
        if (config.tags && config.tags.length) {
            console.log('Filtering tags:', config.tags);
            config.isFiltered = true;
        }
        config.skipExistingFiles = [];
        config.continuosGenerationFiles = ['credentials/', 'nodes/'];
        config.deleteFolders = config.deleteFolders || ['nodes/{{nodeName}}'];
        config.templateRootDir = config.templatesRoot ? path_1.default.resolve(config.templates, config.templatesRoot) : config.templates;
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
        fs_extra_1.default.mkdirpSync(config.targetDir);
        config.properties = (0, n8n_descriptor_1.buildNodeProperties)(config);
        config.extraProperties = (0, n8n_descriptor_1.buildExtraOptions)(config);
        await generateDirectoryStructure(config);
        await executeExtensionScript(config);
        config.package.name = config.packageName || config.packageName || `n8n-nodes-${_.kebabCase(config.nodeName)}`;
        await updatePackageJson(config);
        await copyNodeIcons(config);
    }
    catch (error) {
        console.error('Error generating code skeleton:', error);
        throw error;
    }
};
exports.generate = generate;
const extend = async (config) => {
    try {
        const { source, baseDir, force } = config;
        const extensionsDir = path_1.default.resolve(baseDir, EXTENSIONS_DIRNAME);
        const srcFilePath = path_1.default.resolve(baseDir, source);
        const srcFileSubPath = path_1.default.relative(baseDir, srcFilePath);
        const targetFilePath = path_1.default.resolve(extensionsDir, srcFileSubPath);
        if (!fs_1.default.existsSync(srcFilePath)) {
            console.error('File not found:', srcFilePath);
            return;
        }
        fs_extra_1.default.mkdirpSync(extensionsDir);
        if (fs_1.default.existsSync(targetFilePath) && !force) {
            console.log('File already exists:', targetFilePath);
            return;
        }
        const subDirs = path_1.default.dirname(targetFilePath);
        fs_extra_1.default.mkdirpSync(subDirs);
        fs_1.default.copyFileSync(srcFilePath, targetFilePath);
    }
    catch (error) {
        console.error('Error extending file:', error);
        throw error;
    }
};
exports.extend = extend;
