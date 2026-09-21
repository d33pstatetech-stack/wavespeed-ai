import { useMemo, useState } from 'react';
import { NSFW_LORAS, USER_LORAS } from '../loras-data';
import { filterLoras, loraFamily, modelIsVideo } from '../lora-compat';
import { loraSlotCount } from '../params';
import AddLoraUrl from './AddLoraUrl';

const FAM_ORDER = { 'FLUX.1': 0, 'Qwen-Image': 1, Krea: 2, 'Wan 2.1': 3, 'Wan 2.2': 4, 'Wan (other)': 5, 'Other / unstamped': 6 };

function groupLabel(l) {
  return (l.pipeline === 'video-generation' ? '🎬 Video — ' : '🖼 Image — ') + loraFamily(l);
}

function triggers(l) {
  if (Array.isArray(l.triggers) && l.triggers.length) return l.triggers;
  if (l.instance_prompt) return [l.instance_prompt];
  return [];
}

function svcFormats(l) {
  const out = [];
  if (l.formats?.replicate) out.push(['R', l.formats.replicate]);
  if (l.formats?.wavespeed) out.push(['W', l.formats.wavespeed]);
  const m = l.formats?.muapi || l.civitai;
  if (m) out.push(['M', m]);
  return out;
}

// Priority order for WaveSpeed LoRA fields (mirrors vanilla findLoraFieldForCurrentModel).
function findLoraField(schema) {
  const params = schema?.params;
  if (!params) return null;
  for (const k of ['loras', 'lora_url', 'lora_list', 'lora_weights', 'extra_lora', 'lora_scale']) {
    if (params[k]) return k;
  }
  for (const k of Object.keys(params)) {
    if (k.toLowerCase().includes('lora')) return k;
  }
  return null;
}

