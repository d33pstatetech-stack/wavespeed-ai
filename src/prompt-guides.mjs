// Prompt Atlas guide resolution.
//
// Maps an app model row (id + family, as stored in the app's own `models`
// table) onto a row in the shared `prompt_guides` table, and returns the
// condensed `enhancer_md` block for injection into the /api/enhance system
// prompt.
//
// Two rules govern the mapping:
//
//  1. An exact version wins. A guide family can carry several versions
//     (flux -> 1-dev / 2-Klein), so the version is chosen by matching
//     version_match against the model id + family. FLUX.2 [klein] must get
//     the Klein guide, not the 1-dev guide, because their conventions are
//     opposite: 1-dev takes prose and rejects weight syntax; Klein takes
//     prose and rejects negative prompts *and* has no prompt upsampling.
//
//  2. Anything unmatched gets nothing. A wrong guide is worse than no guide
//     — it would tell the enhancer that a model supports syntax it does not.
//     `resolveGuideKey` returns null rather than guessing, and callers fall
//     back to their existing presets.
//
// Ordering matters: more specific families first, because "flux-2" also
// contains "flux" and "krea-2" contains neither but "krea" would.

/** Guide families, most specific first. Values are regex sources. */
const FAMILY_RULES = [
  ['krea-2', /krea/i],
  ['qwen-image', /qwen[-_. ]?image|qwen3[-_.]?image|text-to-image-2512/i],
  ['z-image', /z[-_. ]?image/i],
  ['sdxl', /sdxl|stable[-_. ]?diffusion[-_. ]?xl/i],
  ['flux', /flux/i],
  ['wan', /^wan|wan\d|wavespeed-ai\/wan/i],
  ['seedance', /seedance/i],
  ['ltx', /\bltx/i],
  ['kling', /kling/i],
  ['veo', /veo/i],
];

/* ------------------------------------------------------------------
   Models that must never receive a guide, even though their id matches a
   family rule. Each of these either has no meaningful prompt (a lora
   trainer, an upscaler, a watermark remover) or belongs to a different
   guide family than the id suggests. A wrong guide is worse than none —
   these fall through to MODEL_PRESETS instead.

   `*-lora-trainer`, `*video-upscaler`, `*-watermark-remover`,
   `*-avatar-*` and `*-motion-control` are utility endpoints, not text
   generators: they take no scene prompt, so per-model prompting rules
   are meaningless. `kontext` is a separate architecture from the FLUX
   text-to-image models whose guide would otherwise be applied.
   ------------------------------------------------------------------ */
const EXCLUDE_PATTERNS = [
  /lora[-_.]?trainer/i,
  /video[-_.]?upscaler/i,
  /watermark[-_.]?remover/i,
  /-avatar-/i,
  /motion[-_.]?control/i,
  /speech[-_.]?to[-_.]?video/i,
  /lipsync/i,
  /-character$/i,
  /\bpulid\b/i,
  /\bredux\b/i,
];

/** True when this model should never get a guide. */
export function isExcludedModel(modelId) {
  const id = String(modelId || '');
  if (!id.trim()) return true;
  return EXCLUDE_PATTERNS.some((re) => re.test(id));
}

/* ------------------------------------------------------------------
   Which modality each guide family documents. The Atlas has no image
   guide for Wan/Kling/Seedance/LTX/Veo and no video guide for the image
   families, so a family hit must be checked against the model's own
   modality. Without this, `wan2.5-text-to-image` (group_of = image)
   resolves to `wan/2`, which only exists as `video/wan/2` — a dead
   lookup that silently falls back at runtime.

   This is a family-level guard, so any future guide in a new modality
   needs an entry here.
   ------------------------------------------------------------------ */
const FAMILY_MODALITY = {
  flux: 'image',
  'krea-2': 'image',
  'qwen-image': 'image',
  sdxl: 'image',
  'z-image': 'image',
  wan: 'video',
  seedance: 'video',
  ltx: 'video',
  kling: 'video',
  veo: 'video',
};

