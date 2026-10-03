/**
 * Bridges the existing lora-compat.js verdicts onto the redesign's Tier type.
 *
 * Three levels, strongest first:
 *   verified   this exact model + LoRA pair produced a real image in a live run
 *              (lib/loraFormats CONFIRMED_LORA_RUNS). Unambiguous.
 *   likely     same family and pipeline, tolerating minor version drift. This
 *              is lora-compat's own reasoning and is unchanged.
 *   no         family mismatch, pipeline mismatch, or a major version gap.
 *
 * lora-compat returns 'no' for incompatible; the redesign calls that
 * 'unsupported'. The logic is NOT reimplemented, only the name mapped, so the
 * existing curated tiers keep behaving exactly as before.
 */
import { modelTierForLora } from '../lora-compat';
import { isConfirmed } from './loraFormats';
import type { App } from './loraFormats';
import type { Lora, Model, Tier } from './types';

const toTier = (t: string): Tier => (t === 'no' ? 'unsupported' : (t as Tier));

/** Best tier for `model` across the pinned adapters. */
export function tierFor(model: Model | null, loras: Lora[], app: App = 'muapi'): Tier {
  if (!model || !loras.length) return 'likely';
  let best: Tier = 'unsupported';
  for (const l of loras) {
    if (isConfirmed(app, model.id, l.id)) return 'verified';
    const t = toTier(modelTierForLora(l.entry, model._row ?? model, model.id));
    if (t === 'verified') return 'verified';
    if (t === 'likely') best = 'likely';
  }
  return best;
}

/** Tier for one adapter against one model, for the dialog's per-row badge. */
export function tierForOne(model: Model | null, lora: Lora, app: App = 'muapi'): Tier {
  if (!model) return 'likely';
  if (isConfirmed(app, model.id, lora.id)) return 'verified';
  return toTier(modelTierForLora(lora.entry, model._row ?? model, model.id));
}