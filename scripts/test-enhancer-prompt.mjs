// Runtime test for the enhancer prompt pipeline in this app's worker.
//
// This exists because a rename left buildEnhancerSystemPrompt referencing a
// `guide` identifier that no longer existed: `const guideBlock = ctx.guideBlock`
// followed by `if (guide)`. `node --check` passed — it only validates syntax,
// not undefined identifiers — so the breakage reached production and every
// enhance failed with "guide is not defined".
//
// Executing the shipped code is the only check that catches that class of bug.
// The module-scope region the functions live in is sliced straight out of
// src/worker.js and evaluated, so the test always runs the deployed text rather
// than a copy that can drift.
//
// Usage: node scripts/test-enhancer-prompt.mjs <path-to-worker.js>

import fs from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('usage: node scripts/test-enhancer-prompt.mjs <worker.js>');
  process.exit(2);
}

const src = fs.readFileSync(file, 'utf8');

function sliceBlock(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  if (start === -1) throw new Error(`not found: ${startMarker}`);
  const end = text.indexOf(endMarker, start);
  if (end === -1) throw new Error(`not found: ${endMarker}`);
  return text.slice(start, end);
}

// Four contiguous slices carry the real code together with the functions under
// test: the provider defaults and key resolver, the stream accumulator and
// refusal guard, and the prompt constants, modality helpers and
// buildEnhancerSystemPrompt. Because the slices are evaluated with no outer
// scope, any identifier the code reads that is not defined here (or in the
// runtime) throws ReferenceError — which is the whole point of the harness.
const slices = [
  ['const DEFAULT_LLM_PROVIDERS = [', 'function createEnhanceAccumulator()'],
  ['function resolveProviderApiKey(provider, env) {', '\nfunction redactLLMConfig'],
  ['function createEnhanceAccumulator()', 'const MODEL_PRESETS = {'],
  ['const MODEL_PRESETS = {', '\nasync function getPromptGuide'],
];
const region = slices.map(([a, b]) => sliceBlock(src, a, b)).join('\n');

let api;
try {
  // eslint-disable-next-line no-new-func
  api = new Function(
    `${region}\nreturn { buildEnhancerSystemPrompt, deriveMediaTypeWorker, mediaTypeIsVideo, inferCategoryClassWorker, MODEL_PRESETS, ENHANCER_TEMPLATE_VIDEO, ENHANCER_TEMPLATE_IMAGE, createEnhanceAccumulator, accumulateEnhanceDelta, enhancementRejectReason, resolveProviderApiKey, DEFAULT_LLM_PROVIDERS };`,
  )();
} catch (e) {
  console.error(`FAIL could not evaluate the worker slice: ${e.message}`);
  process.exit(1);
}

const {
  buildEnhancerSystemPrompt,
  deriveMediaTypeWorker,
  mediaTypeIsVideo,
  inferCategoryClassWorker,
  MODEL_PRESETS,
  createEnhanceAccumulator,
  accumulateEnhanceDelta,
  enhancementRejectReason,
  resolveProviderApiKey,
  DEFAULT_LLM_PROVIDERS,
} = api;

const build = (raw, ctx) => buildEnhancerSystemPrompt(raw, ctx);
const base = { model: 'x', mediaType: 'text-to-image', aspectRatio: '1:1', resolution: null, duration: null, hasAudio: true };

let failed = 0;
function check(name, fn) {
  try {
    const problems = fn() || [];
    if (problems.length) {
      console.error(`FAIL ${name}\n      ${problems.join('\n      ')}`);
      failed++;
    } else {
      console.log(`ok   ${name}`);
    }
  } catch (e) {
    console.error(`FAIL ${name}\n      threw: ${e.message}`);
    failed++;
  }
}
const mustContain = (out, needle) => (!out.includes(needle) ? [`missing ${JSON.stringify(needle)}`] : []);
const mustNotContain = (out, needle) => (out.includes(needle) ? [`unexpectedly contains ${JSON.stringify(needle)}`] : []);
const mustMatch = (out, re) => (!re.test(out) ? [`expected to match ${re}`] : []);
const mustNotMatch = (out, re) => (re.test(out) ? [`unexpectedly matches ${re}`] : []);

// ── guide / preset wiring (the original regression) ───────────────────────────
check('guide present injects block and suppresses the legacy preset', () => {
  const out = build('a cat', { ...base, guideBlock: 'GUIDE_TEXT_123' });
  return [...mustContain(out, 'GUIDE_TEXT_123'), ...mustNotContain(out, MODEL_PRESETS.seedance), ...mustNotContain(out, 'undefined'), ...mustNotContain(out, '[object Object]')];
});
check('no guide + wan video target selects the wan preset', () => {
  const out = build('a cat', { ...base, model: 'alibaba/wan-2.5/image-to-video', mediaType: 'image-to-video', guideBlock: null });
  return mustContain(out, MODEL_PRESETS.wan);
});
check('no guide + seedance video target selects the seedance preset', () => {
  const out = build('a cat', { ...base, model: 'bytedance/seedance-2.5/t2v', mediaType: 'text-to-video', guideBlock: null });
  return mustContain(out, MODEL_PRESETS.seedance);
});
check('undefined guideBlock behaves as no guide', () => {
  const out = build('a cat', { ...base, guideBlock: undefined });
  return mustNotContain(out, 'GUIDE_TEXT_123');
});
check('empty-string guideBlock behaves as no guide', () => {
  const out = build('a cat', { ...base, guideBlock: '' });
  return mustNotContain(out, 'GUIDE_TEXT_123');
});
check('the guide path does not throw', () => {
  build('a cat', { ...base, guideBlock: 'X' });
  return [];
});

// ── K2: an image target must never be given video instructions ───────────────
// The image template names the forbidden syntax once, in order to forbid it, so
// the leak scan runs with that prohibition stripped out. What must not survive
// is the video template's *instruction* to use those constructs.
const IMAGE_VIDEO_LEAK = /timestamp|timecode|at 00:|dolly|orbital|chase cam|shot type|screenplay|timecoded/i;
const VIDEO_ONLY_TEMPLATE_PHRASES = [
  'total length of the video',
  'The video will be generated at',
  'timestamp direction',
  'camera movement directions into videographer jargon',
  'Video length:',
];
const withoutProhibition = (out) => out
  .replace(/Do not write timestamps[\s\S]*?progression\./i, '')
  // Anchored on the line, not on trailing text: the dialogue clause rewrites
  // what follows this sentence, so the text after it is not stable.
  .replace(/Add no timestamps, timecodes[^\n]*/i, '');
