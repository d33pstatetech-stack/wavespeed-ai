// LoRA ↔ model compatibility — single source of truth for intelligent filtering.
// Tiers:
//   verified (green): the LoRA+model pair completed a real run
//     (VERIFIED_LORA_RUNS / central verifications), matched on NORMALISED names.
//   likely (yellow): suspected compatible — curated exact target, same family +
//     pipeline, tolerating minor version drift (wan 2.1 vs 2.2).
//   no (red): incompatible — family mismatch, pipeline mismatch, or a major
//     version gap (wan 2.x vs 3.x, FLUX.1 vs FLUX.2). Hidden unless the
//     picker's show-all is on.
import { VERIFIED_LORA_RUNS } from './loras-data.js';

// Central override (Phase A). App sets this from GET /api/loras/verifications
// (filtered to app==='wavespeed', mapped to {lora, model, job, when}). When
// non-empty the verified tier reads it FIRST; when absent/empty the baked
// VERIFIED_LORA_RUNS is used unchanged, so behaviour is identical offline.
let centralVerified = null;
export function setCentralVerified(rows) {
  centralVerified = Array.isArray(rows) && rows.length ? rows : null;
}
export function getCentralVerified() {
  return centralVerified;
}

/* ------------------------------------------------------------------
   normName — the ONE normalisation behind every identity comparison.

   Why it exists: providers spell the same model half a dozen ways
   (`flux 2 klein 9b`, `flux2_klein-9b`, `flux.2-klein9b`, `flux-2-klein-9b`).
   With strict `===` an adapter that demonstrably works never lines up with
   the model it was proven against, so it can never reach green.

   Rule: lowercase, then collapse every run of `.`, `-`, `_` and whitespace
   into a SINGLE SPACE.

   Separators are collapsed, not deleted, on purpose. Collapsing makes
   `flux 2` and `flux2` agree; deleting would also glue genuinely distinct
   tokens together (`flux 2` + `9b` -> `flux29b`), which is exactly the kind
   of false positive this classifier must not produce.

   Everything else is preserved verbatim: the `/` in `owner/repo` provider ids
   (it is a real structural boundary, not decoration) and the `:` in
   `civitai:<id>`.
   ------------------------------------------------------------------ */
export function normName(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[.\-_\s]+/g, ' ')
    .trim();
}

/* ------------------------------------------------------------------
   One family ladder, shared by both directions.

   Sharing matters: if the LoRA side and the model side could classify the
   same string differently, every verdict would be a coin flip.

   FLUX is split by major version. FLUX.1 and FLUX.2 are different
   architectures — a FLUX.1 adapter does not load on a FLUX.2 checkpoint —
   so they are separate buckets and familyOk refuses the pair outright
   instead of waving it through as "same family". A FLUX name carrying no
   version at all (`flux-dev`, `flux-schnell`) is FLUX.1: every versionless
   FLUX model in these catalogues is one.

   Krea is deliberately ONE bucket. Every Krea checkpoint in existence is v2,
   so there is no 1-vs-2 break to detect; `krea 2` and `krea2` agree here
   because normName folds the separator, and parseVer gives them the same
   version so versionGap never trips on them either.

   NOTE: flux is tested before krea — flux-krea-dev is FLUX architecture.
   ------------------------------------------------------------------ */
// Which FLUX generation a name declares, as the digit the word "flux" is
// immediately followed by — and only 1 or 2 count.
//
// Restricting it to [12] is the whole point. An earlier draft read the run of
// digits after "flux" as the version, which mis-read `hyper-flux-16step` as
// "FLUX 16", `fofr/flux-2004` as "FLUX 2004" and `igorriti/flux-360` as
// "FLUX 360", then shipped ~20 real FLUX.1 finetunes to the FLUX.2 bucket and
// hid every FLUX.1 adapter from every FLUX.2 model. Those are all step counts,
// years and pixel counts, not generations. A real generation marker is a bare
// `flux-1` / `flux-2`, and nothing else.
const FLUX_GEN = /\bflux\s?v?([12])(?![0-9])/;

