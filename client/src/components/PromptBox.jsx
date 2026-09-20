// Prompt input with save / enhance / clear actions.
export default function PromptBox({ value, onChange, onSave, onEnhance, disabled }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs text-gray-500">Describe what you want to generate.</span>
        <div className="flex gap-1.5">
          <button type="button" onClick={onSave} title="Save prompt" aria-label="Save prompt" className="w-8 h-8 rounded-lg bg-gray-900 border border-gray-700 text-gray-400 hover:text-white">
            <i className="fas fa-bookmark text-xs"></i>
          </button>
          <button type="button" onClick={onEnhance} title="Enhance with AI" aria-label="Enhance prompt" className="w-8 h-8 rounded-lg bg-gray-900 border border-gray-700 text-gray-400 hover:text-white">
            <i className="fas fa-magic text-xs"></i>
          </button>
          <button type="button" onClick={() => onChange('')} title="Clear" aria-label="Clear prompt" className="w-8 h-8 rounded-lg bg-gray-900 border border-gray-700 text-gray-400 hover:text-white">
            <i className="fas fa-eraser text-xs"></i>
          </button>
        </div>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') document.getElementById('genBtn')?.click(); }}
        placeholder="Describe what you want to generate in detail…"
        aria-label="Prompt"
        disabled={disabled}
        className="prompt-textarea"
      />
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[11px] text-gray-600">{value.length} chars</span>
        <span className="text-[11px] text-gray-600 hidden sm:inline"><kbd className="px-1 rounded bg-gray-800 border border-gray-700">Ctrl</kbd>+<kbd className="px-1 rounded bg-gray-800 border border-gray-700">Enter</kbd> to generate</span>
      </div>
    </div>
  );
}