check('image target: no timestamp / camera-movement / duration language', () => {
  const out = build('a red fox in a snowy forest', { ...base, model: 'black-forest-labs/flux-3/edit', mediaType: 'text-to-image', duration: 5 });
  const scannable = withoutProhibition(out);
  return [
    ...mustNotMatch(scannable, IMAGE_VIDEO_LEAK),
    ...VIDEO_ONLY_TEMPLATE_PHRASES.map((p) => mustNotContain(scannable, p)).flat(),
    ...mustNotMatch(scannable, /video/i),
  ];
});
check('image target: states the still-image contract and the prohibition', () => {
  const out = build('a red fox', { ...base, model: 'black-forest-labs/flux-3/edit', mediaType: 'text-to-image' });
  return [...mustContain(out, 'SINGLE STILL IMAGE'), ...mustContain(out, 'Do not write timestamps')];
});
check('image target: video family presets are suppressed even when the id names one', () => {
  // alibaba/wan-2.5/image-edit is group_of=image but its id contains 'wan'.
  const out = build('a red fox', { ...base, model: 'alibaba/wan-2.5/image-edit', mediaType: 'image-to-image', guideBlock: null });
  const scannable = withoutProhibition(out);
  return [...mustNotContain(scannable, MODEL_PRESETS.wan), ...mustNotMatch(scannable, IMAGE_VIDEO_LEAK), ...mustNotMatch(scannable, /video/i)];
});
check('image target: the audio clause is suppressed when hasAudio is false', () => {
  const out = build('a red fox', { ...base, model: 'black-forest-labs/flux-3/edit', mediaType: 'image-to-image', hasAudio: false });
  return mustNotContain(out, 'includes audio generation');
});
check('image target: resolution and aspect ratio still applied', () => {
  const out = build('a red fox', { ...base, model: 'black-forest-labs/flux-3/edit', mediaType: 'text-to-image', resolution: '1024x1024', aspectRatio: '16:9', duration: 8 });
  return [...mustContain(out, 'The image will be generated at 1024x1024 and 16:9'), ...mustNotContain(out, '[resolution]'), ...mustNotContain(out, '[aspect ratio]')];
});
check('image target: resolution sentence dropped when unset', () => {
  const out = build('a red fox', { ...base, model: 'black-forest-labs/flux-3/edit', mediaType: 'text-to-image', resolution: null, aspectRatio: null });
  return [...mustNotContain(out, 'will be generated at'), ...mustNotContain(out, '[resolution]')];
});
check('video target still gets timestamp guidance and duration line', () => {
  const out = build('a car chase', { ...base, model: 'alibaba/wan-2.5/image-to-video', mediaType: 'image-to-video', duration: 8, hasAudio: false });
  return [
    ...mustContain(out, 'timestamp direction'),
    ...mustContain(out, 'The video will be generated at'),
    ...mustContain(out, 'Video length: 8 seconds'),
    ...mustMatch(out, /at 00:05/),
  ];
});
check('video target: no audio clause when the model has no audio', () => {
  const out = build('a car chase', { ...base, model: 'alibaba/wan-2.6/image-to-video', mediaType: 'image-to-video', hasAudio: false });
  return mustNotContain(out, 'includes audio generation');
});
check('video target: audio clause kept when the model has audio', () => {
  const out = build('a car chase', { ...base, model: 'alibaba/wan-2.1/image-to-video', mediaType: 'image-to-video', hasAudio: true });
  return mustContain(out, 'alibaba/wan-2.1/image-to-video includes audio generation');
});
check('audio target does not receive still-image or video guidance', () => {
  const out = build('a warm male narrator voiceover', { ...base, model: 'wavespeed-ai/elevenlabs/tts', mediaType: 'audio generation' });
  return [...mustNotContain(out, 'SINGLE STILL IMAGE'), ...mustNotMatch(withoutProhibition(out), IMAGE_VIDEO_LEAK)];
});
check('an "Other" catalogue row gets neither the video nor the still-image template', () => {
  // wavespeed-ai/video-upscaler is category=Other/group_of=other. The old
  // classifier emitted the token "other", which isVideo() matched, so it got the
  // video template.
  const out = build('sharpen this clip', { ...base, model: 'wavespeed-ai/video-upscaler', mediaType: 'other', duration: 4 });
  return [
    ...mustNotContain(out, 'SINGLE STILL IMAGE'),
    ...mustNotMatch(withoutProhibition(out), IMAGE_VIDEO_LEAK),
    ...mustNotContain(out, 'Video length:'),
  ];
});
check('missing mediaType falls back to the image branch, never video', () => {
  const out = build('a red fox', { ...base, mediaType: undefined });
  return [...mustContain(out, 'SINGLE STILL IMAGE'), ...mustNotMatch(out, /video/i)];
});
check('mediaTypeIsVideo only matches video types', () =>
  [
    ...(mediaTypeIsVideo('text-to-video') === true ? [] : ['text-to-video should be video']),
    ...(mediaTypeIsVideo('image-to-video') === true ? [] : ['image-to-video should be video']),
    ...(mediaTypeIsVideo('video-to-video') === true ? [] : ['video-to-video should be video']),
    ...(mediaTypeIsVideo('text-to-image') === false ? [] : ['text-to-image should not be video']),
    ...(mediaTypeIsVideo('other') === false ? [] : ['other should not be video']),
    ...(mediaTypeIsVideo(undefined) === false ? [] : ['undefined should not be video']),
  ]);

