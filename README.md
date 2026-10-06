# 4Chords · V1 locale

Plateforme communautaire de composition de boucles de 4 mesures : un piano roll
précis (Chords / Melody / Bass) et une bibliothèque communautaire simulée
(Explore, Profile, Remix). Tout fonctionne en local dans le navigateur, sans
compte, sans serveur et sans clé d'API.

## Lancer le projet

Prérequis : **Node.js 20 ou plus récent** (https://nodejs.org, version LTS).

```bash
cd 4chords
npm install        # une seule fois
npm run dev        # ouvre http://localhost:5173
```

Autres commandes :

```bash
npm test           # tests unitaires (théorie musicale, MIDI, éditeur)
npm run build      # version optimisée dans dist/
npm run preview    # sert la version optimisée sur http://localhost:4173
```

Navigateur conseillé : Chrome, Edge, Firefox ou Safari récents, sur ordinateur.
Le son démarre au premier clic (règle des navigateurs).

## Ce qui fonctionne réellement

**Piano roll (Create)**
- Grille de 4 mesures en 4/4, notes de C1 à C8.
- Ajouter (clic), déplacer (glisser), redimensionner (bord droit), supprimer
  (clic droit, glisser pour gommer, ou Suppr).
- Sélection multiple (Maj + clic, Ctrl + glisser ou outil Sélection), copier,
  couper, coller, dupliquer, tout sélectionner.
- Annuler / rétablir (200 étapes), un glisser = une seule étape.
- Transposition (flèches, Maj = octave), décalage et longueur au pas de grille.
- Magnétisme 1 mesure, 1/2, 1/4, 1/8, 1/16, 1/32, triolets 1/4, 1/8, 1/16, ou
  libre ; Alt pendant un glisser désactive le magnétisme ; quantification (Q).
- Zoom horizontal (Ctrl + molette, + / -), hauteur des lignes (Alt + molette),
  défilement vertical.
- Panneau de vélocité graphique (on « peint » les vélocités ; limité à la
  sélection s'il y en a une).
- Ghost notes des autres pistes, surlignage de la gamme (10 gammes / modes).
- Outil accords : accords automatiques dans la gamme (triade, 7e, 9e) ou 16
  types explicites, choix du renversement, durée, aperçu au survol avec le nom
  de l'accord. Chaque note générée reste une note normale, modifiable.
- Renverser un accord sélectionné (I / Maj + I) et reconnaissance du nom de
  l'accord sélectionné.
- Progressions rapides (8 préréglages) avec conduite des voix automatique et
  basse optionnelle : une progression complète en 2 clics.
- Trois pistes avec notes, instrument, volume, vélocité par défaut, muet, solo.
- Lecture synchronisée des 3 pistes en boucle, tête de lecture, BPM réglable,
  modifications entendues en direct pendant la lecture.
- 9 instruments synthétisés (Soft Keys, Warm Pad, Velvet Organ, Glass Pluck,
  Bell, Soft Lead, Sub Bass, Analog Bass, Round Bass), réverbération, limiteur.
- Export MIDI complet (3 pistes nommées, positions, durées et vélocités exactes,
  tempo, signature, tonalité, programme General MIDI).
- Export WAV d'une boucle de 4 mesures qui se répète sans coupure.
- Import d'un fichier MIDI (4 premières mesures, 3 premières pistes).
- Sauvegarde automatique du brouillon en cours, et « Enregistrer » pour le
  garder dans les brouillons du profil.

**Communauté (simulée)**
- Explore : cartes avec titre, auteur, genres, BPM, tonalité, aperçu visuel,
  lecture, j'aime, téléchargement MIDI, Remix.
- Filtres par genre (Jazz, Lo-fi, Hip-hop, Neo-soul, R&B, Pop, House,
  Cinematic, Trap) et par ambiance, recherche, classements Tendances,
  Populaires, Récentes, Plus remixées.
- Publication depuis l'éditeur : nom + genre puis Entrée. BPM, tonalité,
  auteur et date sont automatiques ; ambiance facultative.
- Remix : ouvre la création dans l'éditeur comme nouvelle composition liée à
  l'original (« Remix de … » sur la carte).
- Profils : créations, remixes, favoris, brouillons, nom et bio modifiables.

## Ce qui est simulé

- **Utilisateurs** : 8 profils fictifs et votre profil « Vous » ; aucune
  authentification.
- **Publications** : 26 boucles de démonstration générées au premier lancement
  (dont 4 remixes). Likes et écoutes sont des compteurs locaux.
- **Stockage** : tout est dans le `localStorage` du navigateur. Les données
  sont propres à ce navigateur et à cette adresse (http://localhost:5173) ;
  vider les données du site remet la démo à zéro.

## Limitations connues

- Pas de batterie (prévu plus tard), une seule signature (4/4), 4 mesures.
- Le magnétisme s'applique au début des notes déplacées ; le redimensionnement
  ne se fait que par le bord droit.
- Undo / redo couvre les notes, pas les réglages de pistes (instrument, volume).
- Les instruments sont des synthétiseurs simples : agréables pour tester, pas
  au niveau d'une banque d'échantillons.
- L'éditeur est pensé pour la souris et le clavier ; il s'affiche sur mobile
  mais l'édition tactile n'est pas optimisée.
- L'export WAV prend quelques secondes (rendu hors-ligne dans le navigateur).

## Architecture

```
src/
  core/        Moteur musical pur, sans UI ni audio
    types.ts         Modèle Composition / Track / Note (ce qui est stocké et publié)
    timing.ts        PPQ 96 (triolets exacts), grille, magnétisme
    theory.ts        Gammes, accords, renversements, progressions, conduite des voix
    midi.ts          Export / import MIDI (@tonejs/midi)
    composition.ts   Création, copie, remix, validation des données
    instruments.ts   Métadonnées des instruments (nom, programme GM)
  audio/       Lecture avec Tone.js
    engine.ts        Transport en boucle, mixage, prévisualisation des notes
    instruments.ts   Synthés (aucun échantillon externe)
    wav.ts           Rendu hors-ligne et encodage WAV
  editor/      Piano roll
    store.ts         État de l'éditeur (Zustand) : édition, historique, presse-papiers
    PianoRoll.tsx    Grille, clavier, règle, interactions souris
    VelocityLane.tsx Panneau de vélocité
    Toolbar.tsx, TrackPanel.tsx, ShortcutsHelp.tsx
  services/    Couche de données communautaire
    types.ts         Interface CommunityApi (contrat unique pour l'UI)
    local/           Implémentation localStorage + données de démo
    index.ts         Choix de l'implémentation (une ligne à changer)
  community/   UI communautaire : cartes, publication, état partagé
  pages/       Explore, Create, Profile
  styles/      Identité visuelle (variables CSS)
```

**Brancher un vrai backend plus tard** : écrire une classe qui implémente
`CommunityApi` (`src/services/types.ts`) avec des appels HTTP ou Supabase, puis
la sélectionner dans `src/services/index.ts`. Les pages n'appellent que cette
interface (méthodes asynchrones), donc rien d'autre ne change. Le format
`Composition` est versionné (`version: 1`) et contient toutes les informations
MIDI, il peut être stocké tel quel en JSON côté serveur. L'authentification se
branche au même endroit (`getCurrentUser`).

## Dépendances et licences

| Bibliothèque | Rôle | Licence |
| --- | --- | --- |
| React 19 | Interface | MIT |
| Tone.js 15 | Audio, transport, synthés | MIT |
| @tonejs/midi 2 | Lecture / écriture MIDI | MIT |
| Zustand 5 | État de l'éditeur | MIT |
| Vite 6, TypeScript, Vitest | Outils de développement | MIT / Apache-2.0 |

Tous les sons sont synthétisés en temps réel : aucun échantillon ni ressource
externe, aucune police ou image chargée depuis Internet.

## Raccourcis principaux

`Espace` lecture · `1/2/3` pistes · `D` crayon · `C` accords · `S` sélection ·
`Ctrl+Z / Ctrl+Maj+Z` annuler / rétablir · `Ctrl+C/X/V/D` copier / couper /
coller / dupliquer · `↑↓` transposer · `←→` déplacer · `Maj+←→` longueur ·
`I` renverser · `Q` quantifier · `G` ghost notes · `H` gamme · `?` aide.
