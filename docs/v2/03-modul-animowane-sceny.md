# Moduł: Animowane sceny ASCII (część 3)

Decyzje:
- **Wariant C:** osobny moduł obok stylów obrazkowych (pliki 01 i 02): przeglądarka gotowych scen z opcjami, eksport do MP4 i do interaktywnego komponentu.
- **Przejmujemy kod MIT** z github.com/bas3line/ascii (ascii.rest), zamiast pisać sceny od zera.

Oznaczenia: `kod` = sprawdzone w sklonowanym repozytorium (commit `2572c26`, 8 X 2026, wersja pakietu 0.2.1), `docs` = ze strony lub README, `proj` = nasz projekt, `proj?` = do decyzji, `test` = trzeba sprawdzić przy wdrożeniu.

---

## 1. Czym ten moduł różni się od reszty

| | Style obrazkowe (pliki 01–02) | Moduł scen (ten plik) |
|---|---|---|
| Wejście | zdjęcie lub wideo użytkownika | brak (scena rysuje obraz sama) |
| Co się edytuje | styl i jego parametry | scenę i jej opcje |
| Natura animacji | ruch dodawany do statycznego obrazu | ruch jest istotą sceny |
| Determinizm | zależny od efektu | z założenia tak (patrz sekcja 3) |

Moduł wpisuje się w potok jako **nowy typ źródła**: `Źródło = scena`. Do wyniku sceny da się potem zastosować Post FX i Color (plik 01, sekcje 7–8). Wariant „scena jako tekstura dla stylów” (B) zostaje na później.

---

## 2. Kontrakt sceny [kod]

Plik `src/types.ts` (67 linii). Scena to moduł TypeScript z dwoma eksportami:

```ts
export const meta = { name, category, note, cols, rows, fps, options?, clock?, palette?, ground?, cell? } satisfies Meta;
export default function nazwa(options?): Frame;     // Frame = (t, env?) => string
```

- `Frame` zwraca obraz w sekundzie `t` jako jeden napis: `rows` linii po `cols` znaków.
- `fps`: 0 oznacza nieruchomy obraz.
- `clock: true`: obraz zależy od rzeczywistego czasu lub daty.
- `palette` (do 64 kolorów `#rrggbb`), `ground` (tło): scena kolorowa, rysowana na canvasie, indeksy kolorów trafiają do `env.color` (`Uint8Array`, jeden indeks na komórkę).
- `cell`: wysokość komórki w jej szerokościach (domyślnie 2, czyli kształt znaku; 1 to kwadrat).
- `env.paper`: czy tekst jest ciemny na jasnym tle (sceny cieniowane odwracają skalę znaków).
- Kategorii w kodzie jest 15 (jest też `companies`, którego nie ma w README).

**Zależności:** pakiet nie ma żadnych zależności uruchomieniowych (React tylko jako opcjonalny peer) [kod]. Każda scena jest samowystarczalnym plikiem.

---

## 3. Co faktycznie siedzi w repozytorium [kod]

Liczby ze strony i README się rozjeżdżają (README 169, strona 191). **Kod ma 210 scen** (plus 1 plik pomocniczy `index.ts`), razem około 38 400 linii.

| Kategoria | Scen | Priorytet |
|---|---|---|
| effects | 8 | **P1** |
| generative | 13 | **P1** |
| shapes | 12 | **P1** |
| nature | 16 | **P1** |
| physics | 14 | **P1** |
| type | 9 | **P1** |
| space | 11 | P2 |
| scenes | 15 | P2 |
| creatures | 10 | P2 |
| objects | 14 | P2 |
| ui | 12 | P3 |
| data | 10 | P3 |
| logos | 28 | P3 |
| companies | 15 | P3 |
| distros | 23 | P3 |
| **Razem** | **210** | |

**P1 = 72 sceny, P2 = 50, P3 = 88.**

### Ważne fakty o scenach [kod]

