"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = __importDefault(require("lodash"));
// Avoid strict type coupling to upstream types
const { DefaultOperationParser } = require('@devlikeapro/n8n-openapi-node');
const utils_1 = require("./utils");
class N8nOperationParser extends DefaultOperationParser {
    constructor(config) {
        super();
        this.config = config;
        this.isFiltered = config.isFiltered;
        this.allowedTags = config.tags || [];
        this.allowedOperations = config.operations || [];
        this.excludeOperations = config.excludeOperations || [];
        this.operationNameFn = typeof config.operationNameFn === 'function' ? config.operationNameFn : (x) => x;
        this.actionNameFn = typeof config.actionNameFn === 'function' ? config.actionNameFn : utils_1.normalizeName;
    }
    name(operation, ctx) {
        const pattern = (ctx && ctx.pattern) || '';
        const { operationId, summary } = operation;
        return (0, utils_1.normalizeName)(summary || operationId || pattern, this.operationNameFn);
    }
    value(operation, ctx) {
        const pattern = (ctx && ctx.pattern) || '';
        const { operationId, summary } = operation;
        const name = (0, utils_1.normalizeName)(summary || operationId || pattern, this.operationNameFn);
        if (!name) {
            // eslint-disable-next-line no-console
            console.log('Operation name is required', operation);
        }
        return name;
    }
    action(operation, ctx) {
        const operationName = this.name(operation);
        const path = ctx.path;
        const method = Object.keys(path)[0];
        const tags = path[method].tags;
        const tag = tags[0];
        const resourceName = (0, utils_1.normalizeName)(tag, this.normalizeFn) || 'default';
        return this.actionNameFn(`${operationName} ${resourceName}`, operationName, operation);
    }
    description(operation) {
        const desc = operation.description || operation.summary;
        return (0, utils_1.normalizeDesc)(desc);
    }
    shouldSkip(operation, context) {
        if (this.isFiltered && !this.isOperationAllowed(operation, context)) {
            return true;
        }
        return super.shouldSkip(operation);
    }
    isOperationAllowed(operation, context) {
        const operationTags = operation.tags;
        const shouldFilterByTag = this.allowedTags.length > 0;
        const shouldFilterByOperation = this.allowedOperations.length > 0;
        let isAllowed = !shouldFilterByTag && !shouldFilterByOperation;
        const identifier = context.pattern;
        for (const excludedOperation of this.excludeOperations) {
            if (excludedOperation instanceof RegExp && excludedOperation.test(identifier))
                return false;
            if (typeof excludedOperation === 'object' && lodash_1.default.isMatch(operation, excludedOperation))
                return false;
            if (excludedOperation === identifier)
                return false;
        }
        for (const allowedOperation of this.allowedOperations) {
            if (allowedOperation instanceof RegExp && allowedOperation.test(identifier))
                isAllowed = true;
            if (typeof allowedOperation === 'object' && lodash_1.default.isMatch(operation, allowedOperation))
                isAllowed = true;
            if (allowedOperation === identifier)
                isAllowed = true;
        }
        if (shouldFilterByOperation && !isAllowed)
            return false;
        for (const tag of this.allowedTags) {
            for (const operationTag of operationTags) {
                if (tag instanceof RegExp && tag.test(operationTag))
                    isAllowed = true;
                if (tag === operationTag)
                    isAllowed = true;
            }
        }
        return isAllowed;
    }
}
exports.default = N8nOperationParser;
