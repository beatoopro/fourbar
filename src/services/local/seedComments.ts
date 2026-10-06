import { BAR, PPQ } from '../../core/timing';
import { remixNoteBody, type LoopComment, type Publication } from '../types';

/** Commentaire tel qu'il est stocké (`likedByMe` est calculé à la lecture). */
export type StoredComment = Omit<LoopComment, 'likedByMe'>;

/**
 * Commentaires de démonstration, écrits à la main pour sonner juste.
 * [clé locale, auteur, heures après la publication, texte, ancrage « mesure.temps » ou null, likes, clé du parent]
 */
type Row = [string, string, number, string, string | null, number, string?];

const ROWS: Record<string, Row[]> = {
  seed_1: [
    ['a', 'u_sacha', 3, 'That move to the IV in bar 3 gives me chills. The 7ths sound so warm with these keys.', '3.1', 18],
    ['b', 'u_lina', 5, 'Thanks! It’s a Bbmaj7 with the 9 in the melody, that’s where the color comes from 🙂', null, 9, 'a'],
    ['c', 'u_jade', 8, 'I made a boom bap version, the groove is perfect for a flip.', null, 12],
    ['d', 'u_elio', 20, 'I redid it as a jazz trio, hope you like it!', null, 6],
    ['e', 'u_ama', 26, 'Perfect for working in the morning. Liked.', null, 4],
    ['f', 'u_malik', 30, 'The bass pushing right before beat 1 is what makes it.', '4.4', 7],
  ],
  seed_2: [
    ['a', 'u_malik', 2, 'That offbeat organ takes me back to late-90s garage.', null, 11],
    ['b', 'u_kenji', 4, 'That’s exactly the reference 😄 A poor man’s M1 Organ.', null, 8, 'a'],
    ['c', 'u_nora', 9, 'The chord change in bar 2 gives it a real late-night feel.', '2.1', 5],
    ['d', 'u_jade', 15, 'What swing setting are you using? It grooves without feeling sloppy.', null, 3],
    ['e', 'u_kenji', 16, 'Zero swing here, it’s the chord placement doing the work.', null, 2, 'd'],
  ],
  seed_3: [
    ['a', 'u_sacha', 6, 'The rising arpeggio in bar 4 gives me chills. This deserves a film scene.', '4.1', 14],
    ['b', 'u_elio', 12, 'Theory question: is the VI–VII–i at the end that “epic” Aeolian thing?', '3.1', 8],
    ['c', 'u_nora', 14, 'Exactly! The Aeolian cadence, used a lot in film music.', null, 10, 'b'],
    ['d', 'u_ama', 30, 'The bells in the melody 😍', null, 4],
  ],
  seed_4: [
    ['a', 'u_jade', 1, '808 sliding on beat 4, clean 🔥', '2.4', 22],
    ['b', 'u_kenji', 5, 'I made a house version, the progression works at 124 too.', null, 9],
    ['c', 'u_malik', 6, 'For real, your edit hits hard, I liked it.', null, 6, 'b'],
    ['d', 'u_elio', 10, 'Why does the melody avoid the third on the 2nd chord? On purpose?', '2.1', 3],
    ['e', 'u_malik', 11, 'Yes, it keeps it dark and leaves room for vocals.', null, 5, 'd'],
    ['f', 'u_lina', 40, 'Not my usual style but this one is on repeat at my place.', null, 7],
  ],
  seed_5: [
    ['a', 'u_elio', 4, 'Those 9th voicings… how do you play them by hand?', '1.1', 9],
    ['b', 'u_sacha', 6, 'Root in the left hand, 3-7-9 in the right. The piano roll does the rest!', null, 12, 'a'],
    ['c', 'u_ama', 9, 'I made a slow jam version, it inspired me right away.', null, 8],
    ['d', 'u_lina', 22, 'The syncopated bass in bar 2 sits so well.', '2.3', 6],
  ],
  seed_6: [
    ['a', 'u_sacha', 3, 'It breathes, makes you want to put vocals on it.', null, 5],
    ['b', 'u_nora', 18, 'The melody falling back in bar 4, so smooth 👌', '4.3', 4],
  ],
  seed_7: [
    ['a', 'u_sacha', 5, 'Very clean II-V-I. Try a tritone sub on the V to spice it up!', '2.1', 10],
    ['b', 'u_elio', 7, 'Good idea, I’ll try that in a remix 🙏', null, 3, 'a'],
    ['c', 'u_lina', 30, 'The walking bass is super smooth.', null, 6],
  ],
  seed_8: [
    ['a', 'u_malik', 2, 'The stab on beat 2 of bar 1 is imaginary sampling just how I like it.', '1.2', 8],
    ['b', 'u_lina', 10, 'Perfect tape vibe for studying.', null, 5],
  ],
  seed_9: [
    ['a', 'u_kenji', 1, 'Instant earworm. The melody in bar 3 is unstoppable.', '3.1', 16],
    ['b', 'u_jade', 4, 'Is that the I–V–vi–IV progression?', null, 4],
    ['c', 'u_ama', 5, 'Yes, the most classic one in pop, but with an offbeat rhythm to make it less tame.', null, 9, 'b'],
    ['d', 'u_nora', 12, 'Smells like summer ☀️', null, 6],
  ],
  seed_12: [
    ['a', 'u_sacha', 8, 'The pads are huge. Going back to the I in bar 3 feels like a sunrise.', '3.1', 7],
  ],
  seed_14: [
    ['a', 'u_ama', 4, 'Love the gospel organ. Feels like being there.', null, 6],
    ['b', 'u_elio', 9, 'Starting the loop on the IV is bold and it works.', '1.1', 4],
  ],
  seed_20: [
    ['a', 'u_jade', 6, 'My favorite loop to work to, thanks.', null, 11],
    ['b', 'u_kenji', 14, 'The chord push right before bar 2, great groove.', '1.4', 5],
    ['c', 'u_lina', 15, 'Thanks! It’s my little production habit 😅', null, 4, 'b'],
  ],
  seed_remix_0_u_jade: [
    ['a', 'u_lina', 2, 'So cool to hear my loop as boom bap! The round bass suits it perfectly.', null, 9],
    ['b', 'u_jade', 3, 'Thanks for the base, it was perfect for it 🙌', null, 4, 'a'],
  ],
  seed_remix_3_u_kenji: [
    ['a', 'u_malik', 3, 'Never pictured it as house, respect.', null, 6],
  ],
};

