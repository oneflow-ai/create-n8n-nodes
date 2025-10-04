import { merge as mergeOpenapi, isErrorResult } from 'openapi-merge';
import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';
import * as _ from 'lodash';

function loadJsonFile(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf8');
  const json = JSON.parse(content);
  return json;
}

function loadData(filePath: string) {
  const json = loadJsonFile(filePath);
  return json[0].data;
}

function parseYmlStr(ymlStr: string) {
  return yaml.load(ymlStr) as any;
}

function parseOpenApiList(list: Array<{ path: string; yml: string }>) {
  const openApiList: any[] = [];
  for (const item of list) {
    try {
      const openApi = parseYmlStr(item.yml);
      if (openApi) {
        openApiList.push(openApi);
      }
    } catch (e) {
      console.error('Error parsing OpenAPI file:', item.path);
    }
  }
  return openApiList;
}

function constructJsonFromDir(dirPath: string) {
  const result: Array<{ path: string; yml: string }> = [];
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const filePath = path.resolve(dirPath, file);
    const content = fs.readFileSync(filePath, 'utf8');
    result.push({ path: filePath, yml: content });
  }
  return result;
}

function customMergeOas(oasList: any[]) {
  let output: any = {};
  for (const oas of oasList) {
    try {
      output = _.merge(output, oas.oas);
    } catch (e) {
      console.error('Error merging OpenAPI files');
    }
  }
  return { output } as any;
}

function mergeApi(options: { input: string; output: string }) {
  const { input, output } = options;
  console.log('Input:', input);
  console.log('Output:', output);

  const isDir = fs.lstatSync(input).isDirectory();
  const list = isDir ? constructJsonFromDir(input) : loadData(input);
  const openApiList = parseOpenApiList(list as any);

  const openApiOptions = openApiList.map((item: any) => ({ oas: item }));
  const mergeResult = customMergeOas(openApiOptions);

  if (isErrorResult(mergeResult as any)) {
    console.error(`${(mergeResult as any).message} (${(mergeResult as any).type})`);
  } else {
    console.log('Merge successful!');
  }

  const content = yaml.dump((mergeResult as any).output);
  fs.writeFileSync(output, content);
}

function splitApi(options: { input: string; output: string }) {
  const { input, output } = options;
  console.log('Input:', input);
  console.log('Output:', output);

  const list = loadJsonFile(input);
  if (!list) {
    console.error('Error loading OpenAPI file');
    return;
  }

  const openApiList = list[0].data.map((item: any) => item.yml);
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

export { mergeApi as merge, splitApi as split };
