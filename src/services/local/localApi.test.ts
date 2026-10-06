import { beforeEach, describe, expect, it } from 'vitest';
import { LocalCommunityApi } from './localApi';
import { AuthRequiredError } from '../types';

const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  get length() {
    return store.size;
  },
} as Storage;

/** Loop au format V1 : 3 pistes, pas de batterie. */
const v1Comp = (id: string) => ({
  id,
  title: 'Ancienne loop',
  authorId: 'me',
  bpm: 90,
  genres: [],
  moods: [],
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  tracks: {
    chords: { id: 'chords', instrument: 'piano', volume: 0.8, notes: [{ id: 'n1', pitch: 60, start: 0, duration: 96, velocity: 0.8 }] },
    melody: { id: 'melody', instrument: 'piano', volume: 0.8, notes: [] },
    bass: { id: 'bass', instrument: 'piano', volume: 0.8, notes: [] },
  },
});

/** Navigateur avec un compte local déjà connecté. */
function asMember() {
  store.set('4chords:v1:session', 'true');
  store.set('4chords:v1:account', 'true');
}

describe('données locales d’une version précédente', () => {
  beforeEach(() => {
    store.clear();
    store.set('4chords:v1:seeded', '1');
    store.set('4chords:v1:publications', JSON.stringify([{ id: 'mine', composition: v1Comp('mine'), authorId: 'me', likes: 0, plays: 0, publishedAt: '2026-10-01T00:00:00.000Z' }]));
    store.set('4chords:v1:drafts', JSON.stringify([v1Comp('d1')]));
  });

  it('ajoute la piste batterie aux publications et brouillons V1', async () => {
    const api = new LocalCommunityApi();
    const mine = await api.getPublication('mine');
    expect(mine?.composition.tracks.drums.notes).toEqual([]);
    expect(mine?.composition.tracks.chords.notes).toHaveLength(1);
    const [draft] = await api.listDrafts();
    expect(draft.tracks.drums.notes).toEqual([]);
  });
});

describe('commentaires', () => {
  beforeEach(() => {
    store.clear();
    asMember();
  });

  it('ajoute les commentaires de démo sans toucher aux loops publiées', async () => {
    store.set('4chords:v1:seeded', '3');
    store.set('4chords:v1:publications', JSON.stringify([{ id: 'mine', composition: v1Comp('mine'), authorId: 'me', likes: 3, plays: 0, publishedAt: '2026-10-01T00:00:00.000Z' }]));
    const api = new LocalCommunityApi();
    expect((await api.listPublications()).map((p) => p.id)).toEqual(['mine']);
    expect(await api.listComments('mine')).toEqual([]);
    expect(store.get('4chords:v1:commentsSeeded')).toBe('true');
  });

  it('compte les commentaires de démo et calcule le like de l’utilisateur', async () => {
    const api = new LocalCommunityApi();
    const pub = await api.getPublication('seed_1');
    const list = await api.listComments('seed_1');
    expect(pub!.commentCount).toBe(list.length);
    expect(list.length).toBeGreaterThan(5);
    expect(list.find((c) => c.id === 'seedc_seed_1_a')?.likedByMe).toBe(true);
    expect(list.some((c) => c.linkedPublicationId === 'seed_remix_0_u_jade')).toBe(true);
    for (const c of list) expect(new Date(c.createdAt).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('valide, rattache les réponses de réponses au même fil et arrondit l’ancrage au temps', async () => {
    const api = new LocalCommunityApi();
    await expect(api.addComment('seed_2', { body: '   ' })).rejects.toThrow();
    await expect(api.addComment('seed_2', { body: 'x'.repeat(501) })).rejects.toThrow();
    await expect(api.addComment('nope', { body: 'Salut' })).rejects.toThrow();
    const top = await api.addComment('seed_2', { body: '  Super  ', anchorTick: 100 });
    expect(top.body).toBe('Super');
    expect(top.anchorTick).toBe(96);
    const r1 = await api.addComment('seed_2', { body: 'Merci', parentId: top.id, anchorTick: 300 });
    const r2 = await api.addComment('seed_2', { body: '@vous oui', parentId: r1.id });
    expect(r1.parentId).toBe(top.id);
    expect(r1.anchorTick).toBeNull();
    expect(r2.parentId).toBe(top.id);
  });

  it('suppression : la sienne, celles sous ses loops, pas celles des autres ailleurs', async () => {
    const api = new LocalCommunityApi();
    await expect(api.deleteComment('seedc_seed_1_a')).rejects.toThrow();
    const mine = await api.publish(v1Comp('mypub') as never);
    const c = await api.addComment(mine.id, { body: 'Mon commentaire' });
    // Un commentaire d'un autre utilisateur sous ma loop.
    const raw = JSON.parse(store.get('4chords:v1:comments')!);
    raw.push({ ...raw.find((x: { id: string }) => x.id === c.id), id: 'other', authorId: 'u_lina', parentId: c.id });
    store.set('4chords:v1:comments', JSON.stringify(raw));
    // Avec une réponse, le commentaire devient « supprimé » mais reste.
    await api.deleteComment(c.id);
    let list = await api.listComments(mine.id);
    expect(list.find((x) => x.id === c.id)).toMatchObject({ deleted: true, body: '' });
    expect((await api.getPublication(mine.id))!.commentCount).toBe(1);
    // L'auteur de la loop supprime la réponse : le parent vide disparaît aussi.
    await api.deleteComment('other');
    list = await api.listComments(mine.id);
    expect(list).toEqual([]);
  });

  it('likes, signalement et suppression de la loop', async () => {
    const api = new LocalCommunityApi();
    const before = (await api.listComments('seed_3')).find((c) => c.id === 'seedc_seed_3_a')!;
    const r = await api.toggleCommentLike(before.id);
    expect(r).toEqual({ liked: true, likes: before.likes + 1 });
    await api.reportComment('seedc_seed_3_b', 'spam');
    expect((await api.listComments('seed_3')).some((c) => c.id === 'seedc_seed_3_b')).toBe(false);
    const mine = await api.publish(v1Comp('gone') as never);
    await api.addComment(mine.id, { body: 'test' });
    await api.deletePublication(mine.id);
    expect(JSON.parse(store.get('4chords:v1:comments')!).some((c: { publicationId: string }) => c.publicationId === mine.id)).toBe(false);
  });
});

describe('passage de l’interface en anglais', () => {
  beforeEach(() => store.clear());

  it('traduit le contenu de démo et le profil par défaut, sans toucher au contenu de l’utilisateur', async () => {
    new LocalCommunityApi();
    // Simule des données enregistrées avant la traduction.
    const pubs = JSON.parse(store.get('4chords:v1:publications')!);
    pubs.find((p: { id: string }) => p.id === 'seed_1').composition.title = 'Café du matin';
    pubs.push({ id: 'mine', composition: { ...v1Comp('mine'), moods: ['Rêveur'] }, authorId: 'me', likes: 0, plays: 0, publishedAt: '2026-10-01T00:00:00.000Z' });
    store.set('4chords:v1:publications', JSON.stringify(pubs));
    const comments = JSON.parse(store.get('4chords:v1:comments')!);
    comments.find((c: { id: string }) => c.id === 'seedc_seed_1_a').body = 'Le passage au IV…';
    store.set('4chords:v1:comments', JSON.stringify(comments));
    store.set('4chords:v1:me', JSON.stringify({ name: 'Vous', handle: 'vous', bio: 'Ma bio' }));
    store.set('4chords:v1:seeded', '2');
    asMember();

    const api = new LocalCommunityApi();
    expect((await api.getPublication('seed_1'))?.composition.title).toBe('Morning Coffee');
    const mine = await api.getPublication('mine');
    expect(mine?.composition.title).toBe('Ancienne loop');
    expect(mine?.composition.moods).toEqual(['Dreamy']);
    expect((await api.listComments('seed_1')).find((c) => c.id === 'seedc_seed_1_a')?.body).toMatch(/^That move to the IV/);
    const me = await api.getCurrentUser();
    expect([me!.name, me!.handle, me!.bio]).toEqual(['You', 'you', 'Ma bio']);
  });
});

describe('comptes', () => {
  beforeEach(() => store.clear());

  it('un nouveau visiteur est invité : il lit tout mais ne peut ni publier, ni liker, ni commenter', async () => {
    const api = new LocalCommunityApi();
    expect(await api.getCurrentUser()).toBeNull();
    expect(await api.getLikedIds()).toEqual([]);
    expect((await api.listPublications()).length).toBeGreaterThan(10);
    expect((await api.listComments('seed_1')).length).toBeGreaterThan(0);
    await expect(api.publish(v1Comp('x') as never)).rejects.toThrow(AuthRequiredError);
    await expect(api.toggleLike('seed_1')).rejects.toThrow(AuthRequiredError);
    await expect(api.addComment('seed_1', { body: 'Salut' })).rejects.toThrow(AuthRequiredError);
    await expect(api.updateCurrentUser({ name: 'X' })).rejects.toThrow(AuthRequiredError);
  });

  it('un navigateur déjà utilisé avant les comptes reste connecté', async () => {
    store.set('4chords:v1:seeded', '3');
    const api = new LocalCommunityApi();
    expect(await api.getCurrentUser()).not.toBeNull();
  });

  it('inscription par e-mail : code vérifié, pseudo proposé, brouillons invités rattachés', async () => {
    const api = new LocalCommunityApi();
    await api.saveDraft(v1Comp('g1') as never);
    await api.saveDraft(v1Comp('g2') as never);
    await expect(api.requestEmailCode('pas-un-email')).rejects.toThrow();
    const { demoCode } = await api.requestEmailCode('Victor.B@example.com');
    await expect(api.signIn({ provider: 'email', email: 'victor.b@example.com', code: '000000' })).rejects.toThrow();
    const r = await api.signIn({ provider: 'email', email: 'victor.b@example.com', code: demoCode! });
    expect(r.isNew).toBe(true);
    expect(r.importedDrafts).toBe(2);
    expect(r.user).toMatchObject({ name: 'Victor B', handle: 'victor.b' });
    expect(await api.getLikedIds()).toEqual([]);
    expect((await api.listDrafts()).map((d) => d.id).sort()).toEqual(['g1', 'g2']);
    // Un code ne sert qu'une fois.
    await api.signOut();
    await expect(api.signIn({ provider: 'email', email: 'victor.b@example.com', code: demoCode! })).rejects.toThrow();
  });

  it('déconnexion : les brouillons restent sur le compte, le navigateur repart vide ; reconnexion sans écraser', async () => {
    const api = new LocalCommunityApi();
    await api.signIn({ provider: 'google' });
    await api.saveDraft({ ...v1Comp('d1'), title: 'compte' } as never);
    await api.signOut();
    expect(await api.listDrafts()).toEqual([]);
    expect(await api.getCurrentUser()).toBeNull();
    await api.saveDraft({ ...v1Comp('d2'), title: 'invité' } as never);
    const r = await api.signIn({ provider: 'google' });
    expect(r).toMatchObject({ isNew: false, importedDrafts: 1 });
    expect((await api.listDrafts()).map((d) => d.title).sort()).toEqual(['compte', 'invité']);
  });

  it('pseudo : format et disponibilité vérifiés', async () => {
    const api = new LocalCommunityApi();
    await api.signIn({ provider: 'google' });
    await expect(api.updateCurrentUser({ handle: 'ab' })).rejects.toThrow();
    await expect(api.updateCurrentUser({ handle: 'linabeats' })).rejects.toThrow(/taken/);
    expect((await api.updateCurrentUser({ handle: '@Élodie Beats', name: '  Élodie ' })).handle).toBe('elodiebeats');
    expect((await api.getCurrentUser())!.name).toBe('Élodie');
  });
});
