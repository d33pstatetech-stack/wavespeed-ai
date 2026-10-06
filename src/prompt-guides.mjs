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

/** Version pickers, keyed by guide family. Return the tab index to use. */
const VERSION_RULES = {
  flux: (hay) => {
    if (/klein/.test(hay)) return 1;                 // FLUX.2 [klein]
    if (/flux[-_. ]?3|flux\.?3/.test(hay)) return null; // no FLUX.3 guide — don't guess
    return 0;                                          // 1-dev / schnell / kontext
  },
  'krea-2': (hay) => (/turbo/.test(hay) ? 1 : 0),
  'qwen-image': (hay) => (/(?:^|[^0-9])3(?:\.|\b)|qwen-?image-?3/i.test(hay) ? 1 : 0),
  wan: (hay) => {
    // MANIFEST order is 2.1, 2.2, 2.5, 2.6, 2.7, 3.0 -> tabs 0..5.
    // Match the *minor* explicitly: an earlier revision keyed only on the
    // major digit sent wan2.1 to the 2.2 guide.
    const m = /wan[-_. ]?(\d)(?:\.(\d))?/i.exec(hay);
    if (!m) return 0;
    const key = m[2] !== undefined ? `${m[1]}.${m[2]}` : m[1];
    const tab = { '2.1': 0, '2.2': 1, '2.5': 2, '2.6': 3, '2.7': 4, '3.0': 5, '3': 5 }[key];
    return tab === undefined ? 0 : tab;
  },
  seedance: (hay) => (/2\.?5|25/.test(hay) ? 1 : 0),
  ltx: (hay) => (/2\.?5/.test(hay) ? 1 : 0),
  kling: (hay) => (/kling[-_. ]?3|(?:^|[^0-9])3\.0/.test(hay) ? 1 : 0),
  veo: (hay) => {
    if (/3\.?1/.test(hay)) return 2;
    if (/(?:^|[^0-9])3(?:\.0)?(?:[^0-9]|$)/.test(hay)) return 1;
    return 0;
  },
};

/**
 * Which guide family applies to this model, or null.
 * @param {string} modelId  e.g. "flux-2-klein-base-lora" or "wavespeed-ai/z-image/base-lora"
 * @param {string} family   the models.family column, e.g. "flux-2"
 */
export function resolveGuideFamily(modelId, family) {
  const hay = `${modelId || ''} ${family || ''}`;
  if (!hay.trim()) return null;
  for (const [name, re] of FAMILY_RULES) {
    // A family-column hit is authoritative; the id is a weaker fallback
    // because it contains the vendor prefix ("wavespeed-ai/qwen-...").
    if (family && re.test(family)) return name;
  }
  for (const [name, re] of FAMILY_RULES) {
    if (re.test(modelId || '')) return name;
  }
  return null;
}

/**
 * Full guide key for a model, or null when no guide applies.
 * @returns {string|null} e.g. "image/flux/1"
 */
export function resolveGuideKey(modelId, family) {
  const fam = resolveGuideFamily(modelId, family);
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
export function guideForModel(guides, modelId, family) {
  if (!Array.isArray(guides) || !guides.length) return null;
  const fam = resolveGuideFamily(modelId, family);
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