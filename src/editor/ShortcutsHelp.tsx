const SHORTCUTS: [string, string][] = [
  ['Espace', 'Lecture / arrêt'],
  ['Clic', 'Ajouter une note (puis glisser pour la placer)'],
  ['Clic droit', 'Supprimer (glisser pour gommer)'],
  ['Bord droit d’une note', 'Changer la longueur'],
  ['Maj + clic', 'Ajouter / retirer de la sélection'],
  ['Ctrl + glisser', 'Sélection rectangulaire'],
  ['Alt + glisser', 'Déplacer sans magnétisme'],
  ['D · C · S', 'Crayon · Accords · Sélection'],
  ['1 · 2 · 3 · 4', 'Piste Chords · Melody · Bass · Drums'],
  ['Batterie : clic / glisser', 'Ajouter, retirer, peindre une rangée'],
  ['Batterie : glisser ↕ sur un coup', 'Force du coup'],
  ['Batterie : Maj + clic', 'Accent'],
  ['Batterie : Alt + clic', 'Roulement (2, 3, 4 coups)'],
  ['U', 'Humaniser (force et placement)'],
  ['↑ ↓', 'Transposer d’un demi-ton (Maj : octave) · batterie : ligne voisine'],
  ['← →', 'Déplacer d’un pas de grille'],
  ['Maj + ← →', 'Raccourcir / allonger'],
  ['I · Maj + I', 'Renverser l’accord sélectionné'],
  ['Q', 'Quantifier'],
  ['Ctrl + C / X / V', 'Copier / couper / coller'],
  ['Ctrl + D', 'Dupliquer à la suite'],
  ['Ctrl + A', 'Tout sélectionner'],
  ['Ctrl + Z / Ctrl + Maj + Z', 'Annuler / rétablir'],
  ['Suppr', 'Supprimer la sélection'],
  ['G · H', 'Ghost notes · surlignage de gamme'],
  ['Ctrl + molette · + / -', 'Zoom horizontal'],
  ['Alt + molette', 'Hauteur des lignes'],
  ['Ctrl + S', 'Enregistrer'],
];

export function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal shortcuts" onMouseDown={(e) => e.stopPropagation()}>
        <h2>Raccourcis</h2>
        <p className="sub">Sur Mac, Ctrl correspond à ⌘.</p>
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
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
