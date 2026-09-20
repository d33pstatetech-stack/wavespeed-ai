// Recent-generations grid (localStorage mirror, newest first).
export default function HistoryGrid({ items }) {
  if (!items.length) return <p className="text-xs text-gray-600 py-8 text-center">No generations yet.</p>;
  return (
    <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
      {items.slice(0, 20).map((h, i) => {
        const video = /\.(mp4|webm|mov)$/i.test(h.url || '');
        return (
          <a key={`${h.requestId}-${i}`} href={h.url} target="_blank" rel="noreferrer" title={`${h.model || ''} · ${h.time || ''}`}
            className="relative aspect-square rounded-lg overflow-hidden border border-gray-800 bg-gray-900 group">
            {video ? (
              <span className="w-full h-full flex items-center justify-center"><i className="fas fa-video text-gray-700"></i></span>
            ) : (
              <img src={h.url} alt="" loading="lazy" className="w-full h-full object-cover" />
            )}
            <span className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-colors">
              <i className={`fas ${video ? 'fa-play' : 'fa-expand'} text-white opacity-0 group-hover:opacity-100 text-sm`}></i>
            </span>
          </a>
        );
      })}
    </div>
  );
}
