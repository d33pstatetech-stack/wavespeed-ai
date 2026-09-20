import { useEffect, useState } from 'react';
import useLlmConfig from '../hooks/useLlmConfig';

// LLM fallback-chain settings modal. Props: open, onClose, notify.
export default function SettingsModal({ open, onClose, notify }) {
  const { load, save, EMPTY_ROW } = useLlmConfig();
  const [providers, setProviders] = useState([]);
  const [status, setStatus] = useState('');
  const [dragIdx, setDragIdx] = useState(null);

  useEffect(() => {
    if (open) load().then((cfg) => setProviders(cfg.providers.map((p) => ({ ...p }))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open ]);

  if (!open) return null;

  const edit = (i, k, v) => setProviders((ps) => ps.map((p, j) => (j === i ? { ...p, [k]: v } : p)));
  const remove = (i) => setProviders((ps) => {
    const next = ps.filter((_, j) => j !== i);
    return next.length ? next : [{ ...EMPTY_ROW, model: 'cognitivecomputations/dolphin-mistral-24b-venice-edition:free' }];
  });

  const doSave = async () => {
    const rows = providers.map((p, i) => ({ ...p, baseUrl: (p.baseUrl || '').trim(), model: (p.model || '').trim() }));
    // Keep masked keys: empty field over a "***" keeps the old value
    const cfg = await load();
    const merged = rows
      .map((p, i) => ({
        baseUrl: p.baseUrl || 'https://openrouter.ai/api/v1',
        model: p.model,
        apiKey: p.apiKey === '' && cfg.providers[i]?.apiKey === '***' ? '***' : p.apiKey,
      }))
      .filter((p) => p.model);
    if (!merged.length) {
      notify && notify('Add at least one model', 'error');
      return;
    }
    await save({ providers: merged });
    setStatus('Saved — will try backend sync, falls back to browser');
    setTimeout(() => setStatus(''), 2000);
    notify && notify('LLM settings saved', 'success');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose}></div>
      <div className="relative bg-gray-950 border border-gray-700 rounded-xl w-full max-w-xl max-h-[85vh] overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold">LLM Settings</h3>
          <button type="button" onClick={onClose} aria-label="Close settings" className="w-8 h-8 rounded-lg bg-gray-900 border border-gray-700 text-gray-400 hover:text-white">
            <i className="fas fa-times text-xs"></i>
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-3">Flat fallback chain — tried in order. Each row is provider + model. Drag to reorder. Keys are stored locally and on the server (masked when fetched).</p>
        <div className="space-y-2">
          {providers.map((p, i) => (
            <div key={i} draggable
              onDragStart={() => setDragIdx(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIdx == null || dragIdx === i) return;
                setProviders((ps) => {
                  const next = [...ps];
                  const [moved] = next.splice(dragIdx, 1);
                  next.splice(i, 0, moved);
                  return next;
                });
                setDragIdx(null);
              }}
              className="flex gap-2 items-start p-2 rounded-lg bg-gray-900/50 border border-gray-800">
              <span className="cursor-move text-gray-600 pt-2 flex-none"><i className="fas fa-grip-lines text-xs"></i></span>
              <div className="flex-1 space-y-1.5 min-w-0">
                <input value={p.baseUrl || ''} onChange={(e) => edit(i, 'baseUrl', e.target.value)} placeholder="https://openrouter.ai/api/v1" aria-label="Provider base URL" className="input !text-xs w-full" />
                <input value={p.model || ''} onChange={(e) => edit(i, 'model', e.target.value)} placeholder="model id" aria-label="Model id" className="input !text-xs w-full" />
                <input value={p.apiKey === '***' ? '' : p.apiKey || ''} onChange={(e) => edit(i, 'apiKey', e.target.value)} type="password"
                  placeholder={p.apiKey === '***' ? '•••• (saved, leave blank to keep)' : 'API key'} aria-label="API key" className="input !text-xs w-full" />
              </div>
              <button type="button" onClick={() => remove(i)} title="Remove" aria-label="Remove provider" className="w-8 h-8 rounded-lg bg-gray-900 border border-gray-700 text-red-500 flex-none">
                <i className="fas fa-trash text-xs"></i>
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setProviders((ps) => [...ps, { ...EMPTY_ROW }])} className="btn-secondary w-full mt-3">
          <i className="fas fa-plus mr-1"></i> Add model
        </button>
        {status && <div className="text-xs text-emerald-400 mt-2">{status}</div>}
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="button" onClick={doSave} className="btn-primary-sm">Save</button>
        </div>
      </div>
    </div>
  );
}
