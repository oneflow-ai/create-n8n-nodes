import path from 'path';
import fs from 'fs';
import _ from 'lodash';
import Handlebars from 'handlebars';

const getFileContent = (filePath: string) => {
  return fs.readFileSync(filePath, 'utf8');
};

export default async (filePath: string): Promise<void> => {
  let extname = path.extname(filePath);
  if (extname === '.hbs') {
    const filePathSansExt = filePath.replace(extname, '');
    extname = path.extname(filePathSansExt) + extname;
  }
  const partialName = _.camelCase(path.basename(filePath, extname));
  Handlebars.registerPartial(partialName, getFileContent(filePath));
};

