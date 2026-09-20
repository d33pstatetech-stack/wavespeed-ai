import { useCallback, useEffect, useRef, useState } from 'react';
import { linkEnhancement, pollPrediction, submitGenerate } from '../api';
import { buildSubmitParams } from '../params';

// Generation lifecycle: idle → submitting → polling → done | failed.
// onDone({ requestId, outputs, cost, elapsed }) for history + archive.
export default function useGeneration({ notify, onDone }) {
  const [phase, setPhase] = useState('idle'); // idle|submitting|polling|done|error
  const [status, setStatus] = useState(null); // { text, detail, spinner }
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null); // { requestId, outputs, cost, elapsed }
  const timer = useRef(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const submit = useCallback(async ({ modelId, prompt, params, enhancementId }) => {
    const p = (prompt || '').trim();
    if (!modelId || !p) return;
    stop();
    setResult(null);
    setProgress(null);
    setPhase('submitting');
    setStatus({ text: 'Submitting…', detail: 'Sending to WaveSpeed', spinner: true });
    const started = Date.now();
    const submitParams = buildSubmitParams(p, params);
    try {
      const data = await submitGenerate({ modelId, params: submitParams, enhancementId });
      if (enhancementId) {
        linkEnhancement({ externalJobId: data.requestId, enhancementId });
      }
      setPhase('polling');
      setStatus({ text: 'Processing…', detail: `ID: ${data.requestId}`, spinner: true });
      const MAX_POLL_MS = 15 * 60 * 1000;
      timer.current = setInterval(async () => {
        try {
          const d = await pollPrediction(data.requestId);
          const elapsed = ((Date.now() - started) / 1000).toFixed(1);
          if (Date.now() - started > MAX_POLL_MS) {
            stop();
            setPhase('error');
            setStatus({ text: 'Still running', detail: `No result after 15m — job may be queued server-side. ID: ${data.requestId}. Browser stopped polling.`, spinner: false });
            return;
          }
          if (d.status === 'completed' || d.detail?.status === 'completed') {
            stop();
            const outputs = d.outputs || d.output_urls || [];
            const r = { requestId: data.requestId, outputs, cost: data.cost, elapsed };
            setResult(r);
            setPhase('done');
            setStatus({ text: 'Completed', detail: `Done in ${elapsed}s`, spinner: false });
            setProgress(null);
            onDoneRef.current && onDoneRef.current(r);
          } else if (d.status === 'failed' || d.detail?.status === 'failed' || d.detail?.status === 'error') {
            stop();
            const msg = d.error || d.detail?.error || d.message || d.detail?.message || 'Generation failed';
            setPhase('error');
            setStatus({ text: 'Failed', detail: `${typeof msg === 'string' ? msg : JSON.stringify(msg)} [id: ${data.requestId}]`, spinner: false });
          } else {
            const pct = d.status === 'processing' ? 60 : d.status === 'queued' ? 20 : 40;
            setProgress(pct);
            setStatus({ text: statusText(d.status) || statusText(d.detail?.status) || 'Working', detail: `${elapsed}s elapsed`, spinner: true });
          }
        } catch {
          /* keep polling */
        }
      }, 2500);
    } catch (e) {
      setPhase('error');
      setStatus({ text: 'Error', detail: `${e.message} [model: ${modelId}]`, spinner: false });
      notify && notify(e.message, 'error');
    }
  }, [notify, stop]);

  return { phase, status, progress, result, submit, busy: phase === 'submitting' || phase === 'polling' };
}

function statusText(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}