function familyOf(raw) {
  const s = normName(raw);
  if (!s) return null;
  if (s.includes('flux')) {
    const m = FLUX_GEN.exec(s);
    return m && m[1] === '2' ? 'FLUX.2' : 'FLUX.1';
  }
  if (s.includes('qwen')) return 'Qwen-Image';
  if (s.includes('krea')) return 'Krea';
  if (/wan\s?2\s?1/.test(s)) return 'Wan 2.1';
  if (/wan\s?2\s?2/.test(s)) return 'Wan 2.2';
  if (s.includes('wan')) return 'Wan (other)';
  return null;
}

export function loraFamily(l) {
  return familyOf(String(l?.base_model || '')) || 'Other / unstamped';
}

export function modelFamily(model) {
  if (!model) return null;
  return familyOf(modelString(model));
}

export function modelIsVideo(model) {
  if (!model) return false;
  return /video/i.test([model.group_of, model.group, model.category].filter(Boolean).join(' '));
}

export function filterLoras(list, model, modelId) {
  const src = Array.isArray(list) ? list : [];
  if (!model && !modelId) {
    return {
      shown: src.map((lora) => ({ lora, tier: 'likely' })),
      hidden: 0, hiddenItems: [], family: null, exact: 0,
    };
  }
  const shown = [];
  const hiddenItems = [];
  let exact = 0;
  for (const lora of src) {
    const tier = compatibility(lora, model, modelId);
    if (tier === 'verified') exact += 1;
    (tier === 'no' ? hiddenItems : shown).push({ lora, tier });
  }
  // Verified first, then likely — stable within tiers.
  shown.sort((a, b) => (a.tier === b.tier ? 0 : a.tier === 'verified' ? -1 : 1));
  return {
    shown, hidden: hiddenItems.length, hiddenItems,
    family: modelFamily(model), exact,
  };
}

// Tier for one LoRA against the selected model.
//
// Every identity test below runs on normName(...) values, so a pair matches
// regardless of which side the separator style came from. The three tiers stay
// ordered: a real run beats a curated target, a curated target beats inference.
export function compatibility(lora, model, modelId) {
  if (!lora) return 'no';
  const lid = normName(lora.id);
  const mid = normName(modelId);
  const verifiedTable = (centralVerified && centralVerified.length ? centralVerified : VERIFIED_LORA_RUNS) || [];
  if (mid && verifiedTable.some((v) => normName(v.lora) === lid && normName(v.model) === mid)) {
    return 'verified';
  }
  // Curated exact target always trusted (ranked likely until a run verifies it).
  // All provider keys are checked — id schemes never collide across providers.
  if (mid && ['muapi_model', 'replicate_model', 'wavespeed_model'].some((k) => lora[k] && normName(lora[k]) === mid)) return 'likely';
  const fam = modelFamily(model);
  if (fam && !familyOk(lora, fam, modelString(model))) return 'no';
  if ((lora.pipeline === 'video-generation') !== modelIsVideo(model)) return 'no';
  if (versionGap(lora.base_model, modelString(model)) === 'major') return 'no';
  return 'likely';
}

// Reverse direction: tier of a MODEL against one LoRA, for LoRA-first
// selection (pin a LoRA → the model list shows its compatibles). Ambiguity
// errs toward showing: an unknown model family can never hide a model — only
// a definite mismatch (known family clash, known pipeline clash, major
// version gap) filters one out.
export function modelTierForLora(lora, model, modelId) {
  const t = compatibility(lora, model, modelId);
  if (t !== 'no') return t;
  if (!modelFamily(model)) return 'likely';
  return 'no';
}

