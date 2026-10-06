// Runtime test for buildEnhancerSystemPrompt in an app worker.
//
// This exists because a rename left the function body referencing a `guide`
// identifier that no longer existed: `const guideBlock = ctx.guideBlock`
// followed by `if (guide)`. `node --check` passed — it only validates syntax,
// not undefined identifiers — so the breakage reached production and every
// enhance failed with "guide is not defined".
//
// Executing the function is the only check that catches it. The function is
// sliced out of src/worker.js and evaluated against stubs, so the test always
// runs the shipped code rather than a copy that can drift.
//
// Usage: node scripts/test-enhancer-prompt.mjs <path-to-worker.js>

import fs from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('usage: node scripts/test-enhancer-prompt.mjs <worker.js>');
  process.exit(2);
}

const src = fs.readFileSync(file, 'utf8');

// Slice the function plus the template/preset constants it closes over.
function sliceBlock(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  if (start === -1) throw new Error(`not found: ${startMarker}`);
  const end = text.indexOf(endMarker, start);
  if (end === -1) throw new Error(`not found: ${endMarker}`);
  return text.slice(start, end);
}

const ENHANCER_TEMPLATE = 'TEMPLATE for [Media Generation Type] via [Model] at [resolution] and [aspect ratio].';
const MODEL_PRESETS = {
  default: 'PRESET_DEFAULT',
  seedance: 'PRESET_SEEDANCE',
  wan: 'PRESET_WAN',
  minimax: 'PRESET_MINIMAX',
  kling: 'PRESET_KLING',
};

const fnSrc = sliceBlock(src, 'function buildEnhancerSystemPrompt', '\nasync function getPromptGuide')
  // The function references ENHANCER_TEMPLATE / MODEL_PRESETS / helpers from
  // module scope; supply them as parameters of the evaluated wrapper.
  + '\nreturn buildEnhancerSystemPrompt;';

let build;
try {
  // eslint-disable-next-line no-new-func
  build = new Function('ENHANCER_TEMPLATE', 'MODEL_PRESETS', 'hasDialogueCues', 'deriveMediaTypeWorker', fnSrc)(
    ENHANCER_TEMPLATE, MODEL_PRESETS, () => true, () => 'text-to-image',
  );
} catch (e) {
  console.error(`FAIL could not evaluate buildEnhancerSystemPrompt: ${e.message}`);
  process.exit(1);
}

const base = { model: 'x', mediaType: 'text-to-image', aspectRatio: '1:1', resolution: null, duration: null, hasAudio: true };

const cases = [
  {
    name: 'guide present injects block and suppresses the legacy preset',
    ctx: { ...base, guideBlock: 'GUIDE_TEXT_123' },
    expectContains: ['GUIDE_TEXT_123'],
    expectAbsent: ['PRESET_DEFAULT', 'undefined', '[object Object]'],
  },
  {
    name: 'no guide falls back to MODEL_PRESETS',
    ctx: { ...base, guideBlock: null },
    expectContains: ['PRESET_DEFAULT'],
    expectAbsent: ['GUIDE_TEXT_123', 'undefined', '[object Object]'],
  },
  {
    name: 'no guide + wan selects the wan preset',
    ctx: { ...base, model: 'wan2.6-image-to-video', mediaType: 'image-to-video', guideBlock: null },
    expectContains: ['PRESET_WAN'],
    expectAbsent: ['undefined'],
  },
  {
    name: 'no guide + seedance selects the seedance preset',
    ctx: { ...base, model: 'seedance-2.5-t2v', mediaType: 'text-to-video', guideBlock: null },
    expectContains: ['PRESET_SEEDANCE'],
    expectAbsent: ['undefined'],
  },
  {
    name: 'undefined guideBlock behaves as no guide',
    ctx: { ...base, guideBlock: undefined },
    expectContains: ['PRESET_DEFAULT'],
    expectAbsent: ['GUIDE_TEXT_123', 'undefined'],
  },
  {
    name: 'empty-string guideBlock behaves as no guide',
    ctx: { ...base, guideBlock: '' },
    expectContains: ['PRESET_DEFAULT'],
    expectAbsent: ['GUIDE_TEXT_123'],
  },
];

let failed = 0;
for (const c of cases) {
  let out;
  try {
    out = build('a cat', c.ctx);
  } catch (e) {
    console.error(`FAIL ${c.name}\n      threw: ${e.message}`);
    failed++;
    continue;
  }
  const problems = [];
  for (const needle of c.expectContains || []) {
    if (!out.includes(needle)) problems.push(`missing ${JSON.stringify(needle)}`);
  }
  for (const needle of c.expectAbsent || []) {
    if (out.includes(needle)) problems.push(`unexpectedly contains ${JSON.stringify(needle)}`);
  }
  if (problems.length) {
    console.error(`FAIL ${c.name}\n      ${problems.join('\n      ')}`);
    failed++;
  } else {
    console.log(`ok   ${c.name}`);
  }
}

// The specific regression: a bare undefined identifier must throw loudly here
// rather than silently in production.
let threw = null;
try {
  build('a cat', { ...base, guideBlock: 'X' });
} catch (e) {
  threw = e;
}
if (threw) {
  console.error(`FAIL guide path threw: ${threw.message}`);
  failed++;
}

console.log(failed ? `\nFAIL ${failed} case(s) in ${file}` : `\nPASS all cases in ${file}`);
process.exit(failed ? 1 : 0);