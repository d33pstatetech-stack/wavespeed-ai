import { useState } from 'react';
import { streamEnhance } from '../api';
import { contextPreviewString, getEnhancerContext } from '../enhancer';

// Single streaming enhancer (used at every breakpoint — no desktop/mobile split).
// Props: model, params, onUse(text), notify, onEnhancement(id).
export default function Enhancer({ model, params, onUse, notify, onEnhancement }) {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [meta, setMeta] = useState('Select a model, enter a prompt, click Enhance.');
  const [busy, setBusy] = useState(false);

  const ctx = getEnhancerContext(model, params, {});

  const enhance = async () => {
    const raw = input.trim();
    if (!raw) {
      notify && notify('Enter a prompt to enhance', 'error');
      return;
    }
    if (!ctx?.model) {
      notify && notify('Select a model first', 'error');
      return;
    }
    setBusy(true);
    setOutput('');
    setMeta('● thinking — streaming tokens…');
    try {
      const r = await streamEnhance({
        rawPrompt: raw,
        modelId: ctx.model,
        params,
        onToken: setOutput,
        onMeta: ({ providerUsed, modelUsed, historyId, length }) =>
          setMeta(`via ${providerUsed} / ${modelUsed} — ${length} chars`),
      });
      setMeta(`via ${r.providerUsed} / ${r.modelUsed} — ${r.text.length} chars`);
      if (r.historyId && onEnhancement) onEnhancement(r.historyId);
      pushSaved({
        prompt: r.text,
        rawPrompt: raw,
        model: ctx.model,
        params: { ...params },
        kind: 'enhanced',
        time: new Date().toISOString(),
        provider: r.providerUsed,
        llmModel: r.modelUsed,
      });
      notify && notify('Enhanced ✓ streaming', 'success');
    } catch (e) {
      setMeta(`● error: ${e.message}`);
      notify && notify(`Enhance failed: ${e.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      notify && notify('Copied', 'success');
    } catch {
      notify && notify('Copy failed', 'error');
    }
  };

  const save = () => {
    if (!output) return;
    pushSaved({ prompt: output, model: model?.id, params: { ...params }, kind: 'enhanced', time: new Date().toISOString() });
    notify && notify('Saved', 'success');
  };

  return (
    <div>
      <p className="text-[11px] text-gray-500 mb-2">Refine your prompt for the selected model. Context is auto-filled.</p>
      <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Write a rough prompt to enhance…"
        aria-label="Rough prompt" className="prompt-textarea" style={{ minHeight: 80 }} />
      {ctx && <div className="text-[10px] text-gray-600 mt-2 p-2 rounded bg-gray-900/50 font-mono">{contextPreviewString(ctx)}</div>}
      <button type="button" onClick={enhance} disabled={busy} className="btn-primary-sm w-full mt-2">
        <i className={`fas ${busy ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'} mr-1`}></i>
        {busy ? 'Enhancing…' : 'Enhance — streaming'}
      </button>
      <div className="mt-3">
        <label className="text-[11px] text-gray-500" htmlFor="enhancerOut">Enhanced <span className="text-gray-600">(live stream)</span></label>
        <textarea id="enhancerOut" value={output} readOnly placeholder="Enhanced prompt will stream here token-by-token…"
          className="prompt-textarea mt-1" style={{ minHeight: 100 }} />
        <div className="flex gap-1.5 mt-2">
          <button type="button" onClick={() => output && onUse(output)} className="btn-primary-sm flex-1">
            <i className="fas fa-arrow-up mr-1"></i> Use as Prompt
          </button>
          <button type="button" onClick={copy} title="Copy" aria-label="Copy enhanced" className="w-8 h-8 rounded-lg bg-gray-900 border border-gray-700 text-gray-400 hover:text-white">
            <i className="fas fa-copy text-xs"></i>
          </button>
          <button type="button" onClick={save} title="Save" aria-label="Save enhanced" className="w-8 h-8 rounded-lg bg-gray-900 border border-gray-700 text-gray-400 hover:text-white">
            <i className="fas fa-bookmark text-xs"></i>
          </button>
        </div>
        <div className="text-[10px] text-gray-600 mt-1">{meta}</div>
      </div>
    </div>
  );
}

function pushSaved(entry) {
  try {
    const saved = JSON.parse(localStorage.getItem('wavespeed_saved') || '[]');
    saved.unshift(entry);
      localStorage.setItem('wavespeed_saved', JSON.stringify(saved.slice(0, 50)));
  } catch {
    /* storage blocked */
  }
}
