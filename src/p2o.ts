import p2s from 'postman-to-swagger';
import fs from 'fs';
import postmanJson from '../tests/postman/lark.json';

const swaggerJson = p2s(postmanJson as any, {
  target_spec: 'swagger2.0',
  info: { version: 'v1' },
} as any);

const output = JSON.stringify(swaggerJson, null, 2);
fs.writeFileSync('swagger.yaml', output, 'utf8');

