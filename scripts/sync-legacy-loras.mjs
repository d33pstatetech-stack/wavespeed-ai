// Regenerate the array literals inside public/loras.js from client/src/loras-data.js
// so the legacy static-preview bundle carries the same sanitized seed set.
import { readFileSync, writeFileSync } from 'node:fs';
import { CURATED_LORAS, NSFW_LORAS } from '../client/src/loras-data.js';

const target = process.argv[2];
let src = readFileSync(target, 'utf8');

function indent(text, pad) {
  return text.split('\n').map((l, i) => (i === 0 ? l : pad + l)).join('\n');
}

function literal(arr) {
  return '[\n' + arr.map((o) => '    ' + JSON.stringify(o, null, 2).split('\n').join('\n    ')).join(',\n') + '\n  ]';
}

function replaceArray(text, name, arr) {
  const start = text.indexOf(`const ${name} = [`);
  if (start < 0) throw new Error(`${name} not found`);
  // walk brackets from the opening '[' to find the matching ']'
  let depth = 0, i = text.indexOf('[', start), end = -1;
  for (; i < text.length; i++) {
    const c = text[i];
    if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  if (end < 0) throw new Error(`unbalanced brackets for ${name}`);
  return text.slice(0, start) + `const ${name} = ` + literal(arr) + text.slice(end);
}

src = replaceArray(src, 'USER_LORAS', CURATED_LORAS);
src = replaceArray(src, 'NSFW_LORAS', NSFW_LORAS);
writeFileSync(target, src, 'utf8');
console.log(`rewrote ${target}: ${CURATED_LORAS.length} curated, ${NSFW_LORAS.length} nsfw`);
