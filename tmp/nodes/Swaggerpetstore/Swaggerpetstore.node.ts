import { INodeType, INodeTypeDescription } from 'n8n-workflow'
import { properties } from './Swaggerpetstore.properties'
import { methods } from './Swaggerpetstore.methods'

export class Swaggerpetstore implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Swaggerpetstore',
    name: 'swaggerpetstore',
    icon: 'fa:code',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: '',
    defaults: {
      name: 'Swaggerpetstore',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: {},

    requestDefaults: {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      baseURL: '',
    },

    properties,
  }

  methods = methods
}
