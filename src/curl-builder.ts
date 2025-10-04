const CONTENT_TYPE_HEADER = 'Content-Type';

const curlBuilder = (operation: any, operationName: string, pathName: string) => {
  if (operation.requestBody && operation.requestBody.content) {
    return Object.keys(operation.requestBody.content)
      .map((content) =>
        generateBodyBashPerContentType(
          operation,
          operationName,
          pathName,
          content,
          operation.requestBody.content[content].schema.generatedExample ||
            operation.requestBody.content[content].schema.example,
        ),
      )
      .join('\n');
  }
  return generateBodyCurl(operation, operationName, pathName);
};

function generateBodyCurl(operation: any, operationName: string, pathName: string) {
  let builder = new CurlBuilder(operationName, pathName, operation.pathParams as any);
  if (operation.headers) {
    builder = builder.withHeaders(operation.headers);
  }
  return builder.build();
}

function generateBodyBashPerContentType(
  operation: any,
  operationName: string,
  pathName: string,
  contentType: string,
  requestBody: any,
) {
  let builder = new CurlBuilder(operationName, pathName, operation.pathParams, operation.queryParams)
    .withContentTypeCurlHeader(contentType)
    .withContentTypeHeader(contentType)
    .withRequestBody(requestBody);
  if (operation.headers) {
    builder = builder.withHeaders(operation.headers);
  }
  return builder.build();
}

class CurlBuilder {
  private headers: string[];
  private body: string;
  private curl: string;

  constructor(operationName: string, pathName: string, pathParams?: any[], queryParams?: any[]) {
    let query = '';
    if (queryParams) {
      query = `?${queryParams.map((q: any) => `${q.name}=${q.example || q.name}`).join('&')}`;
    }
    if (pathParams) {
      pathParams.forEach((p: any) => {
        pathName = pathName.replace(`{${p.name}}`, p.example || p.name);
      });
    }
    this.headers = [];
    this.body = '';
    this.curl = `curl -X "${operationName.toUpperCase()}" "${pathName}${query}"`;
  }

  withContentTypeCurlHeader(contentType: string) {
    this.curl = `# ${contentType} \n${this.curl}`;
    return this;
  }

  withContentTypeHeader(contentType: string) {
    this.headers.push(`-H '${CONTENT_TYPE_HEADER}: ${contentType}'`);
    return this;
  }

  withHeaders(headers: any[]) {
    this.headers.push(...headers.map((h) => `-H '${h.name}: ${h.example || h.name}'`));
    return this;
  }

  withRequestBody(requestBody: any) {
    this.body += `-d $'{${JSON.stringify(requestBody)}}`;
    return this;
  }

  build() {
    let script = this.curl;
    if (this.headers.length !== 0) {
      script += `\n${this.headers.join('\n')}`;
    }
    if (this.body.length !== 0) {
      script += `\n${this.body}`;
    }
    return script.substr(0, script.length - 1);
  }
}

export default curlBuilder;
