#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Command } = require('commander');
const packageInfo = require('../package.json');
const generator = require('../src/generator');
const merger = require('../src/merge-openapi');
const _ = require('lodash');

const red = text => `\x1b[31m${text}\x1b[0m`;
const yellow = text => `\x1b[33m${text}\x1b[0m`;
const green = text => `\x1b[32m${text}\x1b[0m`;

const program = new Command();
let config = {};

program
  .version(packageInfo.version)
  .description('CLI tool to generate n8n nodes')
  .option('-b, --baseDir <baseDir>', 'base directory to use', process.cwd())
  .option('-d --destination <destination>', 'destination directory to use', process.cwd())
  .option('-c, --config <configFile>', 'configuration file to use', (configFile) => {
    config = loadConfigFile(configFile);

    // Hotfix: Remove the credentials from the config file
    if (config.credentials) {
      config.credentialDefs = config.credentials;
      delete config.credentials;
    }
  });

/**
 * create-n8n-nodes init
 * Init command
 * Initializes the project
 */
program
  .command('init')
  .description('Initialize the project')
  .action(() => {
    console.log(green('Project initialized successfully!'));
    // Add your init logic here
    console.log(yellow('Not implemented yet'));
  });

/**
 * Generate command
 * Generates nodes based on options or config
 */
program
  .command('generate')
  .description('Generate nodes')
  .option('-o, --output <outputDir>', 'directory to put the generated files', process.cwd())
  .option('-t, --templates <templateDir>', 'directory where templates are located')
  .option('-a, --api <openapiFile>', 'OpenAPI file to use')
  .option('-n, --name <name>', 'name of the generated Node')
  .action((cmdOptions) => {
    const mergedOptions = _.merge({}, config, cmdOptions);

    const defaultOptions = {
      baseDir: process.cwd(),
      output: '.',
      api: './openapi.yml',
      templates: path.resolve(__dirname, '../templates/n8n-nodes')
    };

    _.defaultsDeep(mergedOptions, defaultOptions);

    mergedOptions.baseDir = path.resolve(process.cwd(), mergedOptions.baseDir);

    console.log(yellow('Generating nodes'), mergedOptions.templates);

    mergedOptions.output = path.resolve(mergedOptions.baseDir, mergedOptions.output);
    mergedOptions.api = path.resolve(mergedOptions.baseDir, mergedOptions.api);
    mergedOptions.templates = path.resolve(mergedOptions.baseDir, mergedOptions.templates);

    mergedOptions.templatesRoot = 'nodes/[$nodeName]';

    if (config && config.nodes) {
      runMultipleGenerators(mergedOptions);
    } else {
      runGenerator(mergedOptions);
    }
  });

/**
 * create-n8n-nodes openapi
 * OpenAPI command
 * Generates OpenAPI file
 */
program
  .command('openapi <openapiFileOrURL> <template>')
  .description('Generate OpenAPI file')
  .option('-o, --output <outputDir>', 'directory where to put the generated files', process.cwd())
  // eslint-disable-next-line no-unused-vars
  .action((openapiFileOrURL, template, cmdOptions) => {
    // Add your init logic here
    console.log(yellow('Not implemented yet'));
  });

/**
 * create-n8n-nodes p2o
 * Convert Postman to OpenAPI command
 * Converts Postman collection to OpenAPI file
 */
program
  .command('p2o <postmanCollection> <template>')
  .description('Convert Postman collection to OpenAPI file')
  .option('-o, --output <outputDir>', 'directory where to put the generated files', process.cwd())
  // eslint-disable-next-line no-unused-vars
  .action((postmanCollection, template, cmdOptions) => {
    // Add your init logic here
    console.log(yellow('Not implemented yet'));
  });


/**
  * create-n8n-nodes merge -o ./openapi.yml -i ./apis/api.yml -p ymls
  * Merge openapi file from multiple openapi files by preset
**/
program
  .command('merge')
  .description('Craft openapi file from multiple openapi files by preset')
  .option('-o, --output <outputDir>', 'directory where to put the generated files', process.cwd())
  .option('-i, --input <inputDir>', 'directory where to put the generated files', process.cwd())
  .option('-p, --preset <preset>', 'preset to use')
  .action((cmdOptions) => {
    console.log(yellow('Merging openapi files'));

    cmdOptions.baseDir = path.resolve(process.cwd());

    cmdOptions.input = path.resolve(cmdOptions.baseDir, cmdOptions.input);
    cmdOptions.output = path.resolve(cmdOptions.baseDir, cmdOptions.output);

    merger.merge(cmdOptions);
  });

/**
* create-n8n-nodes split -i ./apis/api.json -o ./apis/groups
* Split json file into multiple files
**/
program
  .command('split')
  .description('Split json file into multiple files')
  .option('-i, --input <inputDir>', 'directory where to put the generated files', process.cwd())
  .option('-o, --output <outputDir>', 'directory where to put the generated files', process.cwd())
  .action((cmdOptions) => {
    console.log(yellow('Splitting openapi files'));

    cmdOptions.baseDir = path.resolve(process.cwd());

    cmdOptions.input = path.resolve(cmdOptions.baseDir, cmdOptions.input);
    cmdOptions.output = path.resolve(cmdOptions.baseDir, cmdOptions.output);

    merger.split(cmdOptions);
  });

/**
* create-n8n-nodes extend -f ./nodes/NodeName/resources/hooks.ts
* Extend any file by copy the target file to extension folder
**/
program
  .command('extend')
  .description('Extend any file by copy the target file to extension folder')
  .option('-b, --baseDir <baseDir>', 'base directory to use', process.cwd())
  .option('-s, --source <source>', 'source file to extend')
  .option('-f, --force', 'force override the file')
  .action((cmdOptions) => {

    // required options source
    if (!cmdOptions.source) {
      console.error(red('Error: Source file is required'));
      process.exit(1);
    }

    console.log(yellow('Extending file'), cmdOptions.source);
    generator.extend(cmdOptions);
  });

// Parse CLI arguments
program.parse(process.argv);

// Helper functions
function runMultipleGenerators(options) {
  const { name } = options;
  for (const [key, node] of Object.entries(options.nodes)) {
    if (node.disabled) {
      console.log(yellow('Skipping Node'), key);
      continue;
    }

    if (name && key !== name) {
      continue;
    }

    const nodeOptions = _.merge({ node }, options, node);
    runGenerator(nodeOptions);
  }

  // generate triggers
  for (const [key, trigger] of Object.entries(options.triggers)) {
    if (trigger.disabled) {
      console.log(yellow('Skipping Trigger'), key);
      continue;
    }

    if (name && key !== name) {
      continue;
    }

    const triggerOptions = _.merge({ trigger, mode: 'trigger' }, options, trigger);

    _.set(triggerOptions, 'templatesRoot', 'triggers/[$nodeName]');

    runGenerator(triggerOptions);
  }
}

function runGenerator(options) {
  console.log(yellow('Generating Node'), options.name || '');

  generator.generate(options)
    .then(() => {
      console.log(green('Done! ✨'));
    })
    .catch(err => {
      console.error(red('Error:'));
      console.error(red(err.stack || err.message));
    });
}

function loadConfigFile(configFilePath) {
  const resolvedPath = path.resolve(process.cwd(), configFilePath);
  if (configFilePath.endsWith('.json')) {
    return JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  }

  if (configFilePath.endsWith('.js')) {
    return require(resolvedPath);
  }

  console.error(red('Unsupported config file format'));
  process.exit(1);
}
