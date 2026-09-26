// Regenerate the array literals inside the legacy public/loras.js (and the legacy
// public/index.html data blocks, via sync-legacy-index.mjs) from
// client/src/loras-data.js, so the static-preview bundle carries the same seed
// set as the React client.
//
//   node scripts/sync-legacy-loras.mjs public/loras.js
//
// The picker shows the public seed list and the owner's own adapters together,
// so the combined set is what gets written as one flat literal.
import { readFileSync, writeFileSync } from 'node:fs';
import { CURATED_LORAS, OWN_LORAS, NSFW_LORAS } from '../client/src/loras-data.js';

const target = process.argv[2];
let src = readFileSync(target, 'utf8');

function literal(arr) {
  return '[\n' + arr.map((o) => '    ' + JSON.stringify(o, null, 2).split('\n').join('\n    ')).join(',\n') + '\n  ]';
}

// Replace `const NAME = [ ... ]`. The declaration marker deliberately excludes
// the opening bracket, because the replacement body supplies its own.
function replaceArray(text, name, arr) {
  const decl = `const ${name} = `;
  const start = text.indexOf(decl);
  if (start < 0) throw new Error(`${name} not found`);
  let depth = 0, i = text.indexOf('[', start), end = -1;
  for (; i < text.length; i++) {
    const c = text[i];
    if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  if (end < 0) throw new Error(`unbalanced brackets for ${name}`);
  let after = end;
  if (text[after] === ';') after++;
  return text.slice(0, start) + decl + literal(arr) + text.slice(after);
}

const pickerList = [...CURATED_LORAS, ...OWN_LORAS];
src = replaceArray(src, 'USER_LORAS', pickerList);
src = replaceArray(src, 'NSFW_LORAS', NSFW_LORAS);
writeFileSync(target, src, 'utf8');
console.log(
  `rewrote ${target}: ${pickerList.length} picker (${CURATED_LORAS.length} curated + ${OWN_LORAS.length} own), ${NSFW_LORAS.length} nsfw`,
);
