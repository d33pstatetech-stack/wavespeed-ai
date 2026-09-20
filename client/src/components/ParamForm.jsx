import ImageParam from './ImageParam';
import LoraSlots from './LoraSlots';
import Tip from './Tip';
import { getParamType, isLoraParam, loraHintText, loraTokenIssues, prettyLabel, sizeHintText, sortParamEntries } from '../params';

// Schema-driven parameter form. Controlled: values + onChange.
// Image params delegate upload UI to ImageParam; R2-picker tab arrives with CloudPicker.
export default function ParamForm({ schema, values, onChange, notify }) {
  const entries = sortParamEntries(Object.entries(schema?.params || {}).filter(([n]) => n !== 'prompt'));

  const set = (name, v) => {
    onChange((prev) => {
      const next = { ...prev };
      if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) delete next[name];
      else next[name] = v;
      return next;
    });
  };

  if (entries.length === 0) return <p className="text-xs text-gray-600">No parameters for this model.</p>;

  return (
    <div className="space-y-4">
      {entries.map(([name, spec]) => {
        const pType = getParamType(name, spec);
        const val = values[name];
        const def = schema?.defaults?.[name] ?? spec.default;
        const n = String(name).toLowerCase();
        const showSizeTip = (n === 'size' || n === 'resolution') && !(spec.options?.length) && (spec.type === 'string' || spec.type === undefined);
        const showLoraTip = isLoraParam(name, spec) && pType !== 'image' && pType !== 'image_array' && spec.type !== 'array';
        return (
          <div key={name}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <label htmlFor={`p-${name}`} className="text-xs font-medium text-gray-300">
                {prettyLabel(name, spec)}
              </label>
              {spec.required && <span className="text-[9px] uppercase tracking-wide bg-red-900/60 text-red-300 px-1.5 py-px rounded">required</span>}
              {spec.description && <Tip text={spec.description} />}
              {showSizeTip && <Tip text={sizeHintText()} />}
              {showLoraTip && <Tip text={loraHintText()} />}
            </div>
            <ParamControl
              name={name}
              spec={spec}
              pType={pType}
              value={val}
              fallback={def}
              onSet={(v) => set(name, v)}
              notify={notify}
            />
          </div>
        );
      })}
    </div>
  );
}

function ParamControl({ name, spec, pType, value, fallback, onSet, notify }) {
  if (pType === 'image' || pType === 'image_array') {
    return <ImageParam name={name} multi={pType === 'image_array'} value={value} onChange={onSet} notify={notify} />;
  }
  if (spec.options && spec.options.length > 0) {
    return (
      <select id={`p-${name}`} value={value ?? fallback ?? (spec.required ? spec.options[0] : '')} onChange={(e) => onSet(e.target.value || undefined)} className="input !text-xs">
        {!spec.required && <option value="">—</option>}
        {spec.options.map((o) => (
          <option key={String(o)} value={o}>{String(o)}</option>
        ))}
      </select>
    );
  }
  if (pType === 'range') {
    const v = value ?? fallback ?? spec.min ?? 0;
    return (
      <div className="flex items-center gap-2">
        <input id={`p-${name}`} type="range" min={spec.min} max={spec.max} step={1} value={v} onChange={(e) => onSet(parseInt(e.target.value, 10))} className="flex-1 accent-purple-500" />
        <span className="text-xs font-mono text-gray-300 w-10 text-right flex-none">{v}</span>
      </div>
    );
  }
  if (pType === 'number') {
    return (
      <input id={`p-${name}`} type="number" value={value ?? fallback ?? ''} min={spec.min} max={spec.max}
        placeholder={prettyLabel(name, spec)} onChange={(e) => onSet(e.target.value ? parseFloat(e.target.value) : undefined)} className="input !text-xs" />
    );
  }
  if (pType === 'boolean') {
    const v = value ?? fallback ?? false;
    return (
      <label className="flex items-center gap-2 cursor-pointer">
        <input id={`p-${name}`} type="checkbox" checked={!!v} onChange={(e) => onSet(e.target.checked)} className="accent-purple-500 w-4 h-4" />
        <span className="text-xs text-gray-400">{v ? 'Enabled' : 'Disabled'}</span>
      </label>
    );
  }
  if (spec.type === 'array' && isLoraParam(name, spec)) {
    return <LoraSlots name={name} spec={spec} value={Array.isArray(value) ? value : undefined} onChange={onSet} />;
  }
  // Plain text (incl. free-text LoRA fields with soft validation)
  const warn = isLoraParam(name, spec) ? loraTokenIssues(value) : null;
  return (
    <div>
      <input id={`p-${name}`} type="text" value={value ?? fallback ?? ''} placeholder={prettyLabel(name, spec)}
        onChange={(e) => onSet(e.target.value || undefined)} className="input !text-xs font-mono" />
      {value && warn && <p className="text-[11px] text-amber-400 mt-1">{warn}</p>}
    </div>
  );
}
