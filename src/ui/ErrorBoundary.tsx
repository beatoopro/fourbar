import { Component, type ReactNode } from 'react';

/**
 * Filet de sécurité : si une page plante au rendu, on affiche un message au
 * lieu d'une page vide, et l'en-tête reste utilisable pour changer de page.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('4Chords : erreur d’affichage', error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="crash">
        <h2>Oups, cette page n’a pas pu s’afficher.</h2>
        <p className="muted">{error.message}</p>
        <button className="btn primary" onClick={() => location.reload()}>
          Recharger
        </button>
      </div>
    );
  }
}
