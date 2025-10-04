const { DefaultResourceParser }: any = require('@devlikeapro/n8n-openapi-node');
import { normalizeName } from './utils';

export default class N8NResourceParser extends DefaultResourceParser {
  private config: any;
  private isFiltered: boolean;
  private tags: any[];
  private resourceNameFn: (x: string) => string;

  constructor(config: any) {
    super();
    this.config = config;
    this.isFiltered = config.isFiltered;
    this.tags = config.tags;
    this.resourceNameFn = typeof config.resourceNameFn === 'function' ? config.resourceNameFn : normalizeName;
  }

  name(resource: any) {
    const { name } = resource;
    return this.resourceNameFn(name);
  }

  value(resource: any) {
    return this.name(resource);
  }

  shouldSkip(resource: any) {
    if (this.isFiltered && !this.isResourceAllowed(resource)) {
      return true;
    }
    return false;
  }

  shouldSkipOperation(operation: any) {
    if (!this.isFiltered) {
      return false;
    }
    const tags = (operation.tags || []).map((tag: string) => ({ name: tag }));
    for (const tag of tags) {
      if (this.isResourceAllowed(tag)) {
        return false;
      }
    }
    return true;
  }

  isResourceAllowed(resource: any) {
    const resourceTag = resource.name;
    for (const tag of this.tags) {
      if (tag instanceof RegExp && tag.test(resourceTag)) return true;
      if (tag === resourceTag) return true;
    }
    return false;
  }
}
