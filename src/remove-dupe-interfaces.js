const fs = require('fs');

function removeDuplicateInterfaces (filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const lines = fileContent.split(/\r?\n/);
  const interfacesMap = new Set();
  let interfaceName = '';
  let captureMode = false;
  const capturedContent = [];

  lines.forEach((line) => {
    const trimmedLine = line.trim();
    const isInterfaceStart = trimmedLine.startsWith('export interface ');

    if (!captureMode && isInterfaceStart) {
      // Extract interface name using regular expression
      const interfaceMatch = (/^export interface (\w+)/).exec(trimmedLine);
      if (interfaceMatch) {
        interfaceName = interfaceMatch[1];

        // Check if the interface name has already been captured
        if (interfacesMap.has(interfaceName)) {
          captureMode = true;
        } else {
          interfacesMap.add(interfaceName);
          capturedContent.push(line); // Keep this interface
        }
      }
    } else if (captureMode && trimmedLine === '}') {
      captureMode = false; // Stop skipping lines at the end of interface
    } else if (!captureMode) {
      capturedContent.push(line); // Keep lines outside of duplicate interfaces
    }
  });

  const outputContent = capturedContent.join('\n');
  fs.writeFileSync(filePath, outputContent);
}

module.exports = removeDuplicateInterfaces;
