import { useEffect, useRef, useState } from 'react';

// Tooltip replacing always-visible hint paragraphs.
// <Tip text="..."> renders an ⓘ that shows text on hover/focus/tap.
export default function Tip({ text, children }) {
  const [show, setShow] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!show) return;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setShow(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [show ]);

  if (!text) return children ?? null;
  return (
    <span ref={ref} className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label="More info"
        onClick={() => setShow((s) => !s)}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        className="text-gray-500 hover:text-violet-300 text-[11px] leading-none px-0.5"
      >
        <i className="fas fa-info-circle"></i>
      </button>
      {show && (
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-60 max-w-[70vw] text-[11px] leading-snug font-normal normal-case tracking-normal text-gray-200 bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-2 shadow-xl whitespace-normal">
          {text}
          {children}
        </span>
      )}
    </span>
  );
}
