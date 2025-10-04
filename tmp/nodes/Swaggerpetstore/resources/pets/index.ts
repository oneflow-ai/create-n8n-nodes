/* eslint-disable n8n-nodes-base/node-param-option-description-identical-to-name */
/* eslint-disable n8n-nodes-base/node-param-display-name-miscased-id */
/* eslint-disable n8n-nodes-base/node-param-display-name-miscased-id */
/* eslint-disable n8n-nodes-base/node-param-description-boolean-without-whether */
/* eslint-disable n8n-nodes-base/node-param-options-type-unsorted-items */

/**
 * The following code was generated create-n8n-nodes tool.
 *
 * This file was automatically generated and should not be edited.
 *
 * If changes are required, please refer to the templates and scripts in the repository.
 * Repository: https://github.com/oneflow-vn/create-n8n-nodes
 */

import { INodeProperties, INodePropertyOptions } from 'n8n-workflow'
import { runHooks } from './hooks'

import * as listAllPets from './list-all-pets'
import * as createAPet from './create-a-pet'
import * as infoForASpecificPet from './info-for-a-specific-pet'

const operations: INodePropertyOptions[] = [
  listAllPets.option,
  createAPet.option,
  infoForASpecificPet.option,
]

export const name = 'pets'

const operationSelect: INodeProperties = {
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  displayOptions: {
    show: {
      resource: ['pets'],
    },
  },
  default: '',
}

// overwrite the options of the operationSelect
operationSelect.options = operations

// set the default operation
operationSelect.default = operations.length > 0 ? operations[0].value : ''

export const rawProperties: INodeProperties[] = [
  operationSelect,
  ...listAllPets.properties,
  ...createAPet.properties,
  ...infoForASpecificPet.properties,
]

const { properties, methods } = runHooks(rawProperties)

export { properties, methods }
