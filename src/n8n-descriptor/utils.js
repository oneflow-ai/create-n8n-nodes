const _ = require('lodash');
const { markdownToTxt } = require('markdown-to-txt');

function compose(...fns) {
  return (x) => fns.reduce((v, f) => f(v), x);
}

function normalizeName(name, fn = (x) => x) {
  const processor = compose(
    _.trim,
    // remove special characters
    (s) => s.replace(/[^a-zA-Z0-9 ]/g, ' '),
    // remove multiple spaces
    str => str.replace(/^\s+|\s+$|\s+(?=\s)/g, ''),
    // to title case
    (x) => x.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()),
    _.trim,
  );

  const n = typeof fn === 'function' ? fn(name) : processor(name);
  return n;
}

function normalizeDesc(desc) {
  const processor = compose(
    // default value
    (d) => d || '',
    // convert markdown to text
    (desc) => markdownToTxt(desc),
    // remove ending dot
    (desc) => desc.replace(/\.$/, ''),
    // remove line breaks
    (desc) => desc.replace(/\n/g, ' '),
    // remove multiple spaces
    str => str.replace(/^\s+|\s+$|\s+(?=\s)/g, ''),
    // remove special characters
    (s) => s.replace(/[^a-zA-Z0-9 ]/g, ' '),
    // convert ' to "
    (desc) => desc.replace(/'/g, '"'),
    // get first paragraph
    (desc) => desc.split('\n')[0],
    _.trim,
  );

  const desc2 = processor(desc);

  return desc2;
}

// title case and remove special characters
function normalizeDisplayName(name) {
  const processor = compose(
    // default value
    (d) => d || '',
    // remove special characters
    (s) => s.replace(/[^a-zA-Z0-9 ]/g, ' '),
    // remove multiple spaces
    str => str.replace(/^\s+|\s+$|\s+(?=\s)/g, ''),
    // remove ending dot
    (desc) => desc.replace(/\.$/, ''),
    // remove line breaks
    (desc) => desc.replace(/\n/g, ' '),
    // to title case
    (x) => x.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()),
    _.trim,
  );

  const n = processor(name);
  return n;
}

module.exports = {
  normalizeDisplayName,
  normalizeName,
  normalizeDesc,
};

