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
exports.split = exports.merge = void 0;
const openapi_merge_1 = require("openapi-merge");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const js_yaml_1 = __importDefault(require("js-yaml"));
const _ = __importStar(require("lodash"));
function loadJsonFile(filePath) {
    const content = fs_1.default.readFileSync(filePath, 'utf8');
    const json = JSON.parse(content);
    return json;
}
function loadData(filePath) {
    const json = loadJsonFile(filePath);
    return json[0].data;
}
function parseYmlStr(ymlStr) {
    return js_yaml_1.default.load(ymlStr);
}
function parseOpenApiList(list) {
    const openApiList = [];
    for (const item of list) {
        try {
            const openApi = parseYmlStr(item.yml);
            if (openApi) {
                openApiList.push(openApi);
            }
        }
        catch (e) {
            console.error('Error parsing OpenAPI file:', item.path);
        }
    }
    return openApiList;
}
function constructJsonFromDir(dirPath) {
    const result = [];
    const files = fs_1.default.readdirSync(dirPath);
    for (const file of files) {
        const filePath = path_1.default.resolve(dirPath, file);
        const content = fs_1.default.readFileSync(filePath, 'utf8');
        result.push({ path: filePath, yml: content });
    }
    return result;
}
function customMergeOas(oasList) {
    let output = {};
    for (const oas of oasList) {
        try {
            output = _.merge(output, oas.oas);
        }
        catch (e) {
            console.error('Error merging OpenAPI files');
        }
    }
    return { output };
}
function mergeApi(options) {
    const { input, output } = options;
    console.log('Input:', input);
    console.log('Output:', output);
    const isDir = fs_1.default.lstatSync(input).isDirectory();
    const list = isDir ? constructJsonFromDir(input) : loadData(input);
    const openApiList = parseOpenApiList(list);
    const openApiOptions = openApiList.map((item) => ({ oas: item }));
    const mergeResult = customMergeOas(openApiOptions);
    if ((0, openapi_merge_1.isErrorResult)(mergeResult)) {
        console.error(`${mergeResult.message} (${mergeResult.type})`);
    }
    else {
        console.log('Merge successful!');
    }
    const content = js_yaml_1.default.dump(mergeResult.output);
    fs_1.default.writeFileSync(output, content);
}
exports.merge = mergeApi;
function splitApi(options) {
    const { input, output } = options;
    console.log('Input:', input);
    console.log('Output:', output);
    const list = loadJsonFile(input);
    if (!list) {
        console.error('Error loading OpenAPI file');
        return;
    }
    const openApiList = list[0].data.map((item) => item.yml);
    if (!fs_1.default.existsSync(output)) {
        fs_1.default.mkdirSync(output);
    }
    for (const index in openApiList) {
        const key = `${index}`;
        const value = openApiList[index];
        const fileName = `${key}.yml`;
        const filePath = path_1.default.resolve(output, fileName);
        fs_1.default.writeFileSync(filePath, value);
    }
    console.log('Split successful!');
}
exports.split = splitApi;