/** Liens « J'ai remixé cette loop » posés automatiquement sur les originaux. */
const REMIX_NOTES: [string, string, string, number][] = [
  ['seed_1', 'seed_remix_0_u_jade', 'u_jade', 1],
  ['seed_5', 'seed_remix_4_u_ama', 'u_ama', 2],
  ['seed_4', 'seed_remix_3_u_kenji', 'u_kenji', 3],
  ['seed_1', 'seed_remix_0_u_elio', 'u_elio', 4],
];


const anchor = (a: string | null) => {
  if (!a) return null;
  const [bar, beat] = a.split('.').map(Number);
  return (bar - 1) * BAR + (beat - 1) * PPQ;
};

/**
 * Construit les commentaires de démonstration à partir des publications stockées,
 * pour que leurs dates suivent celles des loops (jamais dans le futur).
 */
export function buildSeedComments(pubs: Publication[], now = Date.now()): StoredComment[] {
  const byId = new Map(pubs.map((p) => [p.id, p]));
  const out: StoredComment[] = [];
  const at = (pub: Publication, hours: number) =>
    new Date(Math.min(now - 60_000, new Date(pub.publishedAt).getTime() + hours * 3_600_000)).toISOString();

  for (const [pubId, rows] of Object.entries(ROWS)) {
    const pub = byId.get(pubId);
    if (!pub) continue;
    for (const [key, authorId, hours, body, anc, likes, parent] of rows) {
      out.push({
        id: `seedc_${pubId}_${key}`,
        publicationId: pubId,
        authorId,
        parentId: parent ? `seedc_${pubId}_${parent}` : null,
        body,
        anchorTick: parent ? null : anchor(anc),
        likes,
        createdAt: at(pub, hours),
        deleted: false,
      });
    }
  }
  for (const [origId, remixId, authorId, likes] of REMIX_NOTES) {
    const orig = byId.get(origId);
    const remix = byId.get(remixId);
    if (!orig || !remix) continue;
    out.push({
      id: `seedc_${origId}_remix_${remixId}`,
      publicationId: origId,
      authorId,
      parentId: null,
      body: remixNoteBody(remix.composition.title),
      anchorTick: null,
      linkedPublicationId: remixId,
      likes,
      createdAt: new Date(Math.min(now - 60_000, new Date(remix.publishedAt).getTime() + 600_000)).toISOString(),
      deleted: false,
    });
  }
  return out;
}

/** Commentaires déjà likés par l'utilisateur de démonstration. */
export const SEED_COMMENT_LIKES = ['seedc_seed_1_a', 'seedc_seed_4_a'];