- **Determinizm potwierdzony:** w żadnej scenie nie ma `Math.random`. Pięć scen używa zegara systemowego i dokładnie te pięć ma `clock: true`: `analog-clock`, `calendar`, `digital-clock`, `landscape`, `sundial`. W eksporcie trzeba im podać stały czas albo je pominąć.
- **Wszystkie sceny P1 są tekstowe** (bez palety, jeden kolor tuszu). Rozmiar 32–74 kolumn × 3–32 wierszy. To znacznie upraszcza pierwszy renderer: tło i jeden kolor.
- **Sceny kolorowe** (81 sztuk: 15 scen, 28 logo, 15 firm, 23 dystrybucje) mają paletę. Największe to 200×100 (alpine-dawn, aurora-fjord, deep-reef, desert-night, earthrise…). Dwie nowe względem strony: `lantern-lake`, `tokyo-rain`.
- **Klatki na sekundę:** 30 fps ma 101 scen, 15 fps 41, 20 fps 32, 24 fps 11, 10 fps 11, 8 fps 6, 12 fps 5, 25 fps 1. Dwie są nieruchome (`box-frames`, `dividers`). W P1: 26 z 72 pracuje w 30 fps.
- **Opcje:** 107 scen ma `options`, ale większość to logo i dystrybucje. Wśród scen użytecznych dla nas opcje mają tylko niektóre (lista niżej). Typowe sceny P1 (Donut, Cube, Doom Fire, Plasma, Tunnel…) **nie mają żadnych opcji** poza `fps`. Dlatego warstwa opcji modułu (sekcja 4) jest naprawdę potrzebna.
- **Samo odtwarzanie** (`src/mount.ts`, 203 linii): pętla `requestAnimationFrame` z limitem fps, pauza poza ekranem (`IntersectionObserver`), uwzględnia `prefers-reduced-motion` (pokazuje klatkę 0). Na canvasie rysuje przez **atlas** par (znak, kolor) rysowanych raz.
- **Atrybucje:** większość scen to własne prace autora. Część cytuje cudze algorytmy w nagłówku (np. Donut „after Andy Sloane’s donut.c”, glxgears „three gears of gears.c”). Logo i dystrybucje są rysowane z devicon (MIT) i Simple Icons (CC0).

### Opcje scen, które mają znaczenie dla P1 i P2 [kod]

| Scena | Opcje (domyślnie) |
|---|---|
| Big Text | `text` („hello”) |
| Typewriter | `prefix` („i make ”), `phrases` (lista) |
| Scramble | `phrases` (lista) |
| Dissolve | `words` (lista) |
| Glitch (type) | `text` („noise”) |
| Marquee | `text`, `speed` (12) |
| Morse | `text` („hello world”) |
| Wave Text | `text`, `amp` (1.25), `wavelength` (18), `speed` (8), `spacing` (0), `settle` |
| Fireflies | `seed` (7), `count` (44) |
| Fractal Tree | `seed` (4) |
| Starfield | `stars` (60), `speed` (1) |
| Solar System | `speed` (1) |
| Wave Interference | `wavelength` (5), `separation` (2.2) |
| Bouncing Balls | `balls` (3) |
| Newton’s Cradle | `lifted` (1) |
| Flag | `stripes` (5) |
| TV Static | `set` (true) |
| Saptarishi | `lines` (true) |
| Landscape | `hour`, `phase` (domyślnie z zegara) |

Reszta P1 i P2 nie ma opcji. **`seed` wystawiają tylko 4 sceny** (Fireflies, Fractal Tree, Candlesticks, Heatmap). Pozostałe mają ziarno zaszyte w kodzie, więc dają zawsze ten sam wynik. Nie obiecujemy suwaka `seed` we wszystkich scenach.

---

## 4. Opcje modułu (warstwa wspólna) `proj`

Sceny same prawie nie mają suwaków, więc moduł dodaje własne, wspólne:

| Opcja | Działanie | Uwaga |
|---|---|---|
| `speed` | mnożnik czasu (0.25×–4×) | skaluje `t` przekazywane do sceny |
| `fps` | liczba klatek na sekundę | górna granica sceny |
| `colorMode` | z palety sceny / jeden kolor (mono) | `mono` jest w oryginale [docs] |
| `inkColor`, `background` | kolor tuszu i tła (lub przezroczyste tło) | |
| `cellSize` | rozmiar komórki w pikselach | skaluje cały obraz |
| `font` | krój monospace | zmienia charakter rysunku |
| `outputSize` | rozmiar wyjścia | dla eksportu |
| opcje sceny | z tabeli wyżej | pokazywane tylko, gdy scena je ma |
| `loopSeconds` | długość pętli eksportu | **nowe**, patrz sekcja 6 |
| `at` | stały czas dla scen z `clock` | **nowe** |

Post FX i Color (plik 01) działają na wyniku sceny po rasteryzacji do canvasa.

---

## 5. Przejęcie kodu na licencji MIT

### Co dokładnie mówi licencja [kod]
Standardowy tekst MIT, `Copyright (c) 2026 bas3line`. Jedyny warunek: **notka o prawach autorskich i treść zezwolenia muszą być zachowane we wszystkich kopiach i istotnych fragmentach oprogramowania.** Link zwrotny jest w README tylko „mile widziany”, nie jest warunkiem [docs].
Nie jestem prawnikiem. To opis tego, co wynika z treści licencji.