/** Version pickers, keyed by guide family. Return the tab index to use. */
const VERSION_RULES = {
  flux: (hay) => {
    if (/klein/.test(hay)) return 1;                 // FLUX.2 [klein]
    // FLUX.2 non-Klein (dev/flex/pro) is a different architecture from
    // FLUX.1-dev: it takes structured prose and no weight syntax. The Atlas
    // has no guide for it, so decline rather than apply the 1-dev rules.
    if (/flux[-_. ]?2/.test(hay)) return null;
    if (/flux[-_. ]?3|flux\.?3/.test(hay)) return null; // no FLUX.3 guide
    return 0;                                          // FLUX.1 dev / schnell
  },
  'krea-2': (hay) => (/turbo/.test(hay) ? 1 : 0),
  'qwen-image': (hay) => (/[-_. ]3(?:\.\d+)?(?:[-_. ]|$)/.test(hay) ? 1 : 0),
  wan: (hay) => {
    // MANIFEST order is 2.1, 2.2, 2.5, 2.6, 2.7, 3.0 -> tabs 0..5.
    // Match the *minor* explicitly: an earlier revision keyed only on the
    // major digit sent wan2.1 to the 2.2 guide.
    const m = /wan[-_. ]?(\d)(?:\.(\d))?/i.exec(hay);
    if (!m) return 0;
    const key = m[2] !== undefined ? `${m[1]}.${m[2]}` : m[1];
    const tab = { '2.1': 0, '2.2': 1, '2.5': 2, '2.6': 3, '2.7': 4, '3.0': 5, '3': 5 }[key];
    // An unlisted minor version has no guide — decline instead of defaulting
    // to tab 0, which would assert the wrong version's conventions.
    return tab === undefined ? null : tab;
  },
  seedance: (hay) => (/[-_. ]2\.5(?:[-_. ]|$)/.test(hay) ? 1 : 0),
  ltx: (hay) => (/[-_. ]2\.5(?:[-_. ]|$)/.test(hay) ? 1 : 0),
  kling: (hay) => (/[-_. ]3(?:\.\d+)?(?:[-_. ]|$)/.test(hay) ? 1 : 0),
  veo: (hay) => {
    if (/[-_. ]3\.1(?:[-_. ]|$)/.test(hay)) return 2;
    if (/[-_. ]3(?:[^0-9.]|$)/.test(hay)) return 1;
    return 0;
  },
};

/**
 * Which guide family applies to this model, or null.
 * @param {string} modelId  e.g. "flux-2-klein-base-lora" or "wavespeed-ai/z-image/base-lora"
 * @param {string} family   the models.family column, e.g. "flux-2"
 */
export function resolveGuideFamily(modelId, family, modality) {
  if (isExcludedModel(modelId)) return null;
  const hay = `${modelId || ''} ${family || ''}`;
  if (!hay.trim()) return null;
  // When the caller's modality is known, a family documenting the *other*
  // modality is not a candidate — there is no matching row to look up.
  const want = modality === 'video' || modality === 'image' ? modality : null;
  const ok = (name) => !want || FAMILY_MODALITY[name] === want;
  for (const [name, re] of FAMILY_RULES) {
    // A family-column hit is authoritative; the id is a weaker fallback
    // because it contains the vendor prefix ("wavespeed-ai/qwen-...").
    if (ok(name) && family && re.test(family)) return name;
  }
  for (const [name, re] of FAMILY_RULES) {
    if (ok(name) && re.test(modelId || '')) return name;
  }
  return null;
}

/**
 * Full guide key for a model, or null when no guide applies.
 * @param {string} [modality] "image" | "video" — the model's group_of. Pass it
 *   whenever known; it prevents a video guide from being looked up for an
 *   image model (or vice versa), which resolves to a key that does not exist.
 * @returns {string|null} e.g. "flux/1"
 */
export function resolveGuideKey(modelId, family, modality) {
  const fam = resolveGuideFamily(modelId, family, modality);
  if (!fam) return null;
  const hay = `${modelId || ''} ${family || ''}`;
  const tab = VERSION_RULES[fam] ? VERSION_RULES[fam](hay) : 0;
  // A version picker may return null to decline: a newer major version with
  // no guide (e.g. FLUX.3) must fall back to the default preset rather than
  // inherit an older version's conventions.
  if (tab === null || tab === undefined) return null;
  return `${fam}/${tab}`;
}

/**
 * Look up the guide block for a model against a preloaded guide list.
 * `guides` is the array from GET /api/guides (or a D1 query), keyed by the
 * `group/model` portion of guide_key.
 *
 * @param {Array} guides   rows with guide_key + enhancer_md
 * @param {string} modelId
 * @param {string} family
 * @returns {{guide: object, block: string}|null}
 */
export function guideForModel(guides, modelId, family, modality) {
  if (!Array.isArray(guides) || !guides.length) return null;
  const fam = resolveGuideFamily(modelId, family, modality);
  if (!fam) return null;
  const hay = `${modelId || ''} ${family || ''}`;
  const tab = VERSION_RULES[fam] ? VERSION_RULES[fam](hay) : 0;
  if (tab === null || tab === undefined) return null;
  const want = `${fam}/${tab}`;
  const group = guides.length && String(guides[0].guide_key || '').includes('/')
    ? String(guides[0].guide_key).split('/')[0]
    : 'image';
  const guide = guides.find((g) => g.guide_key === `${group}/${want}` || g.guide_key === want);
  if (!guide || !guide.enhancer_md) return null;
  return { guide, block: guide.enhancer_md };
}