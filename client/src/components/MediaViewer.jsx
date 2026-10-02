// Media viewer modal: large preview + metadata sidebar.
// Props: url (string, media to show), item (object, metadata source — history
// entry or generation result; any fields may be missing), onClose().
// Renders only fields present on `item`; never crashes on missing data.
import { useEffect } from 'react';

function isVideoUrl(u) {
  try {
    return /\.(mp4|webm|mov)$/i.test(u || '') || (u || '').includes('video');
  } catch {
    return false;
  }
}

function fmtCost(item) {
  try {
    if (item?.cost && typeof item.cost === 'object' && item.cost.amount_usd != null) {
      const n = Number(item.cost.amount_usd);
      return Number.isFinite(n) ? `$${n.toFixed(4)}` : String(item.cost.amount_usd);
    }
    if (item?.cost != null && item.cost !== '') return String(item.cost).startsWith('$') ? String(item.cost) : `$${item.cost}`;
    if (item?.cost_hint) return String(item.cost_hint).slice(0, 200);
    return null;
  } catch {
    return null;
  }
}

function fmtTime(item) {
  try {
    return item?.time || item?.timestamp || item?.created_at || item?.updated_at || null;
  } catch {
    return null;
  }
}

function fmtModel(item) {
  try {
    return item?.model || item?.modelId || item?.target_model || null;
  } catch {
    return null;
  }
}

function fmtPrompt(item) {
  try {
    return item?.prompt || item?.raw_prompt || item?.enhanced || null;
  } catch {
    return null;
  }
}

function fmtParams(item) {
  try {
    const p = item?.params ?? item?.input ?? null;
    if (p == null) return null;
    if (typeof p === 'string') return p.slice(0, 4000);
    return JSON.stringify(p, null, 2).slice(0, 4000);
  } catch {
    return null;
  }
}

function fmtLoras(item) {
  try {
    const l = item?.loras ?? item?.loras_json ?? null;
    if (l == null || (typeof l === 'object' && Object.keys(l).length === 0)) return null;
    if (typeof l === 'string') return l.slice(0, 2000);
    return JSON.stringify(l, null, 2).slice(0, 2000);
  } catch {
    return null;
  }
}

function fmtRating(item) {
  try {
    const r = item?.rating;
    return typeof r === 'number' && Number.isFinite(r) ? r : null;
  } catch {
    return null;
  }
}

export default function MediaViewer({ url, item, onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const safeUrl = typeof url === 'string' ? url : '';
  const video = isVideoUrl(safeUrl);
  const prompt = fmtPrompt(item || {});
  const model = fmtModel(item || {});
  const params = fmtParams(item || {});
  const loras = fmtLoras(item || {});
  const rating = fmtRating(item || {});
  const cost = fmtCost(item || {});
  const timestamp = fmtTime(item || {});
  let elapsed = null;
  try {
    elapsed = item?.elapsed != null ? String(item.elapsed) : null;
  } catch {
    elapsed = null;
  }

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={() => onClose && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Media viewer"
    >
      <div
        className="panel !p-0 max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col md:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 min-w-0 bg-black flex items-center justify-center max-h-[50vh] md:max-h-[90vh]">
          {safeUrl ? (
            video ? (
              <video src={safeUrl} controls autoPlay loop className="w-full h-full max-h-[50vh] md:max-h-[90vh] object-contain" />
            ) : (
              <img src={safeUrl} alt="" className="w-full h-full max-h-[50vh] md:max-h-[90vh] object-contain" />
            )
          ) : (
            <p className="text-xs text-gray-500 p-8">No media URL.</p>
          )}
        </div>
        <aside className="w-full md:w-[300px] flex-none border-t md:border-t-0 md:border-l border-gray-800 p-4 overflow-y-auto max-h-[40vh] md:max-h-[90vh]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Details</span>
            <div className="flex gap-1.5">
              {safeUrl && (
                <>
                  <button
                    type="button"
                    onClick={() => copy(safeUrl)}
                    title="Copy URL"
                    aria-label="Copy URL"
                    className="w-7 h-7 rounded-lg bg-gray-900 border border-gray-700 text-gray-400 hover:text-white inline-flex items-center justify-center"
                  >
                    <i className="fas fa-link text-[11px]"></i>
                  </button>
                  <a
                    href={safeUrl}
                    download
                    title="Download"
                    aria-label="Download"
                    className="w-7 h-7 rounded-lg bg-gray-900 border border-gray-700 text-gray-400 hover:text-white inline-flex items-center justify-center"
                  >
                    <i className="fas fa-download text-[11px]"></i>
                  </a>
                  <a
                    href={safeUrl}
                    target="_blank"
                    rel="noreferrer"
                    title="Open full size"
                    aria-label="Open full size"
                    className="w-7 h-7 rounded-lg bg-gray-900 border border-gray-700 text-gray-400 hover:text-white inline-flex items-center justify-center"
                  >
                    <i className="fas fa-external-link-alt text-[11px]"></i>
                  </a>
                </>
              )}
              <button
                type="button"
                onClick={() => onClose && onClose()}
                title="Close"
                aria-label="Close"
                className="w-7 h-7 rounded-lg bg-gray-900 border border-gray-700 text-gray-400 hover:text-white inline-flex items-center justify-center"
              >
                <i className="fas fa-times text-[11px]"></i>
              </button>
            </div>
          </div>
          <div className="space-y-2.5 text-xs">
            {model && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">Model</p>
                <p className="font-mono text-gray-300 break-all">{String(model)}</p>
              </div>
            )}
            {prompt && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">Prompt</p>
                <p className="text-gray-300 whitespace-pre-wrap break-words">{String(prompt).slice(0, 2000)}</p>
              </div>
            )}
            {params && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">Params</p>
                <pre className="font-mono text-[11px] text-gray-400 bg-black/40 rounded-lg p-2 overflow-auto max-h-40 whitespace-pre-wrap break-all">{params}</pre>
              </div>
            )}
            {loras && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">LoRAs</p>
                <pre className="font-mono text-[11px] text-gray-400 bg-black/40 rounded-lg p-2 overflow-auto max-h-32 whitespace-pre-wrap break-all">{loras}</pre>
              </div>
            )}
            {rating != null && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">Rating</p>
                <p className="text-amber-300">{'★'.repeat(Math.max(0, Math.min(5, rating))) || `${rating}★`}</p>
              </div>
            )}
            {cost && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">Cost</p>
                <p className="font-mono text-violet-300">{cost}</p>
              </div>
            )}
            {elapsed && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">Elapsed</p>
                <p className="text-gray-300">{elapsed}s</p>
              </div>
            )}
            {timestamp && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">Timestamp</p>
                <p className="text-gray-300">{String(timestamp)}</p>
              </div>
            )}
            {!model && !prompt && !params && !loras && rating == null && !cost && !timestamp && !elapsed && (
              <p className="text-gray-600">No metadata on this item.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
