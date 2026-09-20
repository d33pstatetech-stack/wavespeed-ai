import { useEffect, useState } from 'react';
import { rateJob, saveOutputs } from '../api';

function isVideoUrl(u) {
  return /\.(mp4|webm|mov)$/i.test(u || '') || (u || '').includes('video');
}

// Output card: media + meta + rating + R2 archive status.
export default function OutputCard({ result, modelId, notify }) {
  const [rating, setRating] = useState(0);
  const [arch, setArch] = useState(null); // { ok, total, firstErr } | { failed:true }

  if (!result?.outputs?.length) return null;
  const url = result.outputs[0];
  const video = isVideoUrl(url);
  const costStr = result.cost?.amount_usd ? `$${Number(result.cost.amount_usd).toFixed(4)}` : 'N/A';

  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      notify && notify(`${label} copied`, 'success');
    } catch {
      notify && notify('Copy failed', 'error');
    }
  };

  const rate = async (n) => {
    try {
      const j = await rateJob({ externalJobId: result.requestId, rating: n });
      if (j && j.error) throw new Error(j.error);
      setRating(n);
      notify && notify(`Rated ${n}★ — saved to shared history`, 'success');
    } catch (e) {
      notify && notify(`Rate failed: ${e.message}`, 'error');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs text-gray-500">Latest result</span>
        <div className="flex gap-1.5">
          <button type="button" onClick={() => copy(url, 'URL')} title="Copy URL" aria-label="Copy URL" className="w-8 h-8 rounded-lg bg-gray-900 border border-gray-700 text-gray-400 hover:text-white">
            <i className="fas fa-link text-xs"></i>
          </button>
          <a href={url} download title="Download" aria-label="Download" className="w-8 h-8 rounded-lg bg-gray-900 border border-gray-700 text-gray-400 hover:text-white inline-flex items-center justify-center">
            <i className="fas fa-download text-xs"></i>
          </a>
          <a href={url} target="_blank" rel="noreferrer" title="Open full size" aria-label="Open full size" className="w-8 h-8 rounded-lg bg-gray-900 border border-gray-700 text-gray-400 hover:text-white inline-flex items-center justify-center">
            <i className="fas fa-expand text-xs"></i>
          </a>
        </div>
      </div>
      {video ? (
        <video src={url} controls autoPlay loop className="w-full max-h-[500px] rounded-xl bg-black" />
      ) : (
        <img src={url} alt="Generated" className="w-full max-h-[500px] object-contain rounded-xl bg-black" />
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-gray-500">
        <span><i className="fas fa-clock mr-1"></i>{result.elapsed}s</span>
        <span><i className="fas fa-dollar-sign mr-1"></i>{costStr}</span>
        <span><i className="fas fa-images mr-1"></i>{result.outputs.length} output{result.outputs.length > 1 ? 's' : ''}</span>
        <span className="inline-flex items-center gap-0.5" title="Rate this generation">
          rate:
          {[1, 2, 3, 4, 5].map((i) => (
            <button key={i} type="button" onClick={() => rate(i)} title={`rate ${i}`} aria-label={`Rate ${i} stars`}
              style={{ color: i <= rating ? '#fbbf24' : '#52525b' }} className="text-xs px-px">★</button>
          ))}
        </span>
        <ArchStatus arch={arch} />
      </div>
      <ArchiveReporter result={result} modelId={modelId} notify={notify} onDone={setArch} />
    </div>
  );
}

function ArchStatus({ arch }) {
  if (!arch) return null;
  if (arch.failed) return <span className="text-red-400"><i className="fas fa-exclamation-triangle mr-1"></i>archive failed</span>;
  return (
    <span className="text-gray-500" title={arch.firstErr || undefined}>
      <i className="fas fa-cloud mr-1"></i>archived ✓ ({arch.ok}/{arch.total})
    </span>
  );
}

// Fire-and-forget R2 archival on mount; reports via onDone.
function ArchiveReporter({ result, modelId, notify, onDone }) {
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const urls = (result.outputs || []).filter((u) => typeof u === 'string' && /^https?:\/\//.test(u)).slice(0, 10);
        if (!urls.length) return;
        const j = await saveOutputs({ urls, model: modelId, jobId: result.requestId });
        if (!live) return;
        const ok = (j.saved || []).length;
        const firstErr = j.errors?.[0]?.error;
        onDone({ ok, total: urls.length, firstErr: firstErr ? String(firstErr).slice(0, 300) : null });
        if (!ok) notify && notify('R2 auto-archive failed' + (firstErr ? ': ' + String(firstErr).slice(0, 160) : ' — CDN link will expire!'), 'error');
      } catch {
        if (live) onDone({ failed: true });
      }
    })();
    return () => { live = false; };
  }, [result, modelId]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
