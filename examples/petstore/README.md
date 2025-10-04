# Petstore Example

This example demonstrates generating an n8n node from the official OpenAPI v3 Petstore spec.

Spec source
- URL: https://raw.githubusercontent.com/openapitools/openapi-generator/master/modules/openapi-generator/src/test/resources/3_0/petstore.yaml
- Local copy: `examples/petstore/openapi.yaml`

Generate
- Command:
  - `node ../../bin/create-n8n-nodes.js generate -a ./openapi.yaml -o ./output -t ../../templates/n8n-nodes`
- Result:
  - Outputs to `examples/petstore/output/nodes/<NodeName>/...`

Notes
- The CLI resolves paths from the current working directory; run the command from `examples/petstore`.
- You can edit templates in `templates/n8n-nodes` and re-run the command to iterate.