### Co robimy
1. Zachowujemy w repozytorium plik z pełną licencją MIT i notką autora (np. `LICENSES/ascii.rest-MIT.txt`) oraz `THIRD_PARTY_NOTICES.md` z listą przejętych plików.
2. Zostawiamy nagłówki przejętych plików bez zmian.
3. W wyeksportowanym komponencie, który zawiera ich kod, dołączamy tę samą notkę.
4. Dodajemy w aplikacji podziękowanie i link do ascii.rest (dobra praktyka, nie wymóg).

### Co przejmujemy

| Element | Źródło | Uwagi |
|---|---|---|
| Kontrakt | `src/types.ts` | rozszerzamy o `loopSeconds` i `at` |
| Sceny P1 (72), potem P2 (50) | `src/pieces/<nazwa>.ts` | kopiujemy pliki bez zmian logiki |
| Wzór renderowania na canvasie | `src/mount.ts` | piszemy własny wariant bez `requestAnimationFrame` (sekcja 7) |
| Wzór komponentu | `src/ascii.ts` (tag `<ascii-art>`), `src/react.tsx`, `src/astro/` | wzór dla naszego eksportowanego komponentu |
| Katalog scen | `src/library.ts`, `src/index.ts` | wzór rejestru |

### Czego nie przejmujemy
- **Logo języków, dystrybucje i firmy (66 plików).** To znaki towarowe ich właścicieli. Autor sam zaznacza, że są pokazane tylko do nazwania języka lub dystrybucji. Dla narzędzia graficznego nic nie wnoszą.
- `src/terminal.ts` i `src/cli.ts` (wyjście do terminala, ok. 560 linii). Opcjonalnie później, jako eksport tekstowy.
- `site/`, `scripts/`, `.github/`.

---

## 6. Czego brakuje w oryginale (dopisujemy sami)

1. **`loopSeconds`.** Oryginał wymaga, żeby scena zapętlała się bez skoku, ale nie podaje długości pętli ani jej nie wymusza. Dla 72 scen P1 trzeba ją ustalić i sprawdzić testem: klatka w `t = 0` musi równać się klatce w `t = loopSeconds`. Test pokazał, że **tylko 9 z 30 scen startowych ma dokładną pętlę w 180 s** (lista w sekcji 11). Pozostałe dostaną długość klipu zamiast pętli albo pętlę wyszukaną z tolerancją.
2. **Stan między klatkami [test, sekcja 11].** Potwierdzone: **7 z 30 scen startowych działa poprawnie tylko przy odtwarzaniu kolejno od klatki 0** (doom-fire, reaction-diffusion, flow-field, snowfall, smoke, falling-sand, tesseract). Pamiętają ostatni czas i przesuwają stan o `t − last`, więc skok do dowolnej klatki daje inny obraz. Rozwiązaniem jest nasz `ScenePlayer`, który takie sceny odtwarza od zera przy skoku lub cofnięciu.
3. **Pięć scen z zegarem** (`analog-clock`, `calendar`, `digital-clock`, `landscape`, `sundial`): potrzebują `at`.

---

## 7. Rysowanie i potok `proj`

1. Scena zwraca klatkę jako tekst.
2. **Nasz rasteryzator offline** `renderFrame(scena, t, rozmiar) → canvas`: rysuje klatkę kroju monospace (z atlasem par znak-kolor jak w `mount.ts`), bez zegara przeglądarki, więc daje się wołać w pętli eksportu.
3. Wynik jest **klatką źródłową** dla Post FX, Color i Backdrop (plik 01).
4. Podgląd w aplikacji używa tego samego rasteryzatora w pętli czasu rzeczywistego.

**Dwa tryby:** tekst (cała P1: jeden tusz na tle) i kolor (sceny P2: indeksy palety). Zaczynamy od trybu tekstowego, bo jest prostszy.

**Uwaga o komórkach:** znak jest ok. dwa razy wyższy niż szeroki (`cell: 2`). Rasteryzator musi to uwzględniać, inaczej koła wyjdą jak elipsy.

---

## 8. Wymagania wobec eksportu (formaty ustalimy osobno)

Tylko to, co wynika z modułu:

- **MP4 i GIF:** klatka po klatce, `t = n / fps`, ze stałą długością z `loopSeconds`. Rozdzielczość niezależna od siatki sceny (siatka 40×22 może wyjść w 4K, ale wtedy to powiększone znaki, a nie więcej szczegółów).
- **PNG:** pojedyncza klatka (domyślnie klatka 0, bo scena gwarantuje, że jest dobrym stillem).
- **Interaktywny komponent:** web component (wzór: `<ascii-art piece="donut">`) i komponent React, z kodem scen z MIT i dołączoną notką licencyjną. Pauza poza ekranem, klatka 0 przy `prefers-reduced-motion`.
- **Tekst:** scena jest z natury tekstem, więc eksport klatki jako zwykłego tekstu jest prawie darmowy. Do decyzji.

---

## 9. Plan wdrożenia (małe kroki)

1. ✅ **Szkielet (zrobiony, sekcja 11):** skopiować `types.ts` i 30 scen startowych (lista niżej) z notką licencyjną. Test determinizmu i dostępu losowego (sekcja 6, punkt 2).
2. **Renderer offline** `renderFrame` (tryb tekstowy).
3. **Przeglądarka scen** z podglądem i opcjami wspólnymi.
4. **Eksport** (osobny plik 04).
5. **Reszta P1**, potem P2 (sceny kolorowe wymagają trybu z paletą).

**30 scen na start:** Doom Fire, Matrix Rain, Plasma, Tunnel, TV Static, Synthwave, Fireworks · Mandelbrot, Voronoi, Reaction Diffusion, Flow Field · Donut, Cube, Tesseract, Torus Knot, DNA Helix · Rain, Snowfall, Aurora, Fireflies, Campfire · Wave Interference, Pond Ripples, Falling Sand, Smoke · Big Text, Typewriter, Glitch, Wave Text, Scramble. (Wszystkie tekstowe; tylko Falling Sand, Snowfall i Reaction Diffusion są podejrzane o stan.)

---

## 10. Pytania do rozstrzygnięcia

1. Czy **P1 (72)** na start, a **P2 (50)** później, a P3 (88) poza zakresem?
2. Czy **UI i dane** (22 sceny) pomijamy całkiem, czy zostawiamy kilka (Equalizer, Radar) jako ozdobniki?
3. Czy dopisujemy **własne sceny** poza ascii.rest?
4. Czy chcesz **eksport tekstowy** jednej klatki?
5. Czy robimy repozytorium od razu z **katalogiem `LICENSES/`** i `THIRD_PARTY_NOTICES.md`, zanim skopiujemy pierwszą scenę?

---

## 11. Szkielet (krok 1 wykonany) i wyniki testów

Archiwum `ascii-scenes-szkielet.zip` zawiera projekt z 30 scenami startowymi:

- `LICENSES/ascii.rest-MIT.txt` i `THIRD_PARTY_NOTICES.md`: licencja MIT z notką autora i lista przejętych plików (wymóg z sekcji 5). Przeniesione uwagi z nagłówków: Donut („after Andy Sloane’s donut.c”) i Reaction Diffusion (model Gray-Scott).
- `src/types.ts` i `src/pieces/*.ts`: skopiowane bez zmian z commita `2572c26`.
- `src/registry.ts`: rejestr 30 scen. `src/player.ts`: nasz `ScenePlayer`.
- `scripts/`: trzy testy. `reports/`: wyniki.

**Wyniki (30 scen, Node 22.22, opcje domyślne):**

| Sprawdzenie | Wynik |
|---|---|
| Kształt klatki (`rows` × `cols`) | 30 z 30 |
| Determinizm (dwie świeże instancje, kolejne klatki) | 30 z 30 |
| Skok do dowolnej klatki bez odtwarzacza | **23 z 30**. Zawodzi 7: doom-fire, reaction-diffusion, flow-field, snowfall, smoke, falling-sand, tesseract |
| Skoki, cofanie i powtórzenia przez `ScenePlayer` | 30 z 30 |
| Wydajność | średnio poniżej 4 ms. Najwolniejsze: reaction-diffusion 3,5 ms, mandelbrot 2,2 ms, campfire 1,9 ms |
| Dokładna pętla (okno 2 s, do 180 s) | 9 z 30: plasma 30 s, voronoi 30 s, cube 18 s, mandelbrot 48 s, wave-interference 90 s, big-text 16 s, glitch 7 s, wave-text 57 s, scramble 121,15 s |

**Czego test nie obejmuje:** wariantów opcji (np. inny tekst w Big Text), `env.paper`, scen kolorowych z paletą ani dłuższych przebiegów niż 180 s. Wydajność mierzona w piaskownicy, więc to wartości orientacyjne.

**Wnioski dla eksportu:**
- Eksport MP4 działa poprawnie, jeśli klatki są wołane kolejno (`ScenePlayer.at(k)`). Nie wolno renderować klatek równolegle ani w kolejności losowej.
- Przy eksporcie z fps innym niż fps sceny stan symulacji nadal przesuwa się w krokach `1/fps` sceny. Klatka wideo bierze najbliższą klatkę sceny.
- Dla 21 scen bez dokładnej pętli potrzebujemy albo długości klipu, albo wyszukiwania pętli z tolerancją (porównanie z progiem różnic, a nie identyczność). To następny krok.

**Następne kroki:** (a) renderer offline `renderFrame` (rasteryzacja klatki na canvasie), (b) wyszukiwanie pętli z tolerancją, (c) reszta P1.
