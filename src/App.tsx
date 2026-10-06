import { useEffect } from 'react';
import { ExplorePage } from './pages/ExplorePage';
import { CreatePage } from './pages/CreatePage';
import { ProfilePage } from './pages/ProfilePage';
import { LoopPage } from './pages/LoopPage';
import { useCommunity } from './community/store';
import { ensureAccount } from './community/auth';
import { SignInDialog } from './community/SignInDialog';
import { ME_ID } from './services';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { Avatar, Toaster, navigate, useRoute } from './ui/common';

export function App() {
  const { path, query } = useRoute();
  const me = useCommunity((s) => s.me);
  const ready = useCommunity((s) => s.ready);
  const init = useCommunity((s) => s.init);
  const section = path[0];

  useEffect(() => {
    void init();
  }, [init]);

  const link = (to: string, label: string) => (
    <a href={`#/${to}`} className={section === to ? 'active' : ''}>
      {label}
    </a>
  );

  return (
    <div className="app">
      <header className="topbar">
        <a className="logo" href="#/explore">
          <span className="logo-mark">
            <span />
            <span />
            <span />
            <span />
          </span>
          <span className="logo-text">Fourbar</span>
        </a>
        <nav className="nav">
          {link('explore', 'Explore')}
          {link('create', 'Create')}
          {link('profile', 'Profile')}
        </nav>
        <div className="topbar-right">
          {me ? (
            <button className="me" onClick={() => navigate('/profile')} title="My profile">
              <Avatar user={me} size={28} />
            </button>
          ) : (
            ready && (
              <button className="btn primary sm" onClick={() => void ensureAccount({ kind: 'signin' })}>
                Sign in
              </button>
            )
          )}
        </div>
      </header>
      <main className={`main ${section === 'create' ? 'no-scroll' : ''}`}>
        <ErrorBoundary key={section}>
          {section === 'create' ? (
            <CreatePage />
          ) : section === 'loop' && path[1] ? (
            <LoopPage id={decodeURIComponent(path[1])} data={query.get('d')} focus={query.get('focus')} />
          ) : section === 'profile' ? (
            <ProfilePage userId={path[1] ?? ME_ID} />
          ) : (
            <ExplorePage query={query} />
          )}
        </ErrorBoundary>
      </main>
      <SignInDialog />
      <Toaster />
    </div>
  );
}
