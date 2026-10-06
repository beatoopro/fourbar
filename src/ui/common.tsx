import { useEffect, useState, useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { engine, type EngineState } from '../audio/engine';
import type { User } from '../services';

export function Avatar({ user, size = 28 }: { user: Pick<User, 'name' | 'color'> | null | undefined; size?: number }) {
  const initials = (user?.name ?? '?')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className="avatar" style={{ width: size, height: size, background: user?.color ?? '#555', fontSize: size * 0.4 }}>
      {initials}
    </span>
  );
}

/* ---------- Toast ---------- */
const useToastStore = create<{ msg: string | null; id: number }>(() => ({ msg: null, id: 0 }));

export function toast(msg: string) {
  const id = Date.now();
  useToastStore.setState({ msg, id });
  setTimeout(() => {
    if (useToastStore.getState().id === id) useToastStore.setState({ msg: null });
  }, 2600);
}

export function Toaster() {
  const { msg, id } = useToastStore();
  return msg ? (
    <div className="toast" key={id} role="status">
      {msg}
    </div>
  ) : null;
}

/* ---------- Moteur audio ---------- */
export function useEngineState(): EngineState {
  return useSyncExternalStore(
    (cb) => engine.subscribe(cb),
    () => engine.getState(),
  );
}

/* ---------- Routeur minimal (hash) ---------- */
export interface Route {
  path: string[];
  query: URLSearchParams;
}

export function useRoute(): Route {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const [pathPart, queryPart = ''] = hash.replace(/^#\/?/, '').split('?');
  const path = pathPart.split('/').filter(Boolean);
  return { path: path.length ? path : ['explore'], query: new URLSearchParams(queryPart) };
}

export function navigate(path: string) {
  window.location.hash = path.startsWith('/') ? path : `/${path}`;
}

export function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'à l’instant';
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  const d = Math.floor(diff / 86400);
  if (d < 30) return `il y a ${d} j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
