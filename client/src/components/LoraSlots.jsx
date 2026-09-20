import { useState } from 'react';
import Tip from './Tip';
import { loraHintText, loraSlotCount, loraTokenIssues } from '../params';

// Multi-slot LoRA editor: text inputs + strength sliders → [{path, scale}].
// Props: name, spec, value ([{path,scale}]), onChange(arr|undefined).
export default function LoraSlots({ name, spec, value, onChange }) {
  const n = loraSlotCount(spec);
  const [urlDrafts, setUrlDrafts] = useState({});

  const slots = Array.from({ length: n }, (_, i) => value?.[i] || { path: '', scale: 1 });

  const commit = (next) => {
    const arr = next.filter((s) => s.path.trim());
    onChange(arr.length ? arr.map((s) => ({ path: s.path.trim(), scale: s.scale })) : undefined);
  };

  const setPath = (i, path) => {
    const next = slots.map((s, j) => (j === i ? { ...s, path } : s));
    commit(next);
  };

  const setScale = (i, scale) => {
    const next = slots.map((s, j) => (j === i ? { ...s, scale } : s));
    commit(next);
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] text-gray-500">One LoRA per slot, strongest first.</span>
        <Tip text={loraHintText()} />
      </div>
      {slots.map((s, i) => {
        const warn = loraTokenIssues(s.path);
        return (
          <div key={i} className="rounded-lg bg-gray-900/60 border border-gray-800 p-2 space-y-1.5">
            <input
              type="text"
              value={urlDrafts[i] ?? s.path}
              onChange={(e) => {
                setUrlDrafts((d) => ({ ...d, [i]: e.target.value }));
                setPath(i, e.target.value);
              }}
              onBlur={() => setUrlDrafts((d) => {
                const c = { ...d };
                delete c[i];
                return c;
              })}
              placeholder={`LoRA ${i + 1}: full https://….safetensors URL or civitai:MODEL@VERSION`}
              aria-label={`LoRA ${i + 1} URL`}
              className="input !text-xs font-mono"
            />
            {s.path.trim() && warn && <p className="text-[11px] text-amber-400">{warn}</p>}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 flex-none">strength</span>
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={Math.min(2, Math.max(0, Number(s.scale) || 0))}
                onChange={(e) => setScale(i, parseFloat(e.target.value))}
                aria-label={`LoRA ${i + 1} strength`}
                className="flex-1 accent-purple-500"
              />
              <span className="text-[11px] font-mono text-gray-400 w-8 text-right flex-none">
                {(Math.min(2, Math.max(0, Number(s.scale) || 0))).toFixed(2)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
