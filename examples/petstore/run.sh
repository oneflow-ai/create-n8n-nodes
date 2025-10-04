#!/usr/bin/env bash
set -euo pipefail
node ../../bin/create-n8n-nodes.js generate -a ./openapi.yaml -o ./output -t ../../templates/n8n-nodes

