"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const js_yaml_1 = __importDefault(require("js-yaml"));
const json_schema_ref_parser_alt_1 = __importDefault(require("json-schema-ref-parser-alt"));
const handleHTTPResponse = (url, res, resolve, reject) => {
    if ((res.statusCode || 0) >= 400)
        return reject(`Can't get file ${url}`);
    res.setEncoding('utf8');
    let rawData = '';
    res.on('data', (chunk) => { rawData += chunk; });
    res.on('end', () => { resolve(rawData); });
    res.on('error', reject);
};
function getContentFromURL(url) {
    return new Promise((resolve, reject) => {
        if (url.startsWith('http:')) {
            http_1.default.get(url, (res) => {
                handleHTTPResponse(url, res, resolve, reject);
            }).on('error', reject);
        }
        else if (url.startsWith('https:')) {
            https_1.default.get(url, (res) => {
                handleHTTPResponse(url, res, resolve, reject);
            }).on('error', reject);
        }
        else {
            reject('Protocol not supported.');
        }
    });
}
function getFileContent(filePath) {
    return new Promise((resolve, reject) => {
        fs_1.default.readFile(path_1.default.resolve(__dirname, filePath), (err, content) => {
            if (err) {
                getContentFromURL(filePath)
                    .catch(reject)
                    .then((content) => content && resolve(content));
                return;
            }
            resolve(content);
        });
    });
}
function parseContent(content) {
    const str = content.toString();
    try {
        return JSON.parse(str);
    }
    catch (e) {
        return js_yaml_1.default.load(str);
    }
}
async function dereference(json, baseDir) {
    return json_schema_ref_parser_alt_1.default.dereference(`${baseDir}/`, json, {
        dereference: { circular: 'ignore' }
    });
}
async function bundle(json) {
    return json_schema_ref_parser_alt_1.default.bundle(json, {
        dereference: { circular: 'ignore' }
    });
}
async function bundler(filePath, baseDir) {
    let content, parsedContent, dereferencedJSON, bundledJSON;
    try {
        content = await getFileContent(filePath);
    }
    catch (e) {
        console.error('Can not load the content of the Swagger specification file');
        console.error(e);
        return;
    }
    try {
        parsedContent = parseContent(content);
    }
    catch (e) {
        console.error('Can not parse the content of the Swagger specification file');
        console.error(e);
        return;
    }
    try {
        dereferencedJSON = await dereference(parsedContent, baseDir);
    }
    catch (e) {
        console.error('Can not dereference the JSON obtained from the content of the Swagger specification file');
        console.error(e);
        return;
    }
    try {
        bundledJSON = await bundle(dereferencedJSON);
    }
    catch (e) {
        console.error('Can not bundle the JSON obtained from the content of the Swagger specification file');
        console.error(e);
        return;
    }
    return JSON.parse(JSON.stringify(bundledJSON));
}
exports.default = bundler;
