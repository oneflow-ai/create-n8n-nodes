"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { DefaultResourceParser } = require('@devlikeapro/n8n-openapi-node');
const utils_1 = require("./utils");
class N8NResourceParser extends DefaultResourceParser {
    constructor(config) {
        super();
        this.config = config;
        this.isFiltered = config.isFiltered;
        this.tags = config.tags;
        this.resourceNameFn = typeof config.resourceNameFn === 'function' ? config.resourceNameFn : utils_1.normalizeName;
    }
    name(resource) {
        const { name } = resource;
        return this.resourceNameFn(name);
    }
    value(resource) {
        return this.name(resource);
    }
    shouldSkip(resource) {
        if (this.isFiltered && !this.isResourceAllowed(resource)) {
            return true;
        }
        return false;
    }
    shouldSkipOperation(operation) {
        if (!this.isFiltered) {
            return false;
        }
        const tags = (operation.tags || []).map((tag) => ({ name: tag }));
        for (const tag of tags) {
            if (this.isResourceAllowed(tag)) {
                return false;
            }
        }
        return true;
    }
    isResourceAllowed(resource) {
        const resourceTag = resource.name;
        for (const tag of this.tags) {
            if (tag instanceof RegExp && tag.test(resourceTag))
                return true;
            if (tag === resourceTag)
                return true;
        }
        return false;
    }
}
exports.default = N8NResourceParser;
