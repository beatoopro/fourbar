export const GENRES = ['Jazz', 'Lo-fi', 'Hip-hop', 'Neo-soul', 'R&B', 'Pop', 'House', 'Cinematic', 'Trap'];

export const MOODS = ['Chill', 'Melancholic', 'Happy', 'Dark', 'Dreamy', 'Energetic', 'Romantic', 'Epic'];

export const SORTS = [
  { id: 'trending', label: 'Trending' },
  { id: 'popular', label: 'Popular' },
  { id: 'recent', label: 'Recent' },
  { id: 'remixed', label: 'Most remixed' },
] as const;

/** BPM suggéré par genre, pour remplir automatiquement la publication. */
export const GENRE_BPM: Record<string, number> = {
  Jazz: 120,
  'Lo-fi': 80,
  'Hip-hop': 90,
  'Neo-soul': 76,
  'R&B': 70,
  Pop: 110,
  House: 124,
  Cinematic: 90,
  Trap: 140,
};
