import SwaggerParser from '@apidevtools/swagger-parser';

export default async (openapi: any) => {
  openapi.basePath = openapi.basePath || '';
  openapi.info = openapi.info || {};

  const schema = await (SwaggerParser as any).parse(openapi);
  return schema;
};

