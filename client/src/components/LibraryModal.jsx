import { useEffect, useState } from 'react';
import { TEMPLATES } from '../enhancer';

// Templates + saved prompts in one modal with tabs.
// Props: open, tab ('templates'|'saved'), onTab, onApply({prompt, model, params}), onClose, notify.
export default function LibraryModal({ open, tab, onTab, onApply, onClose, notify }) {
  const [saved, setSaved] = useState([]);

  useEffect(() => {
    if (open && tab === 'saved') {
      try {
        setSaved(JSON.parse(localStorage.getItem('wavespeed_saved') || '[]'));
      } catch {
        setSaved([]);
      }
    }
  }, [open, tab]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose}></div>
      <div className="relative bg-gray-950 border border-gray-700 rounded-xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex gap-1.5">
            <button type="button" onClick={() => onTab('templates')}
              className={`text-xs px-3 py-1.5 rounded-full border ${tab === 'templates' ? 'bg-violet-600 border-violet-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-400'}`}>
              <i className="fas fa-layer-group mr-1.5"></i>Templates
            </button>
            <button type="button" onClick={() => onTab('saved')}
              className={`text-xs px-3 py-1.5 rounded-full border ${tab === 'saved' ? 'bg-violet-600 border-violet-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-400'}`}>
              <i className="fas fa-bookmark mr-1.5"></i>Saved
            </button>
          </div>
          <button type="button" onClick={onClose} aria-label="Close library" className="w-8 h-8 rounded-lg bg-gray-900 border border-gray-700 text-gray-400 hover:text-white">
            <i className="fas fa-times text-xs"></i>
          </button>
        </div>
        {tab === 'templates' ? (
          <div className="space-y-2">
            {TEMPLATES.map((t) => (
              <button key={t.name} type="button"
                onClick={() => { onApply({ prompt: t.prompt, model: t.model, params: t.params }); onClose(); notify && notify(`Template applied: ${t.name}`, 'success'); }}
                className="flex items-center gap-3 w-full p-3 rounded-lg bg-gray-900/50 hover:bg-gray-800/50 text-left">
                <i className={`fas ${t.icon} text-violet-400 w-5 text-center`}></i>
                <span className="text-sm text-gray-300">{t.name}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {saved.length === 0 && <p className="text-xs text-gray-600 py-4 text-center">No saved prompts.</p>}
            {saved.map((s, i) => (
              <button key={i} type="button"
                onClick={() => { onApply({ prompt: s.prompt, model: s.model, params: s.params }); onClose(); }}
                className="block w-full p-2.5 rounded-lg bg-gray-900/50 hover:bg-gray-800/50 text-left">
                <div className="text-xs text-gray-300 truncate">{(s.prompt || '').substring(0, 80)}…</div>
                <div className="text-[10px] text-gray-600 mt-1">{s.model || 'N/A'} · {s.time ? new Date(s.time).toLocaleDateString() : ''}{s.kind === 'enhanced' ? ' · enhanced' : ''}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
