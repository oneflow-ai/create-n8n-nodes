import fs from 'fs';

export default function removeDuplicateInterfaces(filePath: string) {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const lines = fileContent.split(/\r?\n/);
  const interfacesMap = new Set<string>();
  let interfaceName = '';
  let captureMode = false;
  const capturedContent: string[] = [];

  lines.forEach((line) => {
    const trimmedLine = line.trim();
    const isInterfaceStart = trimmedLine.startsWith('export interface ');

    if (!captureMode && isInterfaceStart) {
      const interfaceMatch = /^export interface (\w+)/.exec(trimmedLine);
      if (interfaceMatch) {
        interfaceName = interfaceMatch[1];

        if (interfacesMap.has(interfaceName)) {
          captureMode = true;
        } else {
          interfacesMap.add(interfaceName);
          capturedContent.push(line);
        }
      }
    } else if (captureMode && trimmedLine === '}') {
      captureMode = false;
    } else if (!captureMode) {
      capturedContent.push(line);
    }
  });

  const outputContent = capturedContent.join('\n');
  fs.writeFileSync(filePath, outputContent);
}

