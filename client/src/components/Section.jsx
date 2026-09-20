import { useState } from 'react';

// Collapsible section: the core progressive-disclosure primitive.
// <Section icon="fa-brain" title="Model" step={1} summary="flux schnell" defaultOpen onToggle>
export default function Section({ icon, title, step, summary, defaultOpen = true, actions, children, id }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="panel" id={id}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 text-left"
      >
        {step != null && (
          <span className="flex-none w-5 h-5 rounded-full bg-violet-600 text-white text-[11px] font-bold flex items-center justify-center">
            {step}
          </span>
        )}
        <span className="panel-title !mb-0 flex-1 min-w-0">
          {icon && <i className={`fas ${icon}`}></i>}
          <span className="truncate">{title}</span>
        </span>
        {summary && !open && <span className="text-[11px] text-gray-500 truncate max-w-[40%]">{summary}</span>}
        {actions && <span onClick={(e) => e.stopPropagation()} className="flex gap-1.5">{actions}</span>}
        <i className={`fas fa-chevron-${open ? 'up' : 'down'} text-gray-600 text-xs flex-none`}></i>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </section>
  );
}
