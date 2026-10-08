/**
 * Real catalogue mapper for the WaveSpeed app.
 *
 * Turns the D1 `models` rows served by the Worker into the shape the UI wants.
 * Every field has a real source; anything the mockup invented is absent.
 */
import { modelFamily, modelIsVideo } from '../lora-compat';
import { isLoraParam } from '../params';
import type { Model, ModelSchema, ParamSpec } from './types';

/* WaveSpeed's `group_of` uses MuAPI's vocabulary ("video-edit", "image-tools",
   "music", "avatar"…), finer than the five media types the filter offers.
   Keyword match beats dropping rows into "other". */
const GROUP_RULES: [RegExp, Model['group']][] = [
  [/3d|three[-_ ]?d|mesh|voxel/i, '3d'],
  [/video|animate|motion|t2v|i2v|v2v|avatar|lip[-_ ]?sync|talking|face[-_ ]?dance/i, 'video'],
  [/audio|speech|voice|sound|music|song|tts|stt|sing|sfx|transcri/i, 'audio'],
  [/image|picture|photo|draw|paint|illustrat|upscal|restor|enhanc|background|remove|edit|face|inpaint|logo|icon|render|thumbnail|text[-_ ]?to[-_ ]?image/i, 'image'],
  [/text|llm|chat|prompt|seo|translat|summar|classif|extract|ocr|spell|grammar|rewrit/i, 'text'],
  [/publish|instagram|tiktok|pinterest|linkedin|threads|youtube|facebook|twitter|social/i, 'text'],
];

export function normalizeGroup(row: Row): Model['group'] {
  const hay = [row.group_of, row.category, row.family, row.id, row.name].filter(Boolean).join(' ');
  for (const [re, g] of GROUP_RULES) if (re.test(hay)) return g;
  return modelIsVideo(row) ? 'video' : 'image';
}

export type Stats = Map<string, { runs: number; rating: number | null }>;

/**
 * The `body.modality` the enhance request sends, or null when this model is
 * neither image nor video (audio/3d/text/"Other" — the Worker has no
 * image/video template to override, so it should derive the media type itself).
 */
export function modelModality(m: Model | null): 'image' | 'video' | null {
  if (!m) return null;
  if (m.group === 'video') return 'video';
  if (m.group === 'image') return 'image';
  return null;
}

export function toModel(row: Row, stats?: Stats): Model {
  const s = stats?.get(row.id);
  return {
    id: row.id,
    name: row.name || row.id,
    family: row.family || '',
    category: row.category || '',
    group: normalizeGroup(row),
    cost: Number(row.cost) || 0,
    dynamicPricing: !!Number(row.dynamic_pricing),
    runs: s?.runs ?? 0,
    rating: s?.rating ?? null,
    summary: row.description || '',
    loraCapable: false,
    durationHint: undefined,
    baseFamily: modelFamily(row) || '',
    _row: row,
  };
}

/**
 * Fills the two schema-derived fields once the real param schema arrives.
 *
 * `loraCapable` — true when the schema declares an adapter parameter. The gate
 *                 is params.js isLoraParam, imported rather than copied: a
 *                 second copy is how this drifted in the first place. It is
 *                 type-aware, so a numeric `lora_rank` on a trainer is no
 *                 longer read as an adapter slot, and a string `lora_weights`
 *                 no longer gets vetoed for containing the word "weight".
 * `durationHint` — derived from the schema's own `duration` parameter, which 416
 *                 models declare. Rendered from real min/max/default, e.g. a
 *                 range of 4-30 with a default of 5 becomes "5s (4-30s)". Models
 *                 without that parameter get no hint rather than a guess.
 */
export function applySchema(model: Model, schema: ModelSchema | null): Model {
  if (!schema) return model;
  const hasLora = Object.entries(schema.params).some(([name, spec]) => isLoraParam(name, spec as any));
  const durationHint = durationOf(schema.params);
  return { ...model, loraCapable: hasLora, durationHint };
}

