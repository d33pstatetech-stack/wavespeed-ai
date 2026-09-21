import { useState } from 'react';
import { resolveLoraUrl } from '../api';

// Add-from-URL box: paste an HF/CivitAI model-card URL → preview → confirm.
// Props: onAdd(entry) — async, saves + returns; notify(msg, kind); defaultNsfw.
export default function AddLoraUrl({ onAdd, notify, defaultNsfw = false }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [pickIdx, setPickIdx] = useState(0);
  const [nsfw, setNsfw] = useState(defaultNsfw);
  const [saving, setSaving] = useState(false);

  const resolve = async () => {
    const u = url.trim();
    if (!u) return;
    setBusy(true);
    setPreview(null);
    try {
      const r = await resolveLoraUrl(u);
      setPreview(r);
      setPickIdx(0);
      setNsfw(!!r.nsfw);
    } catch (e) {
      notify && notify(e.message || 'Resolve failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!preview) return;
    const cands = preview.candidates || [];
    const pick = cands[pickIdx] || cands[0];
    if (!pick) {
      notify && notify('No file candidate to save', 'error');
      return;
    }
    const fileUrl = pick.file_url;
    const entry = {
      source: preview.source,
      repo: preview.repo,
      name: preview.name,
      file: pick.file,
      file_url: fileUrl,
      repo_url: preview.repo_url,
      base_model: preview.base_model || '',
      pipeline: preview.pipeline || 'text-to-image',
      triggers: preview.triggers || [],
      formats:
        preview.source === 'civitai'
          ? { muapi: `civitai:${preview.repo}@${(preview.version_note || '').match(/version (\d+)/)?.[1] || ''}` || fileUrl, replicate: fileUrl, wavespeed: fileUrl }
          : { muapi: fileUrl, replicate: fileUrl, wavespeed: fileUrl },
      version_note: preview.version_note || '',
      nsfw,
    };
    // CivitAI shorthand needs a version id; fall back to the file URL when unknown.
    if (preview.source === 'civitai' && !/civitai:\d+@\d+/.test(entry.formats.muapi)) entry.formats.muapi = fileUrl;
    setSaving(true);
    try {
      await onAdd(entry);
      setOpen(false);
      setUrl('');
      setPreview(null);
    } catch (e) {
      notify && notify(e.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="w-full text-[11px] px-2 py-2 rounded-lg border border-dashed border-gray-700 text-gray-400 hover:border-violet-500 hover:text-gray-200 min-h-[44px]">
        ＋ Add LoRA from HuggingFace / CivitAI URL
      </button>
    );
  }

  const cands = preview?.candidates || [];
  return (
    <div className="p-2 rounded-lg bg-gray-900/60 border border-gray-700 space-y-2">
      <div className="flex gap-1">
        <input className="input flex-1 !min-h-[44px] !text-[11px]" value={url} onChange={(e) => setUrl(e.target.value)}
          placeholder="huggingface.co/owner/repo or civitai.com/models/123…" aria-label="LoRA model card URL"
          onKeyDown={(e) => { if (e.key === 'Enter') resolve(); }} />
        <button type="button" onClick={resolve} disabled={busy || !url.trim()} className="btn-primary-sm flex-none">
          {busy ? '…' : 'Resolve'}
        </button>
        <button type="button" onClick={() => { setOpen(false); setPreview(null); }} className="btn-secondary flex-none" aria-label="Close">✕</button>
      </div>
      {preview && (
        <div className="space-y-1.5 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-200 truncate" title={preview.repo}>{preview.name}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-400 flex-none">{preview.source}</span>
          </div>
          {cands.length > 1 && (
            <div className="space-y-1">
              {cands.map((c, i) => (
                <label key={c.file} className="flex items-center gap-2 text-[11px] text-gray-300 cursor-pointer">
                  <input type="radio" checked={pickIdx === i} onChange={() => setPickIdx(i)} className="accent-purple-500" />
                  <span className="truncate font-mono" title={c.file_url}>{c.file}</span>
                  {c.recommended && <span className="text-[9px] text-emerald-300 flex-none">★ suggested</span>}
                </label>
              ))}
            </div>
          )}
          {cands.length <= 1 && preview.file && (
            <p className="font-mono text-gray-400 truncate" title={preview.file_url}>{preview.file}</p>
          )}
          <p className="text-gray-500">
            base: <span className="text-gray-300">{preview.base_model || 'unknown'}</span>
            {' · '}{(preview.triggers || []).length ? `triggers: ${(preview.triggers || []).join(', ')}` : 'no triggers found'}
          </p>
          {(preview.warnings || []).map((w) => (
            <p key={w} className="text-amber-300/90 text-[10px]">⚠ {w}</p>
          ))}
          <label className="flex items-center gap-1.5 text-[11px] text-gray-300 cursor-pointer">
            <input type="checkbox" checked={nsfw} onChange={(e) => setNsfw(e.target.checked)} className="accent-red-500" />
            NSFW (shows in the NSFW picker instead)
          </label>
          <button type="button" onClick={confirm} disabled={saving} className="btn-primary-sm w-full">
            {saving ? 'Saving…' : 'Confirm — add to library'}
          </button>
        </div>
      )}
    </div>
  );
}
