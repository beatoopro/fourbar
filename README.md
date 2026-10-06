# Fourbar · V1 locale

Anciennement 4Chords. L’interface et le contenu de démonstration sont en anglais
(public international) ; le code et sa documentation restent en français.

Plateforme communautaire de composition de boucles de 4 mesures : un piano roll
précis (Chords / Melody / Bass), une grille de batterie (Drums) et une bibliothèque communautaire simulée
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
- 11 instruments : 4 échantillonnés (Grand Piano, Electric Piano, Finger Bass,
  Upright Bass, fichiers et licences CC BY dans `public/samples/CREDITS.md`) et
  7 synthétisés (Warm Pad, Velvet Organ, Glass Pluck, Bell, Soft Lead, Sub Bass,
  Analog Bass), réverbération, limiteur.
- Export MIDI complet (4 pistes nommées, positions, durées et vélocités exactes,
  tempo, signature, tonalité, programme General MIDI ; batterie sur le canal 10).
- Export WAV d'une boucle de 4 mesures qui se répète sans coupure.
- Import d'un fichier MIDI (4 premières mesures, 3 premières pistes mélodiques,
  pistes du canal 10 vers la batterie).
- Sauvegarde automatique du brouillon en cours, et « Enregistrer » pour le
  garder dans les brouillons du profil.

**Batterie (piste Drums, touche 4)**
- Grille à 10 lignes nommées (Kick, Snare, Clap, Toms, Closed / Open hat, Shaker,
  Ride, Crash). Clic : ajouter / retirer un coup ; glisser : peindre ou gommer
  une rangée ; glisser verticalement sur un coup : sa force ; Maj + clic :
  accent ; Alt + clic : roulement de 2, 3 ou 4 coups ; clic droit : gomme.
- Résolution suivant le magnétisme (1/16 par défaut, 1/32, triolets) ; les coups
  hors grille s'affichent à leur vraie position.
- 13 patterns prêts à l'emploi par genre (lo-fi, boom bap, trap, house, R&B,
  neo-soul, jazz, dembow, cinématique…), avec break optionnel en mesure 4.
- Répéter la mesure 1, remplir / effacer une ligne (menu ⋯), humaniser (U),
  lignes utilisées seulement, repères de la basse sur la règle.
- 3 kits synthétisés : 808, Dusty (lo-fi), House. Le hi-hat fermé coupe
  l'ouvert, la batterie reçoit peu de réverbération.
- Swing global (50 à 75 %, façon MPC) appliqué à toutes les pistes à la lecture,
  intégré aux exports MIDI et WAV. Les notes restent sur la grille.
- Le kick et la snare apparaissent en repères sur la règle du piano roll.

**Communauté (simulée)**
- Explore : cartes avec titre, auteur, genres, BPM, tonalité, aperçu visuel
  (notes et bande de batterie), lecture, j'aime, téléchargement MIDI, Remix.
- Filtres par genre (Jazz, Lo-fi, Hip-hop, Neo-soul, R&B, Pop, House,
  Cinematic, Trap) et par ambiance, recherche, classements Tendances,
  Populaires, Récentes, Plus remixées.
- Recherche avancée (bouton Advanced) : BPM de/à, tonalité (avec la relative
  en option), artiste, date, pistes présentes ou absentes, instrument,
  originaux/remixes et progression d'accords (« ii-V-I » selon la tonalité de
  chaque loop, ou « Am F C G »). Les accords sont reconnus à partir des notes
  (core/search.ts). « Match my project » cale BPM et tonalité sur le projet en
  cours. Toute la recherche est dans l'URL, donc partageable.
- Publication depuis l'éditeur : nom + genre puis Entrée. BPM, tonalité,
  auteur et date sont automatiques ; ambiance facultative.
- Remix : ouvre la création dans l'éditeur comme nouvelle composition liée à
  l'original (« Remix de … » sur la carte).
- Profils : créations, remixes, favoris, brouillons, nom et bio modifiables.
- Page de chaque loop (`#/loop/<id>`) : grand aperçu (clic = écouter à partir
  de cet endroit), infos, j'aime, MIDI, WAV, remix, liste de ses remixes et
  bouton Partager.
- Commentaires sur la page d'une loop : réponses (un niveau), j'aime,
  suppression (les siens, et tous ceux sous ses propres loops), signalement.
  Un commentaire peut viser un moment de la loop (« Mesure 3 · temps 2 ») :
  repère sur l'aperçu, clic pour écouter à cet endroit. En écrivant pendant
  la lecture, le moment est rempli automatiquement.
- En publiant un remix, un commentaire « J'ai remixé cette loop » peut être
  laissé sur l'original (case cochée par défaut).

## Ce qui est simulé

- **Utilisateurs** : 8 profils fictifs et votre compte local. La connexion
  (Google ou e-mail + code à 6 chiffres) est simulée : « Continue with Google »
  connecte directement, et le code e-mail s'affiche à l'écran au lieu d'être
  envoyé. Sans compte, on écoute, compose, remixe et télécharge une fois ; publier,
  liker, commenter et télécharger à nouveau ouvrent la fenêtre de connexion, puis
  l'action reprend toute seule. Les brouillons faits en invité passent sur le
  compte à la connexion (voir `design/comptes.md` dans le projet).
- **Publications** : 26 boucles de démonstration générées au premier lancement
  (dont 4 remixes), chacune avec une batterie adaptée à son genre. Likes et
  écoutes sont des compteurs locaux.
- **Commentaires** : une soixantaine de commentaires de démonstration ; les
  signalements sont seulement enregistrés localement (le commentaire est
  masqué pour vous).
- **Partage** : sans serveur, une loop que vous avez créée n'existe que dans
  votre navigateur. Le lien de partage contient donc la loop elle-même,
  compressée dans l'adresse ; chez le destinataire elle s'ouvre en lecture
  seule (écoute, MIDI, WAV, remix), sans commentaires. Les loops de démo ont
  un lien court.
- **Stockage** : tout est dans le `localStorage` du navigateur. Les données
  sont propres à ce navigateur et à cette adresse (http://localhost:5173) ;
  vider les données du site remet la démo à zéro.

## Limitations connues

- Une seule signature (4/4), 4 mesures.
- Le magnétisme s'applique au début des notes déplacées ; le redimensionnement
  ne se fait que par le bord droit.
- Undo / redo couvre les notes, pas les réglages de pistes (instrument, volume).
- Les instruments et les kits de batterie sont des synthétiseurs simples :
  crédibles en électronique, pas au niveau d'une banque d'échantillons
  (aucun kit acoustique pour l'instant).
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
    drums.ts         Lignes du kit (notes GM), patterns, swing, outils batterie
    composition.ts   Création, copie, remix, validation des données
    instruments.ts   Métadonnées des instruments (nom, programme GM)
  audio/       Lecture avec Tone.js
    engine.ts        Transport en boucle, mixage, prévisualisation des notes
    instruments.ts   Synthés (aucun échantillon externe)
    drums.ts         Kits de batterie synthétisés
    wav.ts           Rendu hors-ligne et encodage WAV
  editor/      Piano roll
    store.ts         État de l'éditeur (Zustand) : édition, historique, presse-papiers
    PianoRoll.tsx    Grille, clavier, règle, interactions souris
    DrumGrid.tsx     Grille de batterie (remplace le piano roll sur la piste Drums)
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
branche au même endroit (`getCurrentUser`, `requestEmailCode`, `signIn`,
`signOut`) ; les actions qui demandent un compte renvoient `AuthRequiredError`.

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

`Espace` lecture · `1/2/3/4` pistes · `D` crayon · `C` accords · `S` sélection ·
`Ctrl+Z / Ctrl+Maj+Z` annuler / rétablir · `Ctrl+C/X/V/D` copier / couper /
coller / dupliquer · `↑↓` transposer · `←→` déplacer · `Maj+←→` longueur ·
`I` renverser · `Q` quantifier · `U` humaniser · `G` ghost notes · `H` gamme · `?` aide.