// ── K2: the real classifier ───────────────────────────────────────────────────
// Fixtures are verbatim D1 `models` rows (id, category, group_of) read from
// wavespeed-models, so the ladder is exercised against what this catalogue
// actually holds rather than invented shapes.
const CLASSIFIER_CASES = [
  ['image: flux edit', { id: 'black-forest-labs/flux-3/edit', category: 'Image to Image', group_of: 'image' }, 'image-to-image'],
  ['image: nano-banana edit', { id: 'google/nano-banana-pro/edit', category: 'Image to Image', group_of: 'image' }, 'image-to-image'],
  ['image: id carries a video family name', { id: 'alibaba/wan-2.5/image-edit', category: 'Image to Image', group_of: 'image' }, 'image-to-image'],
  ['image: i2i token in the id', { id: 'wavespeed-ai/flux-1-srpo/image-to-image', category: 'Image to Image', group_of: 'image' }, 'image-to-image'],
  ['image: Image to Text keeps its media type', { id: 'wavespeed-ai/ltx-2.3/image-to-text', category: 'Image to Text', group_of: 'image' }, 'image-to-text'],
  ['image: Image to 3D keeps its media type', { id: 'bytedance/seed3d-2.0/image-to-3d', category: 'Image to 3D', group_of: 'image' }, 'image-to-3d'],
  ['image: text to image', { id: 'wavespeed-ai/flux-2-pro/texture', category: 'Text to Image', group_of: 'image' }, 'text-to-image'],
  ['video: image to video', { id: 'alibaba/wan-2.7/image-to-video-spicy', category: 'Image to Video', group_of: 'video' }, 'image-to-video'],
  ['video: reference to video via the id', { id: 'alibaba/happyhorse-1.1/reference-to-video', category: 'Image to Video', group_of: 'video' }, 'reference-to-video'],
  ['video: text to video', { id: 'wavespeed-ai/seedance-2.5/t2v', category: 'Text to Video', group_of: 'video' }, 'text-to-video'],
  ['video: video to video', { id: 'wavespeed-ai/wan-2.2/video-to-video', category: 'Video to Video', group_of: 'video' }, 'video-to-video'],
  ['video: Audio to Video is not an audio target', { id: 'bytedance/seedance-2.5/talking-avatar', category: 'Audio to Video', group_of: 'video' }, 'video-to-video'],
  ['video: speech-to-video', { id: 'wavespeed-ai/wan-2.2/speech-to-video', category: 'Audio to Video', group_of: 'video' }, 'video-to-video'],
  ['video: Video to Text keeps its media type', { id: 'wavespeed-ai/wan-2.2/video-to-text', category: 'Video to Text', group_of: 'video' }, 'video-to-text'],
  ['audio: text to audio', { id: 'wavespeed-ai/elevenlabs/tts', category: 'Text to Audio', group_of: 'audio' }, 'audio generation'],
  ['3d: text to 3d', { id: 'wavespeed-ai/triposr/text-to-3d', category: 'Text to 3D', group_of: '3d' }, 'text-to-3d'],
  ['text: text to text', { id: 'wavespeed-ai/llm/qwen-3-8b', category: 'Text to Text', group_of: 'text' }, 'text-to-text'],
  ['other: video upscaler', { id: 'wavespeed-ai/video-upscaler', category: 'Other', group_of: 'other' }, 'other'],
  ['other: image upscaler', { id: 'wavespeed-ai/image-upscaler', category: 'Other', group_of: 'other' }, 'other'],
  ['other: LoRA trainer', { id: 'wavespeed-ai/krea-v2/turbo-lora', category: 'Other', group_of: 'other' }, 'other'],
  // group_of missing — the category takes over.
  ['category fallback: text to image', { id: 'mystery-model', category: 'Text to Image', group_of: '' }, 'text-to-image'],
  ['category fallback: video to video', { id: 'mystery-model', category: 'Video to Video', group_of: null }, 'video-to-video'],
  // inferGroupOf labels "Image to 3D" as image; the category classifier must
  // not repeat that when group_of is the thing that is missing.
  ['category fallback: image to 3d is 3d', { id: 'mystery-3d', category: 'Image to 3D', group_of: '' }, 'text-to-3d'],
  ['no signal at all', { id: 'mystery-model', category: '', group_of: '' }, 'text-to-image'],
  ['null model', null, 'text-to-image'],
];
for (const [name, model, expected] of CLASSIFIER_CASES) {
  check(`classify ${name} -> ${expected}`, () => {
    const got = deriveMediaTypeWorker(model);
    return got === expected ? [] : [`got ${JSON.stringify(got)}`];
  });
}
check('inferCategoryClassWorker checks 3d before image', () =>
  [
    ...(inferCategoryClassWorker('Image to 3D') === '3d' ? [] : [`Image to 3D got ${inferCategoryClassWorker('Image to 3D')}`]),
    ...(inferCategoryClassWorker('Text to 3D') === '3d' ? [] : [`Text to 3D got ${inferCategoryClassWorker('Text to 3D')}`]),
    ...(inferCategoryClassWorker('Text to Image') === 'image' ? [] : [`Text to Image got ${inferCategoryClassWorker('Text to Image')}`]),
    ...(inferCategoryClassWorker('Audio to Video') === 'video' ? [] : [`Audio to Video got ${inferCategoryClassWorker('Audio to Video')}`]),
    ...(inferCategoryClassWorker('') === null ? [] : ['empty category should be null']),
  ]);