// Best tier of each model across several focus LoRAs. Empty focus =
// unfiltered (every model 'likely', preserving current behavior).
export function filterModels(models, focusLoras) {
  const src = Array.isArray(models) ? models : [];
  const focus = Array.isArray(focusLoras) ? focusLoras.filter(Boolean) : [];
  if (!focus.length) {
    return { shown: src.map((model) => ({ model, tier: 'likely' })), hidden: 0, hiddenItems: [] };
  }
  const shown = [];
  const hiddenItems = [];
  for (const model of src) {
    let best = 'no';
    for (const lora of focus) {
      const t = modelTierForLora(lora, model, model.id);
      if (t === 'verified') { best = 'verified'; break; }
      if (t === 'likely') best = 'likely';
    }
    (best === 'no' ? hiddenItems : shown).push({ model, tier: best });
  }
  // Verified first, then likely — stable within tiers.
  shown.sort((a, b) => (a.tier === b.tier ? 0 : a.tier === 'verified' ? -1 : 1));
  return { shown, hidden: hiddenItems.length, hiddenItems };
}

// Same family, or Wan cross-minor drift (2.1 LoRA on 2.2 and vice versa).
// Major gaps (2.x vs 3.x) stay incompatible.
//
// Note what is NOT tolerated here, unlike Wan: FLUX.1 and FLUX.2 land in
// different buckets and fall through to `false`. Wan shares one transformer
// lineage across minors; FLUX 1 -> 2 is an architecture change, and a
// cross-generation adapter does not fit.
function familyOk(lora, fam, modelStr) {
  const lf = loraFamily(lora);
  if (lf === fam) return true;
  if (/^Wan /.test(lf) && /^Wan /.test(fam || '')) {
    return versionGap(lora.base_model, modelStr) !== 'major';
  }
  return false;
}

function modelString(model) {
  if (!model) return '';
  return [model.id, model.family, model.endpoint, model.name].filter(Boolean).join(' ');
}

// Parse a family version out of a LoRA base_model or a model id/name:
// { base, major, minor }.
//
// Runs on the NORMALISED string, so "wan2.1", "wan_2.1" and "wan 2 1" are all
// the same shape and the old dot-anchored regexes are no longer needed.
//
// Branch order is load-bearing and mirrors familyOf: flux before krea, because
// flux-krea-dev is a FLUX-architecture model that only borrows krea's name.
function parseVer(s) {
  const src = normName(s);
  // FLUX: only a bare 1 or 2 is a generation (see FLUX_GEN) — `flux-16step`,
  // `flux-2004`, `flux-360` carry no version at all, so they fall through to
  // null and versionGap reports 'unknown' rather than inventing a break.
  let m = FLUX_GEN.exec(src);
  if (m) return { base: 'flux', major: +m[1], minor: null };
  m = /krea\s?v?(\d+)(?![0-9])(?:\s?(\d+)(?![0-9]))?/.exec(src);
  if (m) return { base: 'krea', major: +m[1], minor: m[2] == null ? null : +m[2] };
  m = /wan\s?(\d+)(?![0-9])(?:\s?(\d+)(?![0-9]))?/.exec(src);
  if (m) return { base: 'wan', major: +m[1], minor: m[2] == null ? null : +m[2] };
  m = /qwen\s?image(?:\s?[a-z]+)?\s?(\d+)(?![0-9])(?:\s?(\d+)(?![0-9]))?/.exec(src);
  if (m) return { base: 'qwen-image', major: +m[1], minor: m[2] == null ? null : +m[2] };
  return null;
}

// 'same' | 'minor' | 'major' | 'unknown'. Small-integer majors (wan 2 vs 3,
// FLUX 1 vs 2) are a real arch break; large date-like versions (2511 vs 2512)
// are drift.
//
// The flux/krea branches above are what make FLUX.1 vs FLUX.2 report 'major'
// rather than 'unknown' — without them the pair slipped through both gates.
export function versionGap(loraBase, modelStr) {
  const a = parseVer(loraBase);
  const b = parseVer(modelStr);
  if (!a || !b || a.base !== b.base) return 'unknown';
  if (a.major !== b.major) return (a.major < 100 && b.major < 100) ? 'major' : 'minor';
  if ((a.minor ?? 0) !== (b.minor ?? 0)) return 'minor';
  return 'same';
}