import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { autoBullets } from '../tip-format';

// Tooltip replacing always-visible hint paragraphs.
// <Tip text="..."> renders an ⓘ that shows text on hover/focus/tap.
//
// - Newline-separated text renders as a bulleted list (one statement per line,
//   hanging indent when a line wraps); single-sentence text stays a paragraph.
// - The popup clamps itself inside the viewport with 12px padding and flips
//   below the icon when there is no room above, so edge-anchored icons never
//   push the popup off-screen.
// - Desktop (md+): wider popup + 13px type so list items fit on one line.
const PAD = 12;

export default function Tip({ text, children }) {
  const [show, setShow] = useState(false);
  const [shift, setShift] = useState(0);
  const [below, setBelow] = useState(false);
  const ref = useRef(null);
  const tipRef = useRef(null);

  useEffect(() => {
    if (!show) return;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setShow(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [show]);

  // Clamp the open popup inside the viewport after it mounts. Margin-shifting
  // moves the box linearly, so a single measure/correct pass lands exactly.
  useLayoutEffect(() => {
    if (!show || !tipRef.current || !ref.current) return;
    setShift(0);
    setBelow(false);
    const tip = tipRef.current.getBoundingClientRect();
    let dx = 0;
    if (tip.left < PAD) dx = PAD - tip.left;
    else if (tip.right > window.innerWidth - PAD) dx = window.innerWidth - PAD - tip.right;
    setShift(dx);
    const anchor = ref.current.getBoundingClientRect();
    setBelow(anchor.top < tip.height + PAD * 2);
  }, [show, text]);

  if (!text) return children ?? null;
  const parts = String(text).split('\n').map((s) => s.trim()).filter(Boolean);
  // Single-string provider descriptions ("Load LoRA weights. Supports …")
  // auto-format into an intro line plus bullets.
  const auto = parts.length > 1 ? null : autoBullets(text);
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
        <span
          ref={tipRef}
          style={shift ? { marginLeft: `${shift}px` } : undefined}
          className={`absolute z-50 ${below ? 'top-full mt-1.5' : 'bottom-full mb-1.5'} left-1/2 -translate-x-1/2 w-60 max-w-[70vw] md:w-96 md:max-w-[min(80vw,28rem)] text-[11px] md:text-[13px] leading-relaxed md:leading-relaxed font-normal normal-case tracking-normal text-gray-200 bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-2 md:px-3.5 md:py-2.5 shadow-xl whitespace-normal`}
        >
          {parts.length > 1 ? (
            <ul className="tip-list">
              {parts.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          ) : auto ? (
            <>
              {auto.intro && <p className="tip-intro">{auto.intro}</p>}
              <ul className="tip-list">
                {auto.bullets.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </>
          ) : (
            text
          )}
          {children}
        </span>
      )}
    </span>
  );
}
