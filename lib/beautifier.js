"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const swagger_parser_1 = __importDefault(require("@apidevtools/swagger-parser"));
exports.default = async (openapi) => {
    openapi.basePath = openapi.basePath || '';
    openapi.info = openapi.info || {};
    const schema = await swagger_parser_1.default.parse(openapi);
    return schema;
};
