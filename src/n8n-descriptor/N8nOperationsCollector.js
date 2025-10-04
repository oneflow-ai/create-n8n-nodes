const { OperationsCollector } = require('@devlikeapro/n8n-openapi-node');
const _ = require('lodash');
const { modifyNodeProperties } = require('./n8n-properties');

class N8nOperationsCollector extends OperationsCollector {
  constructor(doc, operationParser, resourceParser, logger) {
    super(doc, operationParser, resourceParser, logger);
    this.n8nNodeProperties = modifyNodeProperties(this.n8nNodeProperties);
  }

  visitOperation(operation, context) {
    return super.visitOperation(operation, context);
  }

  isOperationResposeBinary(operation) {
    const { responses } = operation;

    if (!responses) {
      return false;
    }

    for (const response of Object.values(responses)) {
      const { content } = response;

      if (!content) {
        continue;
      }

      const binariesContentTypes = [
        new RegExp('image/*'),
        new RegExp('audio/*'),
        new RegExp('video/*'),
        new RegExp('application/*'),
      ];

      const nonBinaryContentTypes = [
        new RegExp('application/json'),
        new RegExp('application/xml'),
        new RegExp('application/x-www-form-urlencoded'),
        new RegExp('multipart/form-data'),
        new RegExp('text/*'),
      ];

      for (const contntType of Object.keys(content)) {
        for (const nonBinaryContentType of nonBinaryContentTypes) {
          if (nonBinaryContentType.test(contntType)) {
            return false;
          }
        }

        for (const binaryContentType of binariesContentTypes) {
          if (binaryContentType.test(contntType)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  isOperationResposeText(operation) {
    const { responses } = operation;

    if (!responses) {
      return false;
    }

    for (const response of Object.values(responses)) {
      const { content } = response;

      if (!content) {
        continue;
      }

      const textContentTypes = [
        new RegExp('text/*'),
      ];

      for (const contntType of Object.keys(content)) {
        for (const textContentType of textContentTypes) {
          if (textContentType.test(contntType)) {
            return true;
          }
        }
      }
    }

    return false
  }

  isOperationResposeJson(operation) {
    const { responses } = operation;

    if (!responses) {
      return false;
    }

    for (const response of Object.values(responses)) {
      const { content } = response;

      if (!content) {
        continue;
      }

      const jsonContentTypes = [
        // application/json, application/json api, application/json; charset=utf-8
        // any string starts with application/json
        new RegExp('^application/json.*'),
      ];

      for (const contntType of Object.keys(content)) {
        for (const jsonContentType of jsonContentTypes) {
          if (jsonContentType.test(contntType)) {
            return true;
          }
        }
      }
    }

    return false
  }

  parseOperation(operation, context) {
    const { option, fields } = super.parseOperation(operation, context);

    // check for binary response
    const isBinaryResponse = this.isOperationResposeBinary(operation, context);
    const isTextResponse = this.isOperationResposeText(operation, context);
    const isJsonResponse = this.isOperationResposeJson(operation, context);

    if (isBinaryResponse) {
      // request option for binary response
      // encoding?: 'arraybuffer' | 'blob' | 'document' | 'json' | 'text' | 'stream';
      _.set(option, 'routing.request.encoding', 'arraybuffer');

      // postReceive hook for binary response
      _.set(option, 'routing.output.postReceive', [
        {
          type: 'binaryData',
          properties: {
            destinationProperty: 'data',
          },
        }
      ]);
    } else if (isTextResponse || !isJsonResponse) {
      _.set(option, 'routing.output.postReceive', [
        {
          type: 'setKeyValue',
          properties: {
            data: '={{$response.body}}',
          },
        },
      ]);
    }

    return {
      option,
      fields,
    };
  }

  extractExample(operation, context) {
    try {
      return this.n8nNodeProperties.extractBodyExample(
        operation.requestBody,
        context
      );
    } catch (error) {
      return {};
    }
  }

  parseFields(operation, context) {
    const fields = super.parseFields(operation, context);

    // Add fields for custom body
    const customBodyFields = [];
    if (operation.requestBody && operation.requestBody.content) {
      const examole = this.extractExample(operation, context);

      customBodyFields.push({
        displayName: 'Custom Body',
        name: 'customBody',
        type: 'json',
        default: JSON.stringify(examole, null, 2),
        description: 'Custom body to send',
        routing: {
          request: {
            body: {
              customBody: '={{JSON.parse($value)}}',
            }
          },
          send: {
            preSend: ['${helpers.hooks.preSendActionCustonBody}'],
          },
        },
        displayOptions: {
          show: {
            useCustomBody: [true],
          },
        },
      });
    }

    fields.push(...customBodyFields);

    const sortedFields = this.sortProperties(fields);

    return sortedFields;
  }

  sortProperties(properties) {
    const propertiesOrder = _.get(this, 'operationParser.config.propertiesOrder', []);

    if (propertiesOrder.length === 0) {
      return properties;
    }

    const ordersMap = propertiesOrder.reduce((acc, keyOrEntry, i) => {
      const name = _.isString(keyOrEntry) ? keyOrEntry : keyOrEntry[0];
      const index = _.isString(keyOrEntry) ? i : keyOrEntry[1];

      // if index < -1 then set it to 99999 + abs(index)
      // in order to sort it at the end

      const finalIndex = index < -1 ? 99999 + Math.abs(index) : index;

      acc[name] = finalIndex;
      return acc;
    }, {});

    return properties.sort((a, b) => {
      const indexA = ordersMap[a.name] || -1;
      const indexB = ordersMap[b.name] || -1;

      return indexA - indexB;
    });
  }

  addDisplayOption(fields, resource, operation) {
    fields.forEach((field) => {
      field.displayOptions = _.defaultsDeep(field.displayOptions, {
        show: {
          resource: [resource],
          operation: [operation],
        },
      });
    });
  }
}

module.exports = N8nOperationsCollector;
