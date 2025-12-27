export interface MusicSample {
  id: string;
  name: string;
  artist: string;
  genre: "soul" | "funk" | "jazz";
  url: string;
  duration?: number;
  bpm?: number;
  drumless?: boolean;
}

export const musicSamples: MusicSample[] = [
  {
    id: "soul_ramon_ideals",
    name: "Ideals",
    artist: "Ramon Tavernier",
    genre: "soul",
    url: "/samples/soul/ramon_tavernier_ideals.mp3",
    bpm: 85,
    drumless: true,
  },
  {
    id: "soul_gary_valentine",
    name: "My Funny Valentine",
    artist: "Gary Bartz",
    genre: "soul",
    url: "/samples/soul/gary_bartz_my_funny_valentine.mp3",
    bpm: 72,
    drumless: true,
  },
  {
    id: "soul_gypsy_woman",
    name: "Gypsy Woman",
    artist: "Unknown",
    genre: "soul",
    url: "/samples/soul/gypsy_woman.wav",
    bpm: 95,
    drumless: true,
  },
  {
    id: "funk_hareton_quarto",
    name: "Quarto de Hotel",
    artist: "Hareton Salvanini",
    genre: "funk",
    url: "/samples/soul/hareton_salvanini_quarto_de_hotel.mp3",
    bpm: 100,
    drumless: true,
  },
  {
    id: "funk_holiday_dream",
    name: "Today Dream",
    artist: "Holiday Mood Orchestra",
    genre: "funk",
    url: "/samples/soul/holiday_mood_orchestra_today_dream.mp3",
    bpm: 88,
    drumless: true,
  },
  {
    id: "funk_james_brown_hot_pants",
    name: "Hot Pants",
    artist: "James Brown",
    genre: "funk",
    url: "/samples/soul/james_brown_hot_pants.mp3",
    bpm: 108,
    drumless: true,
  },
  {
    id: "jazz_cathedral_well",
    name: "It Is Well With My Soul",
    artist: "The Cathedral Quartet",
    genre: "jazz",
    url: "/samples/soul/cathedral_quartet_it_is_well.mp3",
    bpm: 76,
    drumless: true,
  },
  {
    id: "jazz_orchestra_study",
    name: "Study",
    artist: "The New Jazz Orchestra",
    genre: "jazz",
    url: "/samples/soul/new_jazz_orchestra_study.mp3",
    bpm: 92,
    drumless: true,
  },
];

export function getSamplesByGenre(genre: string): MusicSample[] {
  return musicSamples.filter((s) => s.genre === genre);
}

export function getRandomSample(genre: string): MusicSample {
  const samples = getSamplesByGenre(genre);
  if (samples.length === 0) {
    throw new Error(`No samples found for genre: ${genre}`);
  }
  return samples[Math.floor(Math.random() * samples.length)];
}

export function getSampleById(id: string): MusicSample | undefined {
  return musicSamples.find((s) => s.id === id);
}
