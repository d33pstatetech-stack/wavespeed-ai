// Recent-generations grid (localStorage mirror, newest first). Multi-output
// runs expand into one cell per output.
import { useState } from 'react';
import MediaViewer from './MediaViewer';

export default function HistoryGrid({ items }) {
  const [selected, setSelected] = useState(null); // { h, u } | null
  if (!items.length) return <p className="text-xs text-gray-600 py-8 text-center">No generations yet.</p>;
  const cells = [];
  items.slice(0, 20).forEach((h, i) => {
    const urls = Array.isArray(h.urls) && h.urls.length ? h.urls : [h.url];
    urls.forEach((u, j) => cells.push({ h, u, key: `${h.requestId}-${i}-${j}` }));
  });
  return (
    <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
      {cells.slice(0, 30).map(({ h, u, key }) => {
        const video = /\.(mp4|webm|mov)$/i.test(u || '');
        return (
          <button key={key} type="button" onClick={() => setSelected({ h, u })} title={`${h.model || ''} · ${h.time || ''}`}
            className="relative aspect-square rounded-lg overflow-hidden border border-gray-800 bg-gray-900 group text-left">
            {video ? (
              <span className="w-full h-full flex items-center justify-center"><i className="fas fa-video text-gray-700"></i></span>
            ) : (
              <img src={u} alt="" loading="lazy" className="w-full h-full object-cover" />
            )}
            <span className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-colors">
              <i className={`fas ${video ? 'fa-play' : 'fa-expand'} text-white opacity-0 group-hover:opacity-100 text-sm`}></i>
            </span>
          </button>
        );
      })}
      {selected && (
        <MediaViewer url={selected.u} item={{ ...(selected.h || {}), url: selected.u }} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
