import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import YAML from 'js-yaml';
import RefParser from 'json-schema-ref-parser-alt';

const handleHTTPResponse = (url: string, res: any, resolve: (data: string) => void, reject: (err: any) => void) => {
  if ((res.statusCode || 0) >= 400) return reject(`Can't get file ${url}`);
  res.setEncoding('utf8');
  let rawData = '';
  res.on('data', (chunk) => { rawData += chunk; });
  res.on('end', () => { resolve(rawData); });
  res.on('error', reject);
};

function getContentFromURL(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (url.startsWith('http:')) {
      http.get(url, (res) => {
        handleHTTPResponse(url, res, resolve, reject);
      }).on('error', reject);
    } else if (url.startsWith('https:')) {
      https.get(url, (res) => {
        handleHTTPResponse(url, res, resolve, reject);
      }).on('error', reject);
    } else {
      reject('Protocol not supported.');
    }
  });
}

function getFileContent(filePath: string): Promise<Buffer | string> {
  return new Promise((resolve, reject) => {
    fs.readFile(path.resolve(__dirname, filePath), (err, content) => {
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

function parseContent(content: Buffer | string): any {
  const str = content.toString();
  try {
    return JSON.parse(str);
  } catch (e) {
    return YAML.load(str);
  }
}

async function dereference(json: any, baseDir: string) {
  return (RefParser as any).dereference(`${baseDir}/`, json, {
    dereference: { circular: 'ignore' }
  });
}

async function bundle(json: any) {
  return (RefParser as any).bundle(json, {
    dereference: { circular: 'ignore' }
  });
}

export default async function bundler(filePath: string, baseDir: string) {
  let content: any, parsedContent: any, dereferencedJSON: any, bundledJSON: any;
  try {
    content = await getFileContent(filePath);
  } catch (e) {
    console.error('Can not load the content of the Swagger specification file');
    console.error(e);
    return;
  }

  try {
    parsedContent = parseContent(content);
  } catch (e) {
    console.error('Can not parse the content of the Swagger specification file');
    console.error(e);
    return;
  }

  try {
    dereferencedJSON = await dereference(parsedContent, baseDir);
  } catch (e) {
    console.error('Can not dereference the JSON obtained from the content of the Swagger specification file');
    console.error(e);
    return;
  }

  try {
    bundledJSON = await bundle(dereferencedJSON);
  } catch (e) {
    console.error('Can not bundle the JSON obtained from the content of the Swagger specification file');
    console.error(e);
    return;
  }

  return JSON.parse(JSON.stringify(bundledJSON));
}