check('classifier never returns a video type for an image row', () => {
  // Every row here is group_of=image or category=Image to Image in the live DB.
  const imageRows = [
    { id: 'black-forest-labs/flux-3/edit', category: 'Image to Image', group_of: 'image' },
    { id: 'alibaba/wan-2.7/image-edit-pro', category: 'Image to Image', group_of: 'image' },
    { id: 'kwaivgi/kling-image-v3/edit', category: 'Image to Image', group_of: 'image' },
    { id: 'wavespeed-ai/flux-2-max/edit', category: 'Image to Image', group_of: 'image' },
    { id: 'wavespeed-ai/flux-2-pro/texture', category: 'Text to Image', group_of: 'image' },
    { id: 'wavespeed-ai/z-image/base', category: 'Text to Image', group_of: 'image' },
  ];
  return imageRows.filter((m) => mediaTypeIsVideo(deriveMediaTypeWorker(m))).map((m) => `${m.id} classified as video`);
});
check('explicit modality override wins over group_of', () => {
  const m = { id: 'black-forest-labs/flux-3/edit', category: 'Image to Image', group_of: 'image' };
  const forcedVideo = deriveMediaTypeWorker(m, 'video');
  const forcedImage = deriveMediaTypeWorker({ id: 'alibaba/wan-2.5/image-to-video', category: 'Image to Video', group_of: 'video' }, 'image');
  return [
    ...(mediaTypeIsVideo(forcedVideo) ? [] : ['override image->video failed']),
    ...(mediaTypeIsVideo(forcedImage) ? [`override video->image got ${forcedImage}`] : []),
  ];
});
check('an override cannot produce a row outside the vocabulary', () => {
  const got = deriveMediaTypeWorker({ id: 'mystery-model', category: 'Other', group_of: 'other' }, 'video');
  return got === 'text-to-video' ? [] : [`got ${got}`];
});
check('unknown explicit modality value is ignored, not honoured', () => {
  const got = deriveMediaTypeWorker({ id: 'wavespeed-ai/flux-2-pro/texture', category: 'Text to Image', group_of: 'image' }, 'audio');
  return got === 'text-to-image' ? [] : [`got ${got}`];
});