function durationOf(params: Record<string, ParamSpec>): string | undefined {
  const spec = params?.duration;
  if (!spec || spec.type !== 'number' && spec.type !== 'integer') return undefined;
  const def = Number((spec as any).default);
  const lo = Number((spec as any).min ?? (spec as any).minimum);
  const hi = Number((spec as any).max ?? (spec as any).maximum);
  if (Number.isFinite(def)) {
    const range = Number.isFinite(lo) && Number.isFinite(hi) && lo !== hi ? ` (${lo}-${hi}s)` : '';
    return `${def}s${range}`;
  }
  if (Number.isFinite(lo) && Number.isFinite(hi)) return `${lo}-${hi}s`;
  return undefined;
}

/* ------------------------------------------------------------------
   Tier A / Tier B — how much LoRA support a model actually has.

   Tier A  the provider's own schema declares an adapter param. Verified.
   Tier B  no adapter param in the schema, but the architecture is one this
           catalogue is known to serve adapters for. UNVERIFIED, opt-in only.
   none   no evidence at all. No LoRA UI.

   TIER_B_FAMILIES is EMPTY for WaveSpeed, and that is a result, not an omission.
   Queried live against the `wavespeed-models` D1 (1081 models, all with a
   schema). 74 declare an adapter param; the 11 that also declare a numeric
   `lora_rank` are trainers. Of the 63 inference Tier A models:

     wavespeed-ai/flux-2-klein-9b/text-to-image-lora   (loras)
     wavespeed-ai/wan-2.2/t2v-480p-lora                (loras + high/low noise)
     wavespeed-ai/qwen-image/text-to-image-lora        (loras)
     wavespeed-ai/minimax-h3/image-to-video-lora       (loras)
     pruna-ai/p-image/edit-lora                        (lora_weights)

   EVERY one has "lora" in its own id. WaveSpeed splits each architecture into
   a base endpoint and a separate `-lora` endpoint; that split only exists
   because the base endpoint does not take an adapter param. So the 92 base
   models in those 22 families are precisely the models an injected `extra_lora`
   would be rejected by, and they get no LoRA input at all.

   Dropped for weak evidence: every family outside that 22 (flux-3, wan-2.5+,
   seedance, hailuo, pixverse, nano-banana, …) has no adapter model at all in
   the catalogue, so nothing says the architecture supports one.
   ------------------------------------------------------------------ */
const TIER_B_FAMILIES: ReadonlySet<string> = new Set<string>([]);

export type LoraTier = 'A' | 'B' | null;

/** What the UI needs to render an unverified adapter slot, or null. */
export interface TierBLora {
  family: string;
  reason: string;
}

/**
 * Tier B eligibility: a family on the allow-list, no adapter param in this
 * model's own schema, and not a trainer (a trainer takes `lora_rank`, it does
 * not load one).
 */
export function tierBLoraFor(model: Model | null, schema: ModelSchema | null): TierBLora | null {
  if (!model || !schema) return null;
  if (Object.entries(schema.params).some(([n, s]) => isLoraParam(n, s as any))) return null;
  if (/train/i.test(model.id)) return null;
  if (!TIER_B_FAMILIES.has(model.family)) return null;
  return {
    family: model.family,
    reason: `The ${model.family} family serves adapters on other models in this catalogue, but ${model.name} declares no adapter parameter of its own.`,
  };
}

/**
 * Combined verdict, for the one line of copy the Composer shows.
 *
 * Derived from the schema rather than from `model.loraCapable`, so it cannot
 * disagree with `tierBLoraFor` about the same model.
 */
export function loraTier(model: Model | null, schema: ModelSchema | null): LoraTier {
  if (!model || !schema) return null;
  if (Object.entries(schema.params).some(([n, s]) => isLoraParam(n, s as any))) return 'A';
  return tierBLoraFor(model, schema) ? 'B' : null;
}

/** The adapter params this model's real schema declares. */
export function adapterParams(schema: ModelSchema | null): string[] {
  if (!schema) return [];
  return Object.entries(schema.params)
    .filter(([name, spec]) => isLoraParam(name, spec as any))
    .map(([name]) => name);
}

export interface Row {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  family: string | null;
  group_of: string | null;
  cost: number | null;
  dynamic_pricing: number | null;
  endpoint: string | null;
  is_active: number | null;
}