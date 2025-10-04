"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
function removeDuplicateInterfaces(filePath) {
    const fileContent = fs_1.default.readFileSync(filePath, 'utf-8');
    const lines = fileContent.split(/\r?\n/);
    const interfacesMap = new Set();
    let interfaceName = '';
    let captureMode = false;
    const capturedContent = [];
    lines.forEach((line) => {
        const trimmedLine = line.trim();
        const isInterfaceStart = trimmedLine.startsWith('export interface ');
        if (!captureMode && isInterfaceStart) {
            const interfaceMatch = /^export interface (\w+)/.exec(trimmedLine);
            if (interfaceMatch) {
                interfaceName = interfaceMatch[1];
                if (interfacesMap.has(interfaceName)) {
                    captureMode = true;
                }
                else {
                    interfacesMap.add(interfaceName);
                    capturedContent.push(line);
                }
            }
        }
        else if (captureMode && trimmedLine === '}') {
            captureMode = false;
        }
        else if (!captureMode) {
            capturedContent.push(line);
        }
    });
    const outputContent = capturedContent.join('\n');
    fs_1.default.writeFileSync(filePath, outputContent);
}
exports.default = removeDuplicateInterfaces;
