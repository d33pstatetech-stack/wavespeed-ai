import { useCallback, useEffect, useState } from 'react';
import { cloudFileUrl, cloudList, cloudResolve } from '../api';

function kindOf(key) {
  const m = String(key || '').toLowerCase().match(/\.([a-z0-9]{2,5})$/);
  const e = m ? m[1] : '';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'svg', 'bmp'].includes(e)) return 'image';
  if (['mp4', 'webm', 'mov', 'm4v'].includes(e)) return 'video';
  if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(e)) return 'audio';
  return 'other';
}

function fmtSize(b) {
  b = Number(b || 0);
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`;
  return `${(b / 1073741824).toFixed(2)} GB`;
}

const baseName = (key) => {
  const p = String(key || '').split('/');
  return p[p.length - 1] || key;
};

const FILTERS = [['all', 'All'], ['image', 'Images'], ['video', 'Videos'], ['audio', 'Audio']];

// R2 file picker modal. Props: open, onClose, onPick(url, key), notify.
export default function CloudPicker({ open, onClose, onPick, notify }) {
  const [prefix, setPrefix] = useState('');
  const [flat, setFlat] = useState(false);
  const [objects, setObjects] = useState([]);
  const [folders, setFolders] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState('');
  const [resolving, setResolving] = useState(false);

  const load = useCallback(async (px, fl, cur) => {
    setStatus('loading…');
    try {
      const d = await cloudList({ prefix: px, flat: fl, cursor: cur });
      setObjects((prev) => (cur ? [...prev, ...(d.objects || d.files || [])] : d.objects || d.files || []));
      setFolders(cur ? [] : d.folders || []);
      setCursor(d.cursor || null);
      setStatus('');
    } catch (e) {
      setStatus(`list failed: ${e.message}`);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setObjects([]);
      setSelected(null);
      setCursor(null);
      load(prefix, flat, null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open ]);

  if (!open) return null;

  const nav = (px) => {
    setPrefix(px);
    setSelected(null);
    setCursor(null);
    setObjects([]);
    load(px, flat, null);
  };

  const toggleFlat = () => {
    const f = !flat;
    setFlat(f);
    setSelected(null);
    setCursor(null);
    setObjects([]);
    load(prefix, f, null);
  };

  const crumbs = prefix.split('/').filter(Boolean);
  const shown = objects.filter((o) => filter === 'all' || kindOf(o.key) === filter);

  const useSelected = async () => {
    if (!selected) return;
    setResolving(true);
    setStatus('resolving…');
    try {
      const j = await cloudResolve(selected);
      if (!j.url) throw new Error(j.error || 'No URL returned');
      setStatus(`ready ✓ (${j.via || 'ok'}${j.expiresIn ? `, link valid ${Math.round(j.expiresIn / 3600)}h` : ''})`);
      onPick(j.url, selected);
      onClose();
    } catch (e) {
      setStatus(`resolve failed: ${e.message}`);
      notify && notify(`R2 resolve failed: ${e.message}`, 'error');
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose}></div>
      <div className="relative bg-gray-950 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-semibold"><i className="fas fa-cloud mr-2 text-violet-400"></i>R2 Storage</h3>
          <button type="button" onClick={onClose} aria-label="Close R2 picker" className="w-8 h-8 rounded-lg bg-gray-900 border border-gray-700 text-gray-400 hover:text-white">
            <i className="fas fa-times text-xs"></i>
          </button>
        </div>
        <div className="flex items-center gap-1.5 text-xs mb-2 flex-wrap">
          <button type="button" onClick={() => nav('')} className={`px-2 py-1 rounded ${!prefix ? 'bg-violet-600 text-white' : 'bg-gray-900 text-gray-400'}`}>root</button>
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span className="text-gray-600">/</span>
              <button type="button" onClick={() => nav(`${crumbs.slice(0, i + 1).join('/')}/`)}
                className="px-2 py-1 rounded bg-gray-900 text-gray-400 hover:text-white">{c}</button>
            </span>
          ))}
          <label className="ml-auto flex items-center gap-1.5 text-[11px] text-gray-500 cursor-pointer">
            <input type="checkbox" checked={flat} onChange={toggleFlat} className="accent-purple-500" /> flat
          </label>
        </div>
        <div className="flex gap-1.5 mb-2">
          {FILTERS.map(([id, label]) => (
            <button key={id} type="button" onClick={() => setFilter(id)}
              className={`text-[11px] px-2.5 py-1 rounded-full border ${filter === id ? 'bg-violet-600 border-violet-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-400'}`}>{label}</button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          {!flat && folders.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 mb-2">
              {folders.map((f) => (
                <button key={f} type="button" onClick={() => nav(f)}
                  className="rounded-lg bg-gray-900/70 border border-gray-800 p-2.5 text-center hover:border-violet-500">
                  <i className="fas fa-folder text-amber-400/80 text-lg"></i>
                  <div className="text-[10px] text-gray-400 truncate mt-1">{baseName(f.replace(/\/$/, ''))}</div>
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 content-start">
            {shown.map((o) => {
              const k = kindOf(o.key);
              const sel = selected === o.key;
              return (
                <button key={o.key} type="button" onClick={() => setSelected(o.key)} title={o.key}
                  className={`rounded-lg border overflow-hidden text-left bg-gray-900/60 ${sel ? 'border-violet-400 ring-1 ring-violet-500' : 'border-gray-800'}`}>
                  <div className="h-[104px] flex items-center justify-center bg-black/40 overflow-hidden">
                    {k === 'image' ? (
                      <img src={cloudFileUrl(o.key)} alt="" loading="lazy" className="w-full h-full object-cover" />
                    ) : k === 'video' ? (
                      <i className="fas fa-video text-gray-700 text-xl"></i>
                    ) : k === 'audio' ? (
                      <i className="fas fa-music text-gray-700 text-xl"></i>
                    ) : (
                      <i className="fas fa-file text-gray-700 text-xl"></i>
                    )}
                  </div>
                  <div className="p-1.5">
                    <div className="text-[10px] text-gray-300 truncate">{baseName(o.key)}</div>
                    <div className="text-[9px] text-gray-600">{fmtSize(o.size)}</div>
                  </div>
                </button>
              );
            })}
          </div>
          {shown.length === 0 && !status && <p className="text-xs text-gray-600 py-8 text-center">No files here.</p>}
          {cursor && (
            <button type="button" onClick={() => load(prefix, flat, cursor)} className="btn-secondary w-full mt-2 text-xs">
              Show more
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-800">
          <span className="text-[11px] text-gray-500 truncate flex-1">{status || selected || 'Select a file…'}</span>
          <button type="button" onClick={onClose} className="btn-secondary text-xs">Cancel</button>
          <button type="button" onClick={useSelected} disabled={!selected || resolving} className="btn-primary-sm text-xs">
            {resolving ? 'Resolving…' : 'Use file'}
          </button>
        </div>
      </div>
    </div>
  );
}
