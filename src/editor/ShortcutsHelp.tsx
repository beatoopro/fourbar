const SHORTCUTS: [string, string][] = [
  ['Space', 'Play / stop'],
  ['Click', 'Add a note (then drag to place it)'],
  ['Right-click', 'Delete (drag to erase)'],
  ['Right edge of a note', 'Change length'],
  ['Shift + click', 'Add to / remove from selection'],
  ['Ctrl + drag', 'Box select'],
  ['Alt + drag', 'Move without snapping'],
  ['D · C · S', 'Pencil · Chords · Select'],
  ['1 · 2 · 3 · 4', 'Chords · Melody · Bass · Drums track'],
  ['Drums: click / drag', 'Add, remove, paint a row'],
  ['Drums: drag ↕ on a hit', 'Hit velocity'],
  ['Drums: Shift + click', 'Accent'],
  ['Drums: Alt + click', 'Roll (2, 3, 4 hits)'],
  ['U', 'Humanize (velocity and timing)'],
  ['↑ ↓', 'Transpose by a semitone (Shift: octave) · drums: next row'],
  ['← →', 'Move by one grid step'],
  ['Shift + ← →', 'Shorten / lengthen'],
  ['I · Shift + I', 'Invert the selected chord'],
  ['Q', 'Quantize'],
  ['Ctrl + C / X / V', 'Copy / cut / paste'],
  ['Ctrl + D', 'Duplicate after'],
  ['Ctrl + A', 'Select all'],
  ['Ctrl + Z / Ctrl + Shift + Z', 'Undo / redo'],
  ['Delete', 'Delete selection'],
  ['G · H', 'Ghost notes · scale highlight'],
  ['Ctrl + wheel · + / -', 'Horizontal zoom'],
  ['Alt + wheel', 'Row height'],
  ['Ctrl + S', 'Save'],
];

export function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal shortcuts" onMouseDown={(e) => e.stopPropagation()}>
        <h2>Shortcuts</h2>
        <p className="sub">On Mac, Ctrl means ⌘.</p>
        <dl>
          {SHORTCUTS.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
