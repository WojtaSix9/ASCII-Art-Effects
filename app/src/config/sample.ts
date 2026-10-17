// Zdjęcia robocze (05, sekcja 4). Od 17 X 2026: 43 zdjęć użytkownika (photos-inbox/, lista nazw w docs/11-zdjecia.md),
// przypisane do efektów losowo, ale na stałe (ziarno SAMPLE_SEED): każde zdjęcie wypada 2–3 razy, sąsiednie efekty mają różne zdjęcia.
// Jedno miejsce konfiguracji: hero, edytor i miniatury biorą zdjęcia stąd. Po zmianie listy lub ziarna: `npm run thumbs`
// (test ui-check sprawdza, że miniatury pasują do przypisania i do plików zdjęć).
export type Sample = {
  src: string;
  alt: string;
  /** Punkt, który ma zostać w kadrze przy przycinaniu (0–1 od lewej i od góry); domyślnie środek. */
  focus?: { x: number; y: number };
};

export const SAMPLES: Sample[] = [
  { src: '/sample/photo-01-atrium.jpg', alt: "Drewniane atrium z przeszklonym dachem, widok od dołu" },
  { src: '/sample/photo-02-plants.jpg', alt: "Dwoje ludzi siedzi na podłodze wśród roślin, jedno gra na ukulele" },
  { src: '/sample/photo-03-pink-frame.jpg', alt: "Różowa rama stoi w płytkiej wodzie, za nią góry w fioletowym świetle" },
  { src: '/sample/photo-04-cloud-island.jpg', alt: "Ośnieżona góra z lasem na wyspie z chmur, błękitne niebo" },
  { src: '/sample/photo-05-cloud-car.jpg', alt: "Różowy samochód jedzie drogą wśród chmur" },
  { src: '/sample/photo-06-cloud-sea.jpg', alt: "Białe chmury nad spokojną wodą, granatowe niebo" },
  { src: '/sample/photo-07-pink-hills.jpg', alt: "Samotne drzewo na różowych pagórkach pod chmurami" },
  { src: '/sample/photo-08-castle.jpg', alt: "Zamek na latającej wyspie, za nim świecący pierścień na niebie" },
  { src: '/sample/photo-09-ruins-moon.jpg', alt: "Ruiny świątyni na zielonych wzgórzach, wielki księżyc" },
  { src: '/sample/photo-10-cloud-temple.jpg', alt: "Biała świątynia i domy na chmurach" },
  { src: '/sample/photo-11-domes.jpg', alt: "Domy-kopuły z ciepłym światłem nad stawem wśród drzew" },
  { src: '/sample/photo-12-fountain.jpg', alt: "Ogród z fontanną i kwiatami nad jeziorem w górach" },
  { src: '/sample/photo-13-snow-waves.jpg', alt: "Fale śniegu i ostre szczyty w pastelowym świetle" },
  { src: '/sample/photo-14-facade.jpg', alt: "Ostra krawędź nowoczesnego budynku na tle błękitnego nieba" },
  { src: '/sample/photo-15-torus.jpg', alt: "Opalizujący torus na różowo-fioletowym tle" },
  { src: '/sample/photo-16-sunset-bay.jpg', alt: "Zachód słońca nad zatoką między górami" },
  { src: '/sample/photo-17-holo-heads.jpg', alt: "Holograficzne, opalizujące głowy w płynnej masie" },
  { src: '/sample/photo-18-holo-twin.jpg', alt: "Dwie złączone holograficzne głowy na fioletowym tle" },
  { src: '/sample/photo-19-pyramid.jpg', alt: "Szklana piramida odbita w wodzie, różowe chmury" },
  { src: '/sample/photo-20-purple-sun.jpg', alt: "Słońce i góry odbite w wodzie, fiolet i błękit" },
  { src: '/sample/photo-21-holo-face.jpg', alt: "Holograficzna twarz w chromowanych odcieniach" },
  { src: '/sample/photo-22-orange-flower.jpg', alt: "Pomarańczowy kwiat na czarnym tle" },
  { src: '/sample/photo-23-ribbon.jpg', alt: "Różowo-fioletowa wstęga skręcona w przestrzeni" },
  { src: '/sample/photo-24-hibiscus.jpg', alt: "Biały hibiskus wśród ciemnych liści" },
  { src: '/sample/photo-25-shadows.jpg', alt: "Czarno-biała architektura z ostrymi cieniami" },
  { src: '/sample/photo-26-pink-fog.jpg', alt: "Różowa smuga mgły na jasnym niebie" },
  { src: '/sample/photo-27-neon-blue.jpg', alt: "Niebiesko-różowe światło neonu na ciemnym tle" },
  { src: '/sample/photo-28-projector.jpg', alt: "Łuk światła lampy w kolorach zachodu słońca" },
  { src: '/sample/photo-29-neon-arc.jpg', alt: "Różowy łuk neonu na czarnym tle" },
  { src: '/sample/photo-30-neon-ring.jpg', alt: "Świecący pierścień nad ciemnym wzgórzem" },
  { src: '/sample/photo-31-glass-grid.jpg', alt: "Szklana figura na czarno-białej siatce" },
  { src: '/sample/photo-32-bouquet.jpg', alt: "Bukiet róż i suszonych kwiatów na czarnym tle" },
  { src: '/sample/photo-33-gradient.jpg', alt: "Gradient neonu od niebieskiego do pomarańczowego" },
  { src: '/sample/photo-34-frames.jpg', alt: "Szereg ram nad wodą prowadzi do łóżka, pastelowe góry" },
  { src: '/sample/photo-35-eye-flower.jpg', alt: "Metaliczny kwiat z okiem nad tęczą i chmurami" },
  { src: '/sample/photo-36-red-moon.jpg', alt: "Czerwony księżyc nad ciemnymi górami" },
  { src: '/sample/photo-37-brutalist.jpg', alt: "Betonowy budynek brutalistyczny w czerni i bieli" },
  { src: '/sample/photo-38-lioness.jpg', alt: "Lwica na turkusowych falach przed czerwonym słońcem" },
  { src: '/sample/photo-39-eye.jpg', alt: "Kolorowe oko otoczone kulami i falami" },
  { src: '/sample/photo-40-stairway.jpg', alt: "Schody do drzwi wśród różowych chmur" },
  { src: '/sample/photo-41-cosmic.jpg', alt: "Różowe kosmiczne chmury i jasna linia światła" },
  { src: '/sample/photo-42-halo.jpg', alt: "Mężczyzna z pierścieniem światła wokół głowy, czerwone tło" },
  { src: '/sample/photo-43-projection.jpg', alt: "Kobieta w kolorowej projekcji światła na ciemnym tle" },
];
export const focusOf = (s: Sample) => s.focus ?? { x: 0.5, y: 0.5 };

/** Ziarno losowego przypisania zdjęć do efektów (stałe, żeby miniatury i kadry „przed” zawsze do siebie pasowały). */
export const SAMPLE_SEED = 20261017;
function shuffled(n: number, seed: number) {
  let a = seed >>> 0; const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const p = Array.from({ length: n }, (_, i) => i); for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } return p;
}
const ORDER = shuffled(SAMPLES.length, SAMPLE_SEED);
/** Zdjęcie dla i-tego elementu listy: kolejne elementy przechodzą przez wszystkie zdjęcia w losowej kolejności, potem od nowa. */
export const sampleAt = (i: number) => SAMPLES[ORDER[((i % SAMPLES.length) + SAMPLES.length) % SAMPLES.length]];

/** Zdjęcie hero (wybór użytkownika 17 X: photos-inbox/4124.jpg). Osobne od listy efektów, więc nie zmienia przypisania miniatur. */
export const HERO_SAMPLE: Sample = { src: '/sample/hero-geranium.jpg', alt: 'Fioletowe i różowe kwiaty bodziszka na czarnym tle', focus: { x: 0.5, y: 0.45 } };
