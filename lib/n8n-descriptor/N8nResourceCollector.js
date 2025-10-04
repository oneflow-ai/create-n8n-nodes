"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { ResourceCollector: BaseResourceCollector } = require('@devlikeapro/n8n-openapi-node');
class N8nResourceCollector extends BaseResourceCollector {
    visitTag(tag) {
        if (this.resourceParser.shouldSkip(tag)) {
            return;
        }
        const name = this.resourceParser.name(tag);
        const description = this.resourceParser.description(tag);
        super.visitTag({ name, description });
    }
    addTagByName(tag) {
        const name = this.resourceParser.name({ name: tag });
        if (!this.tags.has(name)) {
            this.tags.set(name, { name, description: '' });
        }
    }
    visitOperation(operation, context) {
        if (this.resourceParser.shouldSkipOperation(operation)) {
            return;
        }
        super.visitOperation(operation, context);
    }
}
exports.default = N8nResourceCollector;
