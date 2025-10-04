import * as _ from 'lodash';
import { markdownToTxt } from 'markdown-to-txt';

function compose<T>(...fns: Array<(x: T) => T>) {
  return (x: T) => fns.reduce((v, f) => f(v), x);
}

export function normalizeName(name: string, fn: ((x: string) => string) | undefined = (x) => x) {
  const processor = compose<string>(
    _.trim,
    (s) => s.replace(/[^a-zA-Z0-9 ]/g, ' '),
    (str) => str.replace(/^\s+|\s+$|\s+(?=\s)/g, ''),
    (x) => x.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()),
    _.trim,
  );
  const n = typeof fn === 'function' ? fn(name) : processor(name);
  return n;
}

export function normalizeDesc(desc?: string) {
  const processor = compose<string>(
    (d) => d || '',
    (d) => markdownToTxt(d),
    (d) => d.replace(/\.$/, ''),
    (d) => d.replace(/\n/g, ' '),
    (str) => str.replace(/^\s+|\s+$|\s+(?=\s)/g, ''),
    (s) => s.replace(/[^a-zA-Z0-9 ]/g, ' '),
    (d) => d.replace(/'/g, '"'),
    (d) => d.split('\n')[0],
    _.trim,
  );
  const desc2 = processor(desc || '');
  return desc2;
}

export function normalizeDisplayName(name?: string) {
  const processor = compose<string>(
    (d) => d || '',
    (s) => s.replace(/[^a-zA-Z0-9 ]/g, ' '),
    (str) => str.replace(/^\s+|\s+$|\s+(?=\s)/g, ''),
    (d) => d.replace(/\.$/, ''),
    (d) => d.replace(/\n/g, ' '),
    (x) => x.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()),
    _.trim,
  );
  const n = processor(name || '');
  return n;
}
