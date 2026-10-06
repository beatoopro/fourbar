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
    console.error('Fourbar: render error', error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="crash">
        <h2>Oops, this page couldn’t be displayed.</h2>
        <p className="muted">{error.message}</p>
        <button className="btn primary" onClick={() => location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