// LoRA quick picker. variant: 'user' | 'nsfw'.
// Props: schema, model (record), modelId, params, onParams(mergeObj), notify,
// custom (user-added entries), onAddCustom(entry), onDeleteCustom(id).
export default function LoraPicker({ variant, schema, model, modelId, params, onParams, notify, custom, onAddCustom, onDeleteCustom }) {
  const [showAll, setShowAll] = useState(false);
  const customs = useMemo(() => {
    const all = Array.isArray(custom) ? custom : [];
    return all.filter((c) => (variant === 'nsfw' ? !!c.nsfw : !c.nsfw));
  }, [custom, variant]);
  const base = useMemo(
    () => (variant === 'nsfw' ? [...NSFW_LORAS].sort(nsfwSort) : [...USER_LORAS]),
    [variant],
  );
  const pool = useMemo(() => [...customs, ...base], [customs, base]);
  const filt = useMemo(() => filterLoras(pool, model, modelId), [pool, model, modelId]);
  const loras = showAll ? [...filt.shown, ...filt.hiddenItems] : filt.shown;
  const filtered = !showAll && filt.hidden > 0;
  const badge = variant === 'nsfw' ? `${loras.length}/${base.length} • NSFW` : `${loras.length}/${base.length} • HF`;
  const badgeCls = variant === 'nsfw' ? 'bg-red-700' : 'bg-purple-600';
  const loraField = findLoraField(schema);

  const TIER_DOT = {
    verified: ['bg-emerald-500', 'Verified — this LoRA completed a run on the selected model'],
    likely: ['bg-amber-400', 'Likely compatible — same family/pipeline, not yet run on this model'],
    no: ['bg-red-500', 'Incompatible with the selected model (visible via Show all)'],
  };

  const copy = async (t, label) => {
    try {
      await navigator.clipboard.writeText(t);
      notify && notify(`${label} copied`, 'success');
    } catch {
      notify && notify('Copy failed', 'error');
    }
  };

  const fill = (l, useFile) => {
    if (!modelId) {
      copy(l.repo_url, 'Repo URL');
      notify && notify('Select a model first — copied repo URL', 'error');
      return;
    }
    const field = findLoraField(schema);
    if (!field) {
      copy(l.repo_url, 'Repo URL');
      notify && notify('No LoRA field for this model — copied repo URL', 'error');
      return;
    }
    const spec = schema.params[field];
    if (spec?.type === 'array') {
      const direct = [l.repo_url, l.file_url].find((u) => u && /\.safetensors(\?|#|$)/i.test(u)) || l.repo_url;
      const cur = Array.isArray(params[field]) ? [...params[field]] : [];
      const same = (s) => String(s?.path ?? s ?? '').trim() === direct;
      if (cur.some(same)) {
        notify && notify('That LoRA is already in the slots', 'info');
        return;
      }
      const cap = loraSlotCount(spec);
      const emptyIdx = cur.findIndex((s) => !String(s?.path ?? s ?? '').trim());
      const entry = { path: direct, scale: 1.0 };
      if (emptyIdx >= 0) cur[emptyIdx] = entry;
      else if (cur.length < cap) cur.push(entry);
      else {
        notify && notify(`All ${cap} slots are full — clear one first`, 'error');
        return;
      }
      onParams({ [field]: cur });
      notify && notify(`Filled ${field} slot with LoRA (strength adjustable)`, 'success');
    } else {
      const value = field === 'lora_weights' || field === 'lora_url' ? l.file_url || l.repo_url : useFile ? l.file_url || l.repo_url : l.repo_url;
      onParams({ [field]: value });
      notify && notify(`Filled ${field} with LoRA`, 'success');
    }
    copy(useFile ? l.file_url || l.repo_url : l.repo_url, field);
  };

  let lastGroup = null;
  let lastCustom = null;
  return (
    <div>
      <AddLoraUrl onAdd={onAddCustom} defaultNsfw={variant === 'nsfw'} notify={notify} />
      <div className="flex items-center justify-between gap-2 mt-2">
        <span className={`text-[10px] text-white px-2 py-0.5 rounded-full ${badgeCls}`}>{badge}</span>
        {modelId && filt.family && (
          <span className="text-[10px] text-gray-500 truncate" title={`Showing LoRAs compatible with ${modelId}`}>
            {filt.exact > 0 ? `${filt.exact} verified · ` : ''}{filt.family}{modelIsVideo(model) ? ' · video' : ''}
          </span>
        )}
      </div>
      {modelId && (
        <p className="mt-1 text-[9px] text-gray-600">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1 align-middle"></span>verified
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400 ml-2 mr-1 align-middle"></span>likely
          {showAll && <><span className="inline-block w-2 h-2 rounded-full bg-red-500 ml-2 mr-1 align-middle"></span>incompatible</>}
        </p>
      )}
      {modelId && !loraField && (
        <p className="mt-1.5 text-[10px] text-amber-300/90">This model exposes no LoRA parameter — Fill buttons copy URLs only.</p>
      )}
      {filtered && (
        <label className="mt-1.5 flex items-center gap-1.5 text-[10px] text-gray-400 cursor-pointer">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="accent-purple-500" />
          Show all {base.length} ({filt.hidden} hidden by compatibility filter)
        </label>
      )}
      {showAll && filt.hidden > 0 && (
        <label className="mt-1.5 flex items-center gap-1.5 text-[10px] text-gray-400 cursor-pointer">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="accent-purple-500" />
          Showing all — uncheck to re-apply filter
        </label>
      )}
      <div className="space-y-2 mt-2.5 max-h-96 overflow-y-auto pr-0.5">
        {loras.map((item) => {
          const l = item.lora;
          const tier = item.tier;
          const [dotCls, dotTip] = TIER_DOT[tier] || TIER_DOT.likely;
          const g = variant === 'nsfw' ? groupLabel(l) : null;
          const head = g && g !== lastGroup ? ((lastGroup = g), true) : false;
          const chead = !!l.custom !== lastCustom ? ((lastCustom = !!l.custom), true) : false;
          const trigs = triggers(l);
          const svc = svcFormats(l);
          const pref = l.preferred || 'docs';
          return (
            <div key={l.id}>
              {chead && l.custom && <div className="text-[11px] font-bold text-violet-300 mt-2 mb-1 px-1">＋ Custom — added from URL</div>}
              {head && <div className="text-[11px] font-bold text-gray-300 mt-2 mb-1 px-1">{g}</div>}
              <div className="relative p-2 rounded-lg bg-gray-800/50 border border-gray-700" title={`${l.name} — ${l.base_model}`}>
                <span title={dotTip} className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${dotCls} ring-2 ring-gray-900 cursor-help`}></span>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs font-semibold text-gray-200 truncate" title={l.name}>{l.name}</span>
                      {l.private ? (
                        <span className="text-[9px] bg-amber-900/50 text-amber-300 border border-amber-800 px-1.5 py-0.5 rounded-full flex-none">Private</span>
                      ) : (
                        <span className="text-[9px] bg-emerald-900/30 text-emerald-300 border border-emerald-800 px-1.5 py-0.5 rounded-full flex-none">Public</span>
                      )}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5 truncate" title={`${l.id} · ${l.file}`}>{l.id} · {l.file}</div>
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-gray-500">Trigger{trigs.length > 1 ? 's' : ''}:</span>
                      {trigs.length ? (
                        <>
                          {trigs.map((t) => (
                            <code key={t} title="Trigger word — include in your prompt"
                              className="text-[11px] font-bold bg-fuchsia-900/40 border border-fuchsia-700 text-fuchsia-300 px-1.5 py-0.5 rounded">{t}</code>
                          ))}
                          <button type="button" onClick={() => copy(trigs.join(', '), `Trigger${trigs.length > 1 ? 's' : ''}`)} title="Copy trigger(s)"
                            className="w-6 h-6 rounded bg-gray-900 border border-gray-700 text-gray-400"><i className="fas fa-copy text-[9px]"></i></button>
                        </>
                      ) : (
                        <span className="text-[10px] text-gray-600 italic">No trigger — general style</span>
                      )}
                    </div>
                    {l.strength && <div className="text-[10px] text-gray-500 mt-0.5">★ suggested strength {l.strength} — put trigger(s) in your prompt</div>}
                    <div className="text-[10px] text-gray-400 mt-1 line-clamp-2" title={l.note}>{l.note}</div>
                    <div className="text-[10px] text-purple-300 mt-1" title="Recommended target">→ {l.suggested_target}</div>
                  </div>
                  <span className="flex flex-col items-end gap-1 flex-none">
                    <span className="text-[10px] text-gray-600" title={l.pipeline === 'video-generation' ? 'Video LoRA' : 'Image LoRA'}>
                      <i className={`fas ${l.pipeline === 'video-generation' ? 'fa-video' : 'fa-image'}`}></i>
                    </span>
                    {l.custom && (
                      <button type="button" onClick={() => onDeleteCustom && onDeleteCustom(l.customId, l.name)}
                        title="Remove this custom LoRA" className="text-[9px] text-gray-500 hover:text-red-400 underline">
                        Remove
                      </button>
                    )}
                  </span>
                </div>
                <div className="mt-2 space-y-1.5">
                  <div className="flex gap-1 items-center">
                    <span className="text-[9px] text-gray-500 w-14 flex-none" title="HuggingFace owner/repo short form">HF short</span>
                    <code className="flex-1 min-w-0 text-[10px] bg-gray-900 border border-gray-700 rounded px-2 py-1 truncate" title={l.repo_url}>{l.repo_url}</code>
                    <button type="button" onClick={() => copy(l.repo_url, 'Repo URL')} title="Copy repo URL" className="w-7 h-7 rounded bg-gray-900 border border-gray-700 text-gray-400 flex-none"><i className="fas fa-copy text-[10px]"></i></button>
                    <button type="button" onClick={() => fill(l, false)} title={pref === 'docs' ? '★ Preferred format — fills first empty slot' : 'Fill short form'}
                      className={`text-[10px] px-2 py-1 rounded-md font-semibold flex-none ${pref === 'docs' ? 'bg-violet-600 text-white border border-emerald-500' : 'bg-violet-600 text-white'}`}>{pref === 'docs' ? '★ ' : ''}Fill</button>
                  </div>
                  <div className="flex gap-1 items-center">
                    <span className="text-[9px] text-gray-500 w-14 flex-none" title="Direct .safetensors file URL">Direct file</span>
                    <code className="flex-1 min-w-0 text-[10px] bg-gray-900 border border-gray-700 rounded px-2 py-1 truncate" title={l.file_url}>{l.file_url}</code>
                    <button type="button" onClick={() => copy(l.file_url, 'File URL')} title="Copy .safetensors URL" className="w-7 h-7 rounded bg-gray-900 border border-gray-700 text-gray-400 flex-none"><i className="fas fa-file text-[10px]"></i></button>
                    <button type="button" onClick={() => fill(l, true)} title={pref === 'file' ? '★ Preferred format — fills first empty slot' : 'Fill direct file URL'}
                      className={`text-[10px] px-2 py-1 rounded-md flex-none border border-gray-700 bg-gray-800 text-gray-200 ${pref === 'file' ? '!border-emerald-500 !text-emerald-300' : ''}`}>{pref === 'file' ? '★ ' : ''}Fill file</button>
                  </div>
                  {svc.length > 0 && (
                    <div className="flex gap-1 items-center flex-wrap">
                      <span className="text-[9px] text-gray-500 w-14 flex-none" title="Per-service recommended strings — click a chip to copy">Services</span>
                      {svc.map(([tag, val]) => (
                        <button key={tag} type="button" onClick={() => copy(val, `${tag} string`)} title={`${val} — click to copy`}
                          className="text-[9px] px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-300">{tag}</button>
                      ))}
                      <span className="text-[9px] text-gray-600">R=Replicate · W=WaveSpeed · M=MuAPI</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function nsfwSort(a, b) {
  const ap = a.pipeline === 'video-generation' ? 1 : 0;
  const bp = b.pipeline === 'video-generation' ? 1 : 0;
  if (ap !== bp) return ap - bp;
  const af = FAM_ORDER[loraFamily(a)] ?? 9;
  const bf = FAM_ORDER[loraFamily(b)] ?? 9;
  if (af !== bf) return af - bf;
  return String(a.name || '').localeCompare(String(b.name || ''));
}
