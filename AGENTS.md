# Repository Guidelines

## Project Guidelines & Module Organization
- Root CLI: `bin/create-n8n-nodes.js` (entry for `create-n8n-nodes`).
- Core logic: `src/` (generator, OpenAPI merge/split, n8n descriptors).
- Templates: `templates/` (scaffolds for nodes/triggers).
- Examples and assets: `examples/`, `assets/`.
- Sample specs: `tests/openapi3/` and `tests/postman/` used for local validation.
- Monorepo samples: `packages/` contains example node packages.

## Build, Test, and Development Commands
- Generate nodes: `node bin/create-n8n-nodes.js generate -a test/fixtures/openapi/petstore.yaml -o dist -t templates/n8n-nodes`
  - Writes to `dist/nodes/<NodeName>/` using the selected template.
- Merge OpenAPI: `node cli.js merge -i ./apis -o ./openapi.yml -p ymls`
- Split JSON: `node cli.js split -i ./apis/api.json -o ./apis/groups`
- Extend files: `node cli.js extend -s ./nodes/YourNode/resources/hooks.ts -b .`
- Table of contents (docs): `npm run toc` (updates README TOC).

## Coding Style & Naming Conventions
- Language: Node.js (>=12). Use CommonJS modules.
- Formatting: 2-space indent, single quotes, semicolons, LF line endings.
- Linting: `.eslintrc` enforced rules; follow `.editorconfig` for basics.
- Naming: kebab-case for packages and generated resources, PascalCase for Node class names (e.g., `YourNode`).

## Testing Guidelines
- No formal test runner. Validate by generating from sample specs:
  - Example: `node cli.js generate -a tests/openapi3/petstore.yaml -o dist -t templates/n8n-nodes`
  - Inspect output structure and TypeScript formatting in generated files.
- Prefer small, representative specs when reproducing issues. Include input spec and CLI args in PRs.

## Commit & Pull Request Guidelines
- Commits: present tense, concise scope (e.g., "generator: fix operation folder naming").
- PRs must include:
  - Summary of changes and rationale
  - Repro steps or commands used (inputs/outputs)
  - Linked issue(s) if applicable; screenshots or tree listings for generated outputs

## Security & Configuration Tips
- Never commit credentials or real API keys. Use `credentials` config examples only.
- To customize generation without forking templates, place overrides in `extensions/` mirroring the generated structure.
- For multiple nodes/triggers, provide a config via `-c <file>` and use per-node options.
