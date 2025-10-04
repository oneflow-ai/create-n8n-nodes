// const OpenAPISampler = require('openapi-sampler');
// const slugg = require('slugg');
// const curlGenerator = require('./curl-builder');
const SwaggerParser = require('@apidevtools/swagger-parser');

module.exports = async (openapi) => {
  openapi.basePath = openapi.basePath || '';
  openapi.info = openapi.info || {};

  const schema = await SwaggerParser.parse(openapi);

  return schema;
};
