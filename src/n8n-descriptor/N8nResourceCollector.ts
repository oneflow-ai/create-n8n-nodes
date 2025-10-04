const { ResourceCollector: BaseResourceCollector }: any = require('@devlikeapro/n8n-openapi-node');

export default class N8nResourceCollector extends BaseResourceCollector {
  visitTag(tag: any) {
    if (this.resourceParser.shouldSkip(tag)) {
      return;
    }
    const name = this.resourceParser.name(tag);
    const description = this.resourceParser.description(tag);
    super.visitTag({ name, description });
  }

  addTagByName(tag: string) {
    const name = this.resourceParser.name({ name: tag });
    if (!(this as any).tags.has(name)) {
      (this as any).tags.set(name, { name, description: '' });
    }
  }

  visitOperation(operation: any, context: any) {
    if ((this as any).resourceParser.shouldSkipOperation(operation)) {
      return;
    }
    super.visitOperation(operation, context);
  }
}
