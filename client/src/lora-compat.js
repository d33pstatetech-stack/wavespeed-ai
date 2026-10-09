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

// Central verifications (Phase A). App sets this from
// GET /api/loras/verifications (filtered to app==='wavespeed', mapped to
// {lora, model, job, when}). This table is ADDITIVE with the baked
// VERIFIED_LORA_RUNS below, not a replacement for it: compatibility() probes
// central first and falls back to the baked list, so a baked verified pair
// never stops being verified because central data arrived. Absent/empty means
// baked-only, so behaviour is identical offline.
let centralVerified = null;
export function setCentralVerified(rows) {
  centralVerified = Array.isArray(rows) ? rows : null;
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
// immediately followed by — and only 1, 2 or 3 count.
//
// Restricting it to a bare single digit is the whole point. An earlier draft
// read the run of digits after "flux" as the version, which mis-read
// `hyper-flux-16step` as "FLUX 16", `fofr/flux-2004` as "FLUX 2004" and
// `igorriti/flux-360` as "FLUX 360", then shipped ~20 real FLUX.1 finetunes to
// the FLUX.2 bucket and hid every FLUX.1 adapter from every FLUX.2 model.
// Those are all step counts, years and pixel counts, not generations.
//
// The `(?![0-9])` guard is what keeps those out now that 3 is recognised:
// `flux-16step`, `flux-2004`, `flux-360` and `flux-3000-steps` all start with a
// digit in [123] but continue, so they still carry no version at all and stay
// FLUX.1. A real generation marker is a bare `flux-1` / `flux-2` / `flux-3`
// and nothing else — `flux-1.1-pro` reads FLUX.1 via the same rule.
const FLUX_GEN = /\bflux\s?v?([123])(?![0-9])/;

function familyOf(raw) {
  const s = normName(raw);
  if (!s) return null;
  if (s.includes('flux')) {
    const m = FLUX_GEN.exec(s);
    // No version at all is FLUX.1: every versionless FLUX model in these
    // catalogues is one. A recognised generation keeps its own bucket.
    return m ? `FLUX.${m[1]}` : 'FLUX.1';
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
/* ------------------------------------------------------------------
   K5 — evidence from real, user-rated runs.

   GET /api/loras/evidence returns pairs that a person actually rated
   4-5★ with the adapter loaded. That is a stronger claim than any
   heuristic below it, so it promotes `likely` to `verified`.

   Why a separate store rather than setCentralVerified(): the evidence
   endpoint returns AGGREGATES (runs + avg_rating + a green flag) keyed
   two ways — the exact model id, and the model's last path segment for
   cross-provider transfer. It also has no `app` column, because evidence
   is deliberately provider-agnostic: a LoRA proven on wavespeed's
   flux-dev-lora is evidence about replicate's flux-dev-lora too. Folding
   that into the app-filtered central path would throw away the transfer.

   FAIL-SAFE. `null`/absent/empty means "no evidence" and every probe
   returns null, so compatibility() falls through to exactly the verdict
   it produced before this existed — byte-identical behaviour.
   ------------------------------------------------------------------ */
/** @type {{ exact: Map<string, Ev>, norm: Map<string, Ev> } | null} */
let runEvidence = null;

/** @typedef {{ runs: number, avg_rating: number, leaf: boolean }} Ev */

/**
 * Install evidence from GET /api/loras/evidence. `null` clears back to
 * baked-only, matching the setCentralVerified(null) contract.
 *
 * Only rows the server already flagged `green` are installed, so the
 * minimum-evidence rule (runs >= 2 AND at least one run where this was
 * the ONLY adapter loaded) lives in exactly one place — the Worker — and
 * all three clients cannot drift apart on it.
 */
export function setRunEvidence(payload) {
  if (!payload || typeof payload !== 'object') { runEvidence = null; return; }
  const exact = new Map();
  const norm = new Map();
  for (const p of Array.isArray(payload.pairs) ? payload.pairs : []) {
    if (!p || !p.green || !p.lora_id || !p.model) continue;
    exact.set(evidenceKey(p.model, p.lora_id), { runs: Number(p.runs) || 0, avg_rating: Number(p.avg_rating) || 0, leaf: false });
  }
  for (const n of Array.isArray(payload.norm) ? payload.norm : []) {
    if (!n || !n.green || !n.lora_id || !n.model_leaf) continue;
    norm.set(evidenceKey(n.model_leaf, n.lora_id), {
      runs: Number(n.runs) || 0,
      avg_rating: Number(n.avg_rating) || 0,
      leaf: true,
      // Full normalised model ids behind this leaf. Needed because the
      // leaf alone can lose the family token (`…/qwen-image/text-to-image-lora`
      // has no "qwen" in its leaf), so the family gate below cannot be
      // evaluated from the key alone.
      models: (Array.isArray(n.models) ? n.models : []).map((m) => normName(m)).filter(Boolean),
    });
  }
  runEvidence = exact.size || norm.size ? { exact, norm } : null;
}

/** Currently-installed evidence, or null. Exported for tests/diagnostics. */
export function getRunEvidence() {
  if (!runEvidence) return null;
  return { exact: runEvidence.exact, norm: runEvidence.norm };
}

/** `model|lora`, both normalised — the same key shape as above. */
function evidenceKey(modelId, loraId) {
  return `${normName(modelId)}|${normName(loraId)}`;
}

/**
 * Last path segment of a model id, normalised.
 * `wavespeed-ai/flux-dev-lora` and `black-forest-labs/flux-dev-lora` are one
 * base model behind two providers; only the leaf says so. This is the ONLY
 * thing cross-provider transfer keys on, and it is gated on a shared family
 * token below — so it can widen reach but never cross architectures.
 */
function modelLeafId(modelId) {
  const parts = String(modelId || '').split('/');
  // The digit split mirrors evModelLeaf() in the Worker exactly. normName folds
  // separators, so `flux-2-klein-9b` reads `flux 2 klein 9b` while the glued
  // `flux2_klein_9b` would read `flux2 klein 9b` and never match. Only here,
  // never in an identity comparison — `flux1dev` stays `flux 1dev`, shares no
  // key with `flux 2 klein 9b`, and the family gate below applies anyway.
  return normName(parts[parts.length - 1] || '').replace(/([a-z])(\d)/g, '$1 $2');
}

/**
 * Every hard veto, as one predicate, so the evidence probes and the
 * `likely` fallback can never disagree about what "definitely incompatible"
 * means. Same three tests, same order, as the fallback path.
 */
function hardVeto(lora, model) {
  const fam = modelFamily(model);
  if (fam && !familyOk(lora, fam, modelString(model))) return true;
  if ((lora.pipeline === 'video-generation') !== modelIsVideo(model)) return true;
  if (versionGap(lora.base_model, modelString(model)) === 'major') return true;
  return false;
}

/**
 * Evidence verdict for one LoRA+model pair, or null.
 *
 * Two lookups, in decreasing strength:
 *   exact — the same model id. No transfer, so the shared veto is the only gate.
 *   leaf  — a different provider's spelling of the same model. Additionally
 *           requires the evidence model and this model to name the SAME family,
 *           or nothing is promoted. That is what stops evidence for
 *           `flux 2 klein 9b` from reaching `flux1dev` while still letting it
 *           reach `flux2_klein_9b`.
 */
function evidenceFor(lora, model, modelId) {
  if (!runEvidence || !lora || !modelId) return null;
  if (hardVeto(lora, model)) return null; // never let evidence override a veto
  const hit = runEvidence.exact.get(evidenceKey(modelId, lora.id));
  if (hit) return hit;
  const leaf = modelLeafId(modelId);
  if (!leaf) return null;
  const row = runEvidence.norm.get(evidenceKey(leaf, lora.id));
  if (!row) return null;
  const fam = modelFamily(model);
  // Unknown family on this side: nothing to compare against, so no transfer.
  if (!fam) return null;
  const shares = (row.models || []).some((m) => modelFamily({ id: m }) === fam);
  if (!shares) return null;
  return row;
}

/**
 * Public evidence probe for the UI. Returns `{ runs, avg_rating, leaf }`
 * or null — the same object the tier promotion used, so a badge can say
 * "verified by 7 runs, avg 4.7★" instead of silently recolouring.
 */
export function evidenceVerdict(lora, model, modelId) {
  return evidenceFor(lora, model, modelId);
}

export function compatibility(lora, model, modelId) {
  if (!lora) return 'no';
  const lid = normName(lora.id);
  const mid = normName(modelId);
  // Central verifications first, baked VERIFIED_LORA_RUNS as a FALLBACK — the
  // additive shape replicate already uses. The previous ternary REPLACED the
  // table, so the moment /api/loras/verifications returned even one row every
  // baked entry disappeared: a silent shrink of the verified tier with no
  // error and no visible symptom. Both tables are probed, so a baked pair stays
  // green whether or not central data is installed.
  if (mid && centralVerified && centralVerified.some((v) => v && normName(v.lora) === lid && normName(v.model) === mid)) {
    return 'verified';
  }
  if (mid && (VERIFIED_LORA_RUNS || []).some((v) => normName(v.lora) === lid && normName(v.model) === mid)) {
    return 'verified';
  }
  // K5: a user-rated 4-5 star run with this adapter loaded outranks every
  // heuristic below. hardVeto() inside means a pair the family / pipeline /
  // version gates would call 'no' stays 'no' — evidence can promote 'likely'
  // to 'verified', never manufacture a green across a hard boundary. With no
  // evidence installed this is one null check and behaviour is unchanged.
  if (evidenceFor(lora, model, modelId)) return 'verified';
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