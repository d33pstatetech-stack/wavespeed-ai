/**
 * Bridges the existing lora-compat.js verdicts onto the redesign's Tier type.
 *
 * lora-compat returns 'no' for incompatible; the redesign calls that
 * 'unsupported'. The logic itself is NOT reimplemented — the real tiers already
 * live in lora-compat.js and are driven by VERIFIED_LORA_RUNS plus the curated
 * per-provider target models.
 */
import { modelTierForLora } from '../lora-compat';
import type { Lora, Model, Tier } from './types';

const toTier = (t: string): Tier => (t === 'no' ? 'unsupported' : (t as Tier));

export function tierFor(model: Model | null, loras: Lora[]): Tier {
  if (!model || !loras.length) return 'likely';
  let best: Tier = 'unsupported';
  for (const l of loras) {
    const t = toTier(modelTierForLora(l.entry, model._row ?? model, model.id));
    if (t === 'verified') return 'verified';
    if (t === 'likely') best = 'likely';
  }
  return best;
}