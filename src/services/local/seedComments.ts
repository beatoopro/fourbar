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
    ['a', 'u_sacha', 3, 'Le passage au IV en mesure 3, quel frisson. Les 7e sonnent super chaudes avec ces keys.', '3.1', 18],
    ['b', 'u_lina', 5, 'Merci ! C’est un Bbmaj7 avec la 9 dans la mélodie, d’où la couleur 🙂', null, 9, 'a'],
    ['c', 'u_jade', 8, 'J’ai fait une version boom bap, le groove se prête trop bien au flip.', null, 12],
    ['d', 'u_elio', 20, 'Je l’ai reprise en trio jazz, j’espère que ça te plaît !', null, 6],
    ['e', 'u_ama', 26, 'Parfait pour bosser le matin. Ajoutée aux favoris.', null, 4],
    ['f', 'u_malik', 30, 'La basse qui pousse juste avant le temps 1, c’est ça qui fait tout.', '4.4', 7],
  ],
  seed_2: [
    ['a', 'u_malik', 2, 'L’orgue sur les contretemps, ça me rappelle le garage de la fin des années 90.', null, 11],
    ['b', 'u_kenji', 4, 'C’est exactement la référence 😄 Un M1 Organ du pauvre.', null, 8, 'a'],
    ['c', 'u_nora', 9, 'Le changement d’accord en mesure 2 donne un vrai côté nocturne.', '2.1', 5],
    ['d', 'u_jade', 15, 'Tu as quel réglage de swing ? Ça groove sans être bancal.', null, 3],
    ['e', 'u_kenji', 16, 'Swing à zéro ici, c’est le placement des accords qui fait l’effet.', null, 2, 'd'],
  ],
  seed_3: [
    ['a', 'u_sacha', 6, 'L’arpège qui monte en mesure 4 donne des frissons. Ça mérite une scène de film.', '4.1', 14],
    ['b', 'u_elio', 12, 'Question de théorie : le VI–VII–i à la fin, c’est l’effet « épique » éolien ?', '3.1', 8],
    ['c', 'u_nora', 14, 'Exactement ! La cadence éolienne, très utilisée en musique de film.', null, 10, 'b'],
    ['d', 'u_ama', 30, 'Les cloches dans la mélodie 😍', null, 4],
  ],
  seed_4: [
    ['a', 'u_jade', 1, '808 qui glisse au temps 4, propre 🔥', '2.4', 22],
    ['b', 'u_kenji', 5, 'J’en ai fait une version house, la grille marche à 124 aussi.', null, 9],
    ['c', 'u_malik', 6, 'Grave, ton edit est lourd, je l’ai mis en favori.', null, 6, 'b'],
    ['d', 'u_elio', 10, 'Pourquoi la mélodie évite la tierce sur le 2e accord ? Choix voulu ?', '2.1', 3],
    ['e', 'u_malik', 11, 'Oui, ça garde le côté sombre et ça laisse la place à la voix.', null, 5, 'd'],
    ['f', 'u_lina', 40, 'Pas mon style d’habitude mais celle-là tourne en boucle chez moi.', null, 7],
  ],
  seed_5: [
    ['a', 'u_elio', 4, 'Ces voicings de 9e… tu les joues comment à la main ?', '1.1', 9],
    ['b', 'u_sacha', 6, 'Fondamentale à gauche, 3-7-9 à droite. Le piano roll fait le reste !', null, 12, 'a'],
    ['c', 'u_ama', 9, 'J’en ai fait une version slow jam, ça m’a inspirée direct.', null, 8],
    ['d', 'u_lina', 22, 'La basse syncopée en mesure 2 est trop bien placée.', '2.3', 6],
  ],
  seed_6: [
    ['a', 'u_sacha', 3, 'Ça respire, on a envie de poser une voix dessus.', null, 5],
    ['b', 'u_nora', 18, 'La mélodie qui retombe en mesure 4, tout en douceur 👌', '4.3', 4],
  ],
  seed_7: [
    ['a', 'u_sacha', 5, 'Très propre ce II-V-I. Essaie un tritone sub sur le V pour pimenter !', '2.1', 10],
    ['b', 'u_elio', 7, 'Bonne idée, je teste ça dans un remix 🙏', null, 3, 'a'],
    ['c', 'u_lina', 30, 'La walking bass est hyper fluide.', null, 6],
  ],
  seed_8: [
    ['a', 'u_malik', 2, 'Le stab au temps 2 de la mesure 1, c’est du sample imaginaire comme j’aime.', '1.2', 8],
    ['b', 'u_lina', 10, 'Ambiance cassette parfaite pour réviser.', null, 5],
  ],
  seed_9: [
    ['a', 'u_kenji', 1, 'Refrain direct dans la tête. La mélodie en mesure 3 est imparable.', '3.1', 16],
    ['b', 'u_jade', 4, 'C’est la progression I–V–vi–IV ?', null, 4],
    ['c', 'u_ama', 5, 'Oui, la plus classique de la pop, mais avec un rythme sur les contretemps pour la rendre moins sage.', null, 9, 'b'],
    ['d', 'u_nora', 12, 'Ça sent l’été ☀️', null, 6],
  ],
  seed_12: [
    ['a', 'u_sacha', 8, 'Les nappes sont énormes. Le retour au I en mesure 3 fait l’effet d’un lever de soleil.', '3.1', 7],
  ],
  seed_14: [
    ['a', 'u_ama', 4, 'L’orgue gospel, j’adore. On s’y croirait.', null, 6],
    ['b', 'u_elio', 9, 'Le IV en début de boucle, c’est osé et ça marche.', '1.1', 4],
  ],
  seed_20: [
    ['a', 'u_jade', 6, 'Ma loop préférée pour travailler, merci.', null, 11],
    ['b', 'u_kenji', 14, 'Le push d’accord juste avant la mesure 2, super groove.', '1.4', 5],
    ['c', 'u_lina', 15, 'Merci ! C’est mon petit tic de prod 😅', null, 4, 'b'],
  ],
  seed_remix_0_u_jade: [
    ['a', 'u_lina', 2, 'Trop cool de voir ma loop en boom bap ! La basse ronde lui va super bien.', null, 9],
    ['b', 'u_jade', 3, 'Merci pour la base, elle était parfaite pour ça 🙌', null, 4, 'a'],
  ],
  seed_remix_3_u_kenji: [
    ['a', 'u_malik', 3, 'Je ne l’avais pas imaginée en house, respect.', null, 6],
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