// ── K3: reasoning content must not reach the persisted enhanced text ─────────
check('accumulator keeps reasoning_content out of content', () => {
  const acc = createEnhanceAccumulator();
  accumulateEnhanceDelta(acc, { reasoning_content: 'Let me think about ' });
  accumulateEnhanceDelta(acc, { content: 'a red fox' });
  accumulateEnhanceDelta(acc, { reasoning_content: 'the composition first. ' });
  accumulateEnhanceDelta(acc, { content: ' in a snowy forest' });
  return [
    ...mustNotContain(acc.content, 'Let me think'),
    ...mustNotContain(acc.content, 'composition first'),
    ...(acc.content === 'a red fox in a snowy forest' ? [] : [`content was ${JSON.stringify(acc.content)}`]),
    ...(acc.reasoning.includes('Let me think about') ? [] : ['reasoning channel lost its text']),
  ];
});
check('accumulator handles the verified 27-reasoning-to-2-content ratio', () => {
  const acc = createEnhanceAccumulator();
  for (let i = 0; i < 27; i++) accumulateEnhanceDelta(acc, { reasoning_content: `r${i} ` });
  accumulateEnhanceDelta(acc, { content: 'PROVIDER_OK' });
  return [
    ...mustNotContain(acc.content, 'r0'),
    ...(acc.content === 'PROVIDER_OK' ? [] : [`content was ${JSON.stringify(acc.content)}`]),
  ];
});
check('accumulator tolerates empty and nullish deltas', () => {
  const acc = createEnhanceAccumulator();
  accumulateEnhanceDelta(acc, null);
  accumulateEnhanceDelta(acc, undefined);
  accumulateEnhanceDelta(acc, {});
  accumulateEnhanceDelta(acc, { content: '' });
  accumulateEnhanceDelta(acc, { content: 'ok' });
  return acc.content === 'ok' ? [] : [`content was ${JSON.stringify(acc.content)}`];
});
check('accumulator also separates the reasoning alias', () => {
  const acc = createEnhanceAccumulator();
  accumulateEnhanceDelta(acc, { reasoning: 'hidden thoughts', content: 'visible' });
  return [...mustNotContain(acc.content, 'hidden thoughts'), ...(acc.content === 'visible' ? [] : [`content was ${JSON.stringify(acc.content)}`])];
});

// ── K3: key resolution ───────────────────────────────────────────────────────
const env = { EXPLABS_API_KEY: 'explabs-secret', OPENROUTER_API_KEY: 'or-secret', VENICE_API_KEY: 'venice-secret' };
check('Experimental Labs entry resolves EXPLABS_API_KEY, not the OpenRouter key', () => {
  const p = DEFAULT_LLM_PROVIDERS[0];
  const problems = [];
  if (p.baseUrl !== 'https://api.experientiallabs.ai/v1') problems.push(`unexpected baseUrl ${p.baseUrl}`);
  if (p.model !== 'glm-5.3-flash-abliterated') problems.push(`model is ${p.model}`);
  if (p.apiKeyEnv !== 'EXPLABS_API_KEY') problems.push(`apiKeyEnv is ${p.apiKeyEnv}`);
  if (resolveProviderApiKey(p, env) !== 'explabs-secret') problems.push(`resolved ${resolveProviderApiKey(p, env)}`);
  return problems;
});
check('defaults are ordered Experimental Labs first', () =>
  DEFAULT_LLM_PROVIDERS[0].apiKeyEnv === 'EXPLABS_API_KEY' ? [] : ['first provider is not Experimental Labs']);
