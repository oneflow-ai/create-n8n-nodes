const p2s = require('postman-to-swagger');
const fs = require('fs');
const postmanJson = require('../tests/postman/lark.json');

const swaggerJson = p2s(postmanJson, {
  target_spec: 'swagger2.0',
  info: {
    version: 'v1',
  },
});

//let output = JSON.stringify(swaggerJson, null, 2)
const output = JSON.stringify(swaggerJson, null, 2);

// Save to file
fs.writeFileSync('swagger.yaml', output, 'utf8');
