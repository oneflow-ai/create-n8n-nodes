"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const postman_to_swagger_1 = __importDefault(require("postman-to-swagger"));
const fs_1 = __importDefault(require("fs"));
const lark_json_1 = __importDefault(require("../tests/postman/lark.json"));
const swaggerJson = (0, postman_to_swagger_1.default)(lark_json_1.default, {
    target_spec: 'swagger2.0',
    info: { version: 'v1' },
});
const output = JSON.stringify(swaggerJson, null, 2);
fs_1.default.writeFileSync('swagger.yaml', output, 'utf8');
