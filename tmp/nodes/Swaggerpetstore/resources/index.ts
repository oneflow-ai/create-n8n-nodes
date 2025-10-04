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

import { INodeProperties } from 'n8n-workflow'

// @ts-ignore
import * as helpers from '../helpers'

import { aggregateNodeMethods } from '../helpers/methods'
import { runHooks } from './hooks'

import * as pets from './pets'

const authenticationProperties: INodeProperties[] = []

const resourceSelect: INodeProperties[] = [
  {
    displayName: 'Resource',
    name: 'resource',
    type: 'hidden',
    noDataExpression: true,
    options: [
      {
        name: 'pets',
        value: 'pets',
        description: '',
      },
    ],
    default: '',
  },
]

const extraProperties: INodeProperties[] = [
  {
    displayName: 'Use Custom Body',
    name: 'useCustomBody',
    type: 'boolean',
    description: 'Whether to use a custom body',
    required: false,
    default: false,
  },
]

const rawProperties: INodeProperties[] = [
  ...authenticationProperties,
  ...resourceSelect,
  ...pets.properties,
  ...extraProperties,
]

const { properties, methods: selfMethods } = runHooks(rawProperties)

const methods = aggregateNodeMethods([selfMethods, pets.methods])

export { properties, methods }
