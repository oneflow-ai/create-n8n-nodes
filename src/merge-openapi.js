const { merge, isErrorResult } = require('openapi-merge');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const _ = require('lodash');

function loadJsonFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const json = JSON.parse(content);
  return json;
}

function loadData(filePath) {
  const json = loadJsonFile(filePath);

  return json[0].data;
}

function parseYmlStr(ymlStr) {
  // parse string to object
  return yaml.load(ymlStr);
}

function parseOpenApiList(list) {
  const openApiList = [];

  for (const item of list) {
    try {
      const openApi = parseYmlStr(item.yml);
      if (openApi) {
        openApiList.push(openApi);
      }
    } catch (e) {
      console.error('Error parsing OpenAPI file:', item.path);
      // console.error(e);
    }
  }

  return openApiList;
}

function constructJsonFromDir(dirPath) {

  const result = [];

  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const filePath = path.resolve(dirPath, file);
    const content = fs.readFileSync(filePath, 'utf8');
    result.push({
      path: filePath,
      yml: content,
    });
  }

  return result;
}

function customMergeOas(oasList) {

  let output = {};

  for (const oas of oasList) {
    try {
      output = _.merge(output, oas.oas);
    } catch (e) {
      console.error('Error merging OpenAPI files');
    }
  }
  return {
    output,
  };
}

function mergeApi(options) {

  const { input, output } = options;

  console.log('Input:', input);
  console.log('Output:', output);

  const isDir = fs.lstatSync(input).isDirectory();

  const list = isDir ? constructJsonFromDir(input) : loadData(input);
  const openApiList = parseOpenApiList(list);

  const openApiOptions = openApiList.map((item) => {
    return {
      oas: item,
    };
  });

  const mergeResult = customMergeOas(openApiOptions);

  if (isErrorResult(mergeResult)) {
    // Oops, something went wrong
    console.error(`${mergeResult.message} (${mergeResult.type})`);
  } else {
    console.log('Merge successful!');
  }

  // Save the merged OpenAPI document to openapi.yml
  const content = yaml.dump(mergeResult.output);
  fs.writeFileSync(output, content);
}

function splitApi(options) {
  const { input, output } = options;

  console.log('Input:', input);
  console.log('Output:', output);

  const list = loadJsonFile(input);

  if (!list) {
    console.error('Error loading OpenAPI file');
    return;
  }

  const openApiList = list[0].data.map((item) => {
    return item.yml;
  });

  if (!fs.existsSync(output)) {
    fs.mkdirSync(output);
  }

  for (const index in openApiList) {
    const key = `${index}`;
    const value = openApiList[index];

    const fileName = `${key}.yml`;
    const filePath = path.resolve(output, fileName);
    fs.writeFileSync(filePath, value);
  }

  console.log('Split successful!');
}

module.exports = {
  merge: mergeApi,
  split: splitApi,
};
