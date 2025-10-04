const _ = require('lodash');
const {
  DefaultOperationParser,
} = require('@devlikeapro/n8n-openapi-node');

const { normalizeName, normalizeDesc } = require('./utils');

class N8nOperationParser extends DefaultOperationParser {
  constructor(config) {
    super();
    this.config = config;

    this.isFiltered = config.isFiltered;
    this.allowedTags = config.tags || [];
    this.allowedOperations = config.operations || [];
    this.excludeOperations = config.excludeOperations || [];

    this.operationNameFn = typeof config.operationNameFn === 'function' ? config.operationNameFn : (x) => x;
    this.actionNameFn = typeof config.actionNameFn === 'function' ? config.actionNameFn : normalizeName;
  }

  name(operation, ctx) {
    const pattern = ctx && ctx.pattern || '';
    const { operationId, summary } = operation;
    return normalizeName(summary || operationId  || pattern, this.operationNameFn);
  }

  value(operation, ctx) {
    const pattern = ctx && ctx.pattern || '';
    const { operationId, summary } = operation;
    const name = normalizeName(summary || operationId || pattern, this.operationNameFn);

    if (!name) {
      console.log('Operation name is required', operation);
    }

    return name;
  }

  action(operation, ctx) {
    const operationName = this.name(operation);
    const path = ctx.path;
    const method = Object.keys(path)[0];
    const tags = ctx.path[method].tags;
    const tag = tags[0];
    const resourceName = normalizeName(tag, this.normalizeFn) || 'default';
    return this.actionNameFn(`${operationName} ${resourceName}`, operationName, operation);
  }

  description(operation) {
    const desc = operation.description || operation.summary;

    // remove ending dot
    return normalizeDesc(desc);
  }

  shouldSkip(operation, context) {
    // check for filtered operations
    if (this.isFiltered && !this.isOperationAllowed(operation, context)) {
      return true;
    }

    return super.shouldSkip(operation);
  }

  isOperationAllowed(operation, context) {
    const operationTags = operation.tags;

    const shouldFilterByTag = this.allowedTags.length > 0;
    const shouldFilterByOperation = this.allowedOperations.length > 0;

    // default is allowed when no filters
    let isAllowed = !shouldFilterByTag && !shouldFilterByOperation;

    const identifier = context.pattern;

    // check if operation is excluded
    for (const excludedOperation of this.excludeOperations) {
      if (excludedOperation instanceof RegExp && excludedOperation.test(identifier)) {
        return false;
      }

      if (typeof excludedOperation === 'object' && _.isMatch(operation, excludedOperation)) {
        return false;
      }

      if (excludedOperation === identifier) {
        return false;
      }
    }

    // check if operation is allowed
    for (const allowedOperation of this.allowedOperations) {
      if (allowedOperation instanceof RegExp && allowedOperation.test(identifier)) {
        isAllowed = true;
      }

      if (typeof allowedOperation === 'object' && _.isMatch(operation, allowedOperation)) {
        isAllowed = true;
      }

      if (allowedOperation === identifier) {
        isAllowed = true;
      }
    }

    if (shouldFilterByOperation && !isAllowed) {
      return false;
    }

    // check if tag is allowed
    for (const tag of this.allowedTags) {
      for (const operationTag of operationTags) {
        // filter regex
        if (tag instanceof RegExp && tag.test(operationTag)) {
          isAllowed = true;
        }
        // filter string
        if (tag === operationTag) {
          isAllowed = true;
        }
      }
    }

    return isAllowed;
  }
}

module.exports = N8nOperationParser;
