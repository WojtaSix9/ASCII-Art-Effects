// Zdjęcia robocze (05, sekcja 4; decyzja użytkownika 15 X 2026: dwa zdjęcia używane naprzemiennie).
// Jedno miejsce konfiguracji: hero, edytor i miniatury biorą zdjęcia stąd. Podmiana: zastąp plik w public/sample/
// (ok. 1500–1600 px szerokości, < 500 KB), popraw `alt` i `focus`, potem `npm run thumbs`.
export type Sample = {
  src: string;
  alt: string;
  /** Punkt, który ma zostać w kadrze przy przycinaniu (0–1 od lewej i od góry). */
  focus: { x: number; y: number };
};

export const SAMPLES: Sample[] = [
  {
    src: '/sample/photo-1.jpg',
    alt: 'Kamienna dłoń z fioletowymi kwiatami trzyma pralkę na łące, w tle las i zachmurzone niebo',
    focus: { x: 0.5, y: 0.45 },
  },
  {
    src: '/sample/photo-2.jpg',
    alt: 'Kolaż: stary samochód na żółtej drodze w górach, różowe i turkusowe zbocza, chmury i pomarańczowe słońce',
    focus: { x: 0.5, y: 0.6 },
  },
];

/** Zdjęcie dla i-tego elementu listy (naprzemiennie). */
export const sampleAt = (i: number) => SAMPLES[((i % SAMPLES.length) + SAMPLES.length) % SAMPLES.length];

/** Zdjęcie hero: szeroki kolaż lepiej znosi kadr ok. 2:1. */
export const HERO_SAMPLE = SAMPLES[1];
