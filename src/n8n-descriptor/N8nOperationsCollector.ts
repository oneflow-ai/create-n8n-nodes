const { OperationsCollector: BaseOperationsCollector }: any = require('@devlikeapro/n8n-openapi-node');
import * as _ from 'lodash';
import { modifyNodeProperties } from './n8n-properties';

export default class N8nOperationsCollector extends BaseOperationsCollector {
  constructor(doc: any, operationParser: any, resourceParser: any, logger: any) {
    super(doc, operationParser, resourceParser, logger);
    // @ts-ignore
    this.n8nNodeProperties = modifyNodeProperties(this.n8nNodeProperties);
  }

  visitOperation(operation: any, context: any) {
    return super.visitOperation(operation, context);
  }

  isOperationResposeBinary(operation: any) {
    const { responses } = operation;
    if (!responses) return false;
    for (const response of Object.values(responses as any)) {
      const { content } = response as any;
      if (!content) continue;
      const binariesContentTypes = [new RegExp('image/*'), new RegExp('audio/*'), new RegExp('video/*'), new RegExp('application/*')];
      const nonBinaryContentTypes = [
        new RegExp('application/json'),
        new RegExp('application/xml'),
        new RegExp('application/x-www-form-urlencoded'),
        new RegExp('multipart/form-data'),
        new RegExp('text/*'),
      ];
      for (const contntType of Object.keys(content)) {
        for (const nonBinaryContentType of nonBinaryContentTypes) {
          if (nonBinaryContentType.test(contntType)) return false;
        }
        for (const binaryContentType of binariesContentTypes) {
          if (binaryContentType.test(contntType)) return true;
        }
      }
    }
    return false;
  }

  isOperationResposeText(operation: any) {
    const { responses } = operation;
    if (!responses) return false;
    for (const response of Object.values(responses as any)) {
      const { content } = response as any;
      if (!content) continue;
      const textContentTypes = [new RegExp('text/*')];
      for (const contntType of Object.keys(content)) {
        for (const textContentType of textContentTypes) {
          if (textContentType.test(contntType)) return true;
        }
      }
    }
    return false;
  }

  isOperationResposeJson(operation: any) {
    const { responses } = operation;
    if (!responses) return false;
    for (const response of Object.values(responses as any)) {
      const { content } = response as any;
      if (!content) continue;
      const jsonContentTypes = [new RegExp('^application/json.*')];
      for (const contntType of Object.keys(content)) {
        for (const jsonContentType of jsonContentTypes) {
          if (jsonContentType.test(contntType)) return true;
        }
      }
    }
    return false;
  }

  parseOperation(operation: any, context: any) {
    const { option, fields } = super.parseOperation(operation, context);
    const isBinaryResponse = this.isOperationResposeBinary(operation);
    const isTextResponse = this.isOperationResposeText(operation);
    const isJsonResponse = this.isOperationResposeJson(operation);
    if (isBinaryResponse) {
      _.set(option, 'routing.request.encoding', 'arraybuffer');
      _.set(option, 'routing.output.postReceive', [
        {
          type: 'binaryData',
          properties: {
            destinationProperty: 'data',
          },
        },
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
    return { option, fields };
  }

  extractExample(operation: any, context: any) {
    try {
      // @ts-ignore
      return this.n8nNodeProperties.extractBodyExample(operation.requestBody, context);
    } catch (error) {
      return {};
    }
  }

  parseFields(operation: any, context: any) {
    const fields = super.parseFields(operation, context);
    const customBodyFields: any[] = [];
    if (operation.requestBody && operation.requestBody.content) {
      const examole = this.extractExample(operation, context);
      customBodyFields.push({
        displayName: 'Custom Body',
        name: 'customBody',
        type: 'json',
        default: JSON.stringify(examole, null, 2),
        description: 'Custom body to send',
        routing: {
          request: { body: { customBody: '={{JSON.parse($value)}}' } },
          send: { preSend: ['${helpers.hooks.preSendActionCustonBody}'] },
        },
        displayOptions: { show: { useCustomBody: [true] } },
      });
    }
    fields.push(...customBodyFields);
    const sortedFields = this.sortProperties(fields);
    return sortedFields;
  }

  sortProperties(properties: any[]) {
    const propertiesOrder = _.get(this as any, 'operationParser.config.propertiesOrder', [] as any[]) as any[];
    if (propertiesOrder.length === 0) {
      return properties;
    }
    const ordersMap = propertiesOrder.reduce((acc: Record<string, number>, keyOrEntry: any, i: number) => {
      const name = _.isString(keyOrEntry) ? keyOrEntry : keyOrEntry[0];
      const index = _.isString(keyOrEntry) ? i : keyOrEntry[1];
      const finalIndex = index < -1 ? 99999 + Math.abs(index) : index;
      acc[name] = finalIndex;
      return acc;
    }, {} as Record<string, number>);
    return properties.sort((a, b) => {
      const indexA = ordersMap[a.name] || -1;
      const indexB = ordersMap[b.name] || -1;
      return indexA - indexB;
    });
  }

  addDisplayOption(fields: any[], resource: string, operation: string) {
    fields.forEach((field) => {
      field.displayOptions = _.defaultsDeep(field.displayOptions, {
        show: { resource: [resource], operation: [operation] },
      });
    });
  }
}
