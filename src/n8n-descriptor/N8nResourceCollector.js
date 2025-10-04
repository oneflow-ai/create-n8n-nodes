const {
  ResourceCollector,
} = require('@devlikeapro/n8n-openapi-node');

class N8nResourceCollector extends ResourceCollector {
  visitTag (tag) {
    if (this.resourceParser.shouldSkip(tag)) {
      return;
    }

    const name = this.resourceParser.name(tag);
    const description = this.resourceParser.description(tag);

    super.visitTag({ name, description });
  }

  addTagByName (tag) {
    // console.log('addTagByName', tag);
    const name = this.resourceParser.name({ name: tag });

    // insert if not found
    if (!this.tags.has(name)) {
      this.tags.set(name, {
        name,
        description: '',
      });
    }

    // console.log('addTagByName', this.tags);
  }

  visitOperation (operation, context) {
    if (this.resourceParser.shouldSkipOperation(operation)) {
      return;
    }
    super.visitOperation(operation, context);
  }
}

module.exports = N8nResourceCollector;
