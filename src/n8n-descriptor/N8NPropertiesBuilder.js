const { N8NPropertiesBuilder: BaseN8NPropertiesBuilder } = require('@devlikeapro/n8n-openapi-node');

class N8NPropertiesBuilder extends BaseN8NPropertiesBuilder {
  constructor (doc, config) {
    super(doc, config);
  }

  build () {
    return super.build();
  }
}

module.exports = N8NPropertiesBuilder;
