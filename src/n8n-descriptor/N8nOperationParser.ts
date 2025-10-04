import _ from 'lodash';
// Avoid strict type coupling to upstream types
const { DefaultOperationParser }: any = require('@devlikeapro/n8n-openapi-node');
import { normalizeName, normalizeDesc } from './utils';

export default class N8nOperationParser extends DefaultOperationParser {
  private config: any;
  private isFiltered: boolean;
  private allowedTags: any[];
  private allowedOperations: any[];
  private excludeOperations: any[];
  private operationNameFn: (x: string) => string;
  private actionNameFn: (x: string, y: string, z: any) => string;

  constructor(config: any) {
    super();
    this.config = config;
    this.isFiltered = config.isFiltered;
    this.allowedTags = config.tags || [];
    this.allowedOperations = config.operations || [];
    this.excludeOperations = config.excludeOperations || [];
    this.operationNameFn = typeof config.operationNameFn === 'function' ? config.operationNameFn : (x: string) => x;
    this.actionNameFn = typeof config.actionNameFn === 'function' ? config.actionNameFn : normalizeName;
  }

  name(operation: any, ctx?: any) {
    const pattern = (ctx && ctx.pattern) || '';
    const { operationId, summary } = operation;
    return normalizeName(summary || operationId || pattern, this.operationNameFn);
  }

  value(operation: any, ctx?: any) {
    const pattern = (ctx && ctx.pattern) || '';
    const { operationId, summary } = operation;
    const name = normalizeName(summary || operationId || pattern, this.operationNameFn);
    if (!name) {
      // eslint-disable-next-line no-console
      console.log('Operation name is required', operation);
    }
    return name;
  }

  action(operation: any, ctx: any) {
    const operationName = this.name(operation);
    const path = ctx.path;
    const method = Object.keys(path)[0];
    const tags = path[method].tags;
    const tag = tags[0];
    const resourceName = normalizeName(tag, (this as any).normalizeFn) || 'default';
    return this.actionNameFn(`${operationName} ${resourceName}`, operationName, operation);
  }

  description(operation: any) {
    const desc = operation.description || operation.summary;
    return normalizeDesc(desc);
  }

  shouldSkip(operation: any, context: any) {
    if (this.isFiltered && !this.isOperationAllowed(operation, context)) {
      return true;
    }
    return super.shouldSkip(operation);
  }

  isOperationAllowed(operation: any, context: any) {
    const operationTags = operation.tags;

    const shouldFilterByTag = this.allowedTags.length > 0;
    const shouldFilterByOperation = this.allowedOperations.length > 0;
    let isAllowed = !shouldFilterByTag && !shouldFilterByOperation;
    const identifier = context.pattern;

    for (const excludedOperation of this.excludeOperations) {
      if (excludedOperation instanceof RegExp && excludedOperation.test(identifier)) return false;
      if (typeof excludedOperation === 'object' && _.isMatch(operation, excludedOperation)) return false;
      if (excludedOperation === identifier) return false;
    }

    for (const allowedOperation of this.allowedOperations) {
      if (allowedOperation instanceof RegExp && allowedOperation.test(identifier)) isAllowed = true;
      if (typeof allowedOperation === 'object' && _.isMatch(operation, allowedOperation)) isAllowed = true;
      if (allowedOperation === identifier) isAllowed = true;
    }

    if (shouldFilterByOperation && !isAllowed) return false;

    for (const tag of this.allowedTags) {
      for (const operationTag of operationTags) {
        if (tag instanceof RegExp && tag.test(operationTag)) isAllowed = true;
        if (tag === operationTag) isAllowed = true;
      }
    }
    return isAllowed;
  }
}