check('every default provider declares the secret that authenticates its host', () => {
  const expected = { 'experientiallabs.ai': 'EXPLABS_API_KEY', 'openrouter.ai': 'OPENROUTER_API_KEY', 'venice.ai': 'VENICE_API_KEY' };
  return DEFAULT_LLM_PROVIDERS
    .filter((p) => {
      const host = Object.keys(expected).find((h) => p.baseUrl.includes(h));
      return !host || expected[host] !== p.apiKeyEnv;
    })
    .map((p) => `${p.baseUrl} declares ${p.apiKeyEnv}`);
});
check('apiKeyEnv does not override a key stored on the entry', () => {
  const stored = resolveProviderApiKey({ baseUrl: 'https://api.experientiallabs.ai/v1', model: 'm', apiKey: 'from-d1', apiKeyEnv: 'EXPLABS_API_KEY' }, env);
  return stored === 'from-d1' ? [] : [`got ${stored}`];
});
check('legacy rows with no apiKeyEnv keep the old URL sniff', () => {
  const venice = resolveProviderApiKey({ baseUrl: 'https://api.venice.ai/api/v1', model: 'venice-uncensored', apiKey: '' }, env);
  const orLegacy = resolveProviderApiKey({ baseUrl: 'https://openrouter.ai/api/v1', model: 'openrouter/free', apiKey: '' }, env);
  const unknown = resolveProviderApiKey({ baseUrl: 'https://example.invalid/v1', model: 'x', apiKey: '' }, env);
  return [
    ...(venice === 'venice-secret' ? [] : [`venice got ${venice}`]),
    ...(orLegacy === 'or-secret' ? [] : [`openrouter got ${orLegacy}`]),
    ...(unknown === 'or-secret' ? [] : [`unknown host got ${unknown}`]),
  ];
});
check('missing secret yields an empty key rather than another provider key', () => {
  const got = resolveProviderApiKey({ baseUrl: 'https://api.experientiallabs.ai/v1', model: 'm', apiKeyEnv: 'EXPLABS_API_KEY' }, {});
  return got === '' ? [] : [`got ${got}`];
});
check('a named-but-absent secret does not fall through to the OpenRouter key', () => {
  const got = resolveProviderApiKey({ baseUrl: 'https://api.experientiallabs.ai/v1', model: 'm', apiKeyEnv: 'EXPLABS_API_KEY' }, { OPENROUTER_API_KEY: 'or-secret' });
  return got === '' ? [] : [`got ${got} — the legacy sniff leaked another provider's key`];
});

// ── K10: refusal guard ───────────────────────────────────────────────────────
const REFUSAL_CASES = [
  ["I'm sorry, but I can't help with that request.", 'refusal'],
  ['I cannot assist with this prompt.', 'refusal'],
  ['I am unable to provide that.', 'refusal'],
  ['Sorry, but I must decline.', 'refusal'],
  ['As an AI language model I must inform you that this is not something I can do.', 'refusal'],
  ['', 'empty'],
  ['no', 'too_short'],
  ['Enhanced: ok', 'too_short'],
];
for (const [text, expected] of REFUSAL_CASES) {
  check(`reject ${JSON.stringify(text.slice(0, 34)) || '(empty)'} -> ${expected}`, () => {
    const got = enhancementRejectReason(text, 'a long raw prompt about a red fox walking through a snowy forest at dawn');
    return got === expected ? [] : [`got ${got}`];
  });
}
const KEEP_CASES = [
  'a red fox in a snowy forest, soft morning light, 85mm, shallow depth of field',
  'EXTREME_PROMPT_MARKER cinematic still, volumetric fog, rim light',
  // A prompt that quotes an apology must survive: it is not a refusal opener.
  'Customer support reply template: start with "I\'m sorry, I can\'t process that order" and offer a refund',
  // A short raw prompt may legitimately refine to something short.
  'cat',
];
for (const text of KEEP_CASES) {
  check(`keep ${JSON.stringify(text.slice(0, 30))}`, () => {
    const got = enhancementRejectReason(text, 'cat');
    return got === null ? [] : [`rejected as ${got}`];
  });
}
check('long refusal with no opener phrase is caught by the ratio rule', () => {
  const text = 'That request is disallowed. '.repeat(20);
  const got = enhancementRejectReason(text, 'x '.repeat(900));
  return got === 'too_short' ? [] : [`got ${got}`];
});
check('a real long enhancement is not caught by the ratio rule', () => {
  const text = 'A red fox stepping through deep snow at dawn, low golden rim light, breath visible, 85mm lens, shallow depth of field, photorealistic, ultra-detailed.';
  const raw = 'a fox in snow';
  return enhancementRejectReason(text, raw) === null ? [] : [`rejected as ${enhancementRejectReason(text, raw)}`];
});

console.log(failed ? `\nFAIL ${failed} case(s) in ${file}` : `\nPASS all cases in ${file}`);
process.exit(failed ? 1 : 0);