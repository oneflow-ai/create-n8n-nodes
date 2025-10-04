"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeDisplayName = exports.normalizeDesc = exports.normalizeName = void 0;
const _ = __importStar(require("lodash"));
const markdown_to_txt_1 = require("markdown-to-txt");
function compose(...fns) {
    return (x) => fns.reduce((v, f) => f(v), x);
}
function normalizeName(name, fn = (x) => x) {
    const processor = compose(_.trim, (s) => s.replace(/[^a-zA-Z0-9 ]/g, ' '), (str) => str.replace(/^\s+|\s+$|\s+(?=\s)/g, ''), (x) => x.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()), _.trim);
    const n = typeof fn === 'function' ? fn(name) : processor(name);
    return n;
}
exports.normalizeName = normalizeName;
function normalizeDesc(desc) {
    const processor = compose((d) => d || '', (d) => (0, markdown_to_txt_1.markdownToTxt)(d), (d) => d.replace(/\.$/, ''), (d) => d.replace(/\n/g, ' '), (str) => str.replace(/^\s+|\s+$|\s+(?=\s)/g, ''), (s) => s.replace(/[^a-zA-Z0-9 ]/g, ' '), (d) => d.replace(/'/g, '"'), (d) => d.split('\n')[0], _.trim);
    const desc2 = processor(desc || '');
    return desc2;
}
exports.normalizeDesc = normalizeDesc;
function normalizeDisplayName(name) {
    const processor = compose((d) => d || '', (s) => s.replace(/[^a-zA-Z0-9 ]/g, ' '), (str) => str.replace(/^\s+|\s+$|\s+(?=\s)/g, ''), (d) => d.replace(/\.$/, ''), (d) => d.replace(/\n/g, ' '), (x) => x.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()), _.trim);
    const n = processor(name || '');
    return n;
}
exports.normalizeDisplayName = normalizeDisplayName;
