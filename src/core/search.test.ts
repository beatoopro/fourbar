import { describe, expect, it } from 'vitest';
import { buildSeedPublications } from '../services/local/seed';
import {
  chordProgression,
  countActiveFilters,
  filtersFromParams,
  filtersToParams,
  matchesFilters,
  matchesKey,
  matchesProgression,
  parseProgression,
  type AdvancedFilters,
} from './search';

const seeds = buildSeedPublications();
const byTitle = (t: string) => seeds.find((p) => p.composition.title === t)!.composition;

describe('progression d’accords', () => {
  it('reconnaît les accords des loops de démo, fondamentale prise sur la basse', () => {
    expect(chordProgression(byTitle('Morning Coffee')).map((c) => c.name)).toEqual(['Gm7', 'C7', 'Fmaj7', 'A#maj7']);
    // Arpèges : analysés sur la demi-mesure.
    expect(chordProgression(byTitle('Shadows')).map((c) => c.name)).toEqual(['Dm', 'A#', 'C']);
    // iii9 diatonique (absent de detectChord) : retombe sur la triade.
    expect(chordProgression(byTitle('Study Session')).map((c) => c.name)).toEqual(['Cmaj9', 'Bm', 'Am9', 'D9']);
  });

  it('cherche en chiffres romains selon la tonalité de la loop', () => {
    const coffee = byTitle('Morning Coffee'); // F majeur : ii–V–I–IV
    expect(matchesProgression(coffee, 'ii-V-I')).toBe(true);
    expect(matchesProgression(coffee, 'ii–V–I–IV')).toBe(true);
    expect(matchesProgression(coffee, 'IV ii')).toBe(true); // retour au début de la boucle
    expect(matchesProgression(coffee, 'V-ii')).toBe(false);
    expect(matchesProgression(coffee, 'II-V-I')).toBe(false); // II majeur ≠ ii
    expect(matchesProgression(byTitle('Late Night Tokyo'), 'i VI III VII')).toBe(true);
  });

  it('cherche par noms d’accords, extensions ignorées et enharmonies acceptées', () => {
    expect(matchesProgression(byTitle('Northern Lights'), 'Am F C G')).toBe(true);
    expect(matchesProgression(byTitle('Morning Coffee'), 'Gm C F Bb')).toBe(true);
    expect(matchesProgression(byTitle('Morning Coffee'), 'G C')).toBe(false); // G majeur ≠ Gm7
  });

  it('refuse une recherche illisible', () => {
    expect(parseProgression('hello')).toBeNull();
    expect(parseProgression('  ')).toBeNull();
  });
});

describe('filtres avancés', () => {
  it('filtre la tonalité, avec la relative en option', () => {
    const cMaj = { root: 0, scale: 'major' };
    const aMin = { root: 9, scale: 'minor' };
    expect(matchesKey(aMin, { keyRoot: 0, keyMode: 'major' })).toBe(false);
    expect(matchesKey(aMin, { keyRoot: 0, keyMode: 'major', relativeKey: true })).toBe(true);
    expect(matchesKey(cMaj, { keyRoot: 9, keyMode: 'minor', relativeKey: true })).toBe(true);
    expect(matchesKey({ root: 2, scale: 'dorian' }, { keyMode: 'minor' })).toBe(true);
  });

  it('combine BPM, pistes, instrument et origine', () => {
    const pass = (title: string, f: AdvancedFilters) => {
      const p = seeds.find((s) => s.composition.title === title)!;
      return matchesFilters(p.composition, p.publishedAt, f);
    };
    expect(pass('Morning Coffee', { bpmMin: 75, bpmMax: 80 })).toBe(true);
    expect(pass('Morning Coffee', { bpmMin: 80 })).toBe(false);
    expect(pass('Warehouse 6AM', { tracks: { melody: 'without' } })).toBe(true); // pas de mélodie
    expect(pass('Morning Coffee', { tracks: { melody: 'without' } })).toBe(false);
    expect(pass('Late Night Tokyo', { instrument: 'organ' })).toBe(true);
    expect(pass('Late Night Tokyo', { instrument: 'bell' })).toBe(false);
    expect(pass('Morning Coffee', { origin: 'remix' })).toBe(false);
    expect(pass('Morning Coffee (boom bap flip)', { origin: 'remix' })).toBe(true);
  });

  it('se lit et s’écrit dans l’URL', () => {
    const f: AdvancedFilters = {
      bpmMin: 80,
      keyRoot: 9,
      keyMode: 'minor',
      relativeKey: true,
      artist: 'lina',
      date: 'week',
      tracks: { drums: 'with', melody: 'without' },
      instrument: 'epiano',
      progression: 'ii-V-I',
      origin: 'original',
    };
    const params = filtersToParams(f);
    expect(params.get('bpm')).toBe('80-');
    expect(params.get('key')).toBe('Am');
    expect(filtersFromParams(new URLSearchParams(params.toString()))).toEqual(f);
    expect(countActiveFilters(f)).toBe(9);
    expect(filtersFromParams(new URLSearchParams('bpm=abc&key=H&date=year'))).toEqual({});
  });
});
