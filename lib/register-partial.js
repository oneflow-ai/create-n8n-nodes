"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const lodash_1 = __importDefault(require("lodash"));
const handlebars_1 = __importDefault(require("handlebars"));
const getFileContent = (filePath) => {
    return fs_1.default.readFileSync(filePath, 'utf8');
};
exports.default = async (filePath) => {
    let extname = path_1.default.extname(filePath);
    if (extname === '.hbs') {
        const filePathSansExt = filePath.replace(extname, '');
        extname = path_1.default.extname(filePathSansExt) + extname;
    }
    const partialName = lodash_1.default.camelCase(path_1.default.basename(filePath, extname));
    handlebars_1.default.registerPartial(partialName, getFileContent(filePath));
};
