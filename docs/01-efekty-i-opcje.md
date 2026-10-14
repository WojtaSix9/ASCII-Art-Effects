# ASCII Magic — rodzaje efektów i opcje modyfikacji (część 1)

Specyfikacja robocza pod własną implementację w Claude Code.
Źródła i oznaczenia przy każdej informacji:

- **[docs]** dokumentacja ascii-magic.com/docs (stan z 28 IX 2026, generowana z kodu silnika)
- **[UI]** zrzuty ekranu z edytora (wersja darmowa, widok LEGO, Dither, Characters)
- **[?]** wniosek lub szacunek, niepotwierdzony

---

## 1. Model potoku

```
Źródło (obraz/wideo)
  → Styl (1 z 91 trybów renderowania)
  → Post FX (do 28 efektów, STAŁA kolejność, niezależna od kolejności włączania)
  → Warstwa tekstu (zawsze ostatnia, nie podlega gradingowi)
```

- **[docs]** Post efekt nie zmienia stylu, działa na klatce, którą styl narysował. Dlatego zmiana stylu zachowuje stos efektów.
- **[docs]** Efekt zależny od siatki glifów nie robi nic w stylu bez glifów.
- **[docs]** Eksport to ten sam render w większej skali. Promienie blura, odstępy scan lines, offsety chromatic, rozmiar pixelate/halftone, wysokość slice'ów glitcha i rozmiar komórki ASCII mnożą się przez skalę eksportu. Podgląd i eksport wyglądają tak samo.
- **[docs]** Wszystko renderuje się lokalnie w przeglądarce (canvas). Jedyny krok serwerowy to tryb generatywny (poza zakresem tego pliku).
- **[docs]** Wynik to obraz, nie tekst. Brak eksportu czystego tekstu i SVG. **Wyjątek [strona stylu Braille]:** tam można skopiować surowy tekst Unicode braille (patrz sekcja 10).

### Struktura panelu edytora [UI]

Nagłówek (silnik/styl) → **Backdrop** → parametry stylu → **Intensity** (tylko tryby znakowe) → **Blur**.

Zakładki boczne (ikony), nie wszystkie widoczne w każdym stylu:
Style (Aa lub siatka) · warstwy **[?]** · Animation (play) · Lights (słońce) · Color (kropla) · Post FX (iskra) · kadr **[?]**.
Dither ma tylko 5 zakładek (bez warstw i Lights).

---

## 2. Style — 10 kategorii, 101 kafelków, 91 trybów

**[docs]** Kafelek to wpis w przeglądarce stylów, tryb to tryb renderowania. Część trybów ma kilka kafelków: 10 tekstur Glass to ten sam tryb `liquidglass` z różnym `glassStyle`, a Riso Pop to `asciiStudio` z przypiętą paletą. Wybór kafelka ustawia tryb i nakłada jego przypięte parametry na domyślne.
**[docs]** Warianty to zapisane zestawy parametrów, nie osobne tryby. Darmowe tryby mają po 4 warianty, Stippling 4, Forms 7. Przez MCP wariant to indeks (`variant: 0`).
F = darmowy, P = Pro. Tier dotyczy trybu, więc wszystkie kafelki trybu Pro są Pro.

### ASCII i tekst (6)
Characters `characters` F · ASCII Studio `asciiStudio` P · Block `block-chars` F · Dots `dots` F · Mixed `mixed` F · Braille `braille` F

### Piksele i bloki (6)
Pixel Art `pixel` F · Mosaic `mosaic` F · LEGO `lego` F · Voxel `3d` F · Hex Mosaic `hexmosaic` P · LED Matrix `ledmatrix` P

### Druk i papier (16)
Riso Pop `riso-pop` (na `asciiStudio`) P · Dither `dither` F · Stippling `stippling` P · Risograph `risograph` P · Comic `comic` P · Sketch `sketch` P · Engraving `engraving` P · Warhol `warhol` P · Cyanotype `blueprint` P · Halftone `halftone` P · Woodblock `ukiyoe` P · Posterize `posterize` P · Mezzotint `mezzotint` P · Pointillize `pointillize` P · Crosshatch `crosshatch` P · CMYK Drops `halftonecmyk` P

### Geometryczne (15)
Cross `cross` F · Diamond `diamond` F · Lines `lines` F · Diagonal `diagonal` F · Specimen `specimen` P · Low Poly `lowpoly` P · Droste `droste` P · Truchet `truchet` P · Iso Extrude `isoextrude` P · Flow Field `flowfield` P · Lattice `lattice` P · Topography `topography` P · Forms `forms` P · Schematic `schematic` P · Neon Grid `neongrid` P

### Zniekształcenia (8), wszystkie P
Smudge `smudge` · Pinch `pinch` · Spherize `spherize` · Twirl `twirl` · ZigZag `ripple` · Ripple `zigzag` · Polar `polar` · Shear `shear`
**[docs]** Etykiety ZigZag i Ripple są zamienione względem kluczy. Kluczem jest zawsze `id`, nie nazwa.

### Rozmycie i ostrość (4), wszystkie P
Motion Blur `motionblur` · Tilt-Shift `tiltshift` · Gaussian Blur `gaussianblur` · Radial Blur `radialblur`

### Glitch i sygnał (10), wszystkie P
CRT Screen `crt` · Pixel Sort `pixelsort` · Forensics `forensics` · Digital Distortion `glitch` · Datamosh `datamosh` · Lofi `lofi` · RGB Split `rgbsplit` · Scanline `scanline` · Thermal `thermal` · Beacon `beacon`

### Światło i kolor (11)
Disco `disco` F · Anaglyph 3D `anaglyph` P · Gradient Map `gradientmap` P · Prism `prism` P · Dreamdust `dreamdust` P · Light Wind `lightwind` P · Kaleidoscope `starburst` P · Warpbloom `warpbloom` P · Duotone `duotone` P · Edge Glow `edgeglow` P · Aberration `lens` P

### Szkło (16), wszystkie P
Frosted Glass `frostedglass` · Tinted Glass `stainedglass` · Shatter `shatter` · Vitrine `vitrine` · Glass Orb `glassorb` · Fluted Glass `flutedglass`
oraz 10 tekstur `liquidglass` (parametr `glassStyle`): Cross Reeded `glass-cross` · Hammered `glass-hammered` · Diamond Glass `glass-diamond` · Hexagon `glass-hexagon` · Ripple `glass-ripple` · Ice Crackle `glass-crackle` · Chevron Prism `glass-chevron` · Seedy Bubbles `glass-seedy` · Glass Pixel `glass-pixel` · Jello `glass-jello`

### Materiał i tekstura (9), wszystkie P
Waves `waves` · Oil Paint `oilpaint` · Watercolor `watercolor` · Chrome `chrome` · Thin-Film `thinfilm` · Marble `marble` · Molten Metal `molten` · Crystallize `crystallize` · Emboss `emboss`

---

## 3. Parametry wspólne (tryby glifowe i siatkowe)

**[docs]** Domyślne wartości to wartości fabryczne.

| Parametr | Domyślnie | Zakres | Działanie |
|---|---|---|---|
| `fontSize` | 11 | 3–80 | Rozmiar komórki w px. Panel nazywa go Font Size, Dot Size, Pixel Size lub Block Size zależnie od trybu, ale to jedna wartość. |
| `charSet` | `@#S08Xx+=-;:. ` | 17 presetów lub własny | Skala tonalna od najciemniejszego znaku. Czyta ją tylko tryb Characters. |
| `coverage` | 100 | 0–100 | Zależy od rodziny trybu, patrz niżej. |
| `bgMode` | blur | blur, solid, original, none | Tło za glifami. `none` zachowuje alfę (tylko PNG). |
| `bgBlur` | 8 | 0–60 | Siła rozmycia tła, tylko w trybie blur. |
| `brightness` | 0 | -100…100 | Na źródle, przed mapowaniem tonu na glify. |
| `contrast` | 100 | -100…100 wg docs | Wg docs neutralny = 0, więc 100 to już mocny boost. **[?]** Zrzuty mu przeczą, patrz sekcja 9. |
| `invert` | false | przełącznik | Odwraca mapowanie ton → glif. |
| `invertImage` | false | przełącznik | Negatyw gotowej klatki, stosowany na końcu. Różne od `invert`. |

### Coverage — trzy różne zachowania
- **Tryby kafelkowe** (Pixel Art, LEGO, Mosaic, Voxel, Disco): pomija komórki ciemniejsze od progu, czyli gubi ciemne, zostawia jasne.
- **Tryby tekstowe i geometryczne:** deterministyczne wycinanie komórek po haszu, więc siatka rzedniej równomiernie. Te same komórki znikają w każdej klatce, więc animacja nie migocze.
- **Tryby bez siatki komórek:** ignorują parametr (suwak się rusza, nic się nie zmienia).

### Panel Backdrop [UI]
- Mode: Blurred Image (inne opcje nieznane, wg docs `bgMode`: blur/solid/original/none)
- Softness: 8px lub 2px (= `bgBlur`, pasek zgadza się z zakresem 0–60)
- Opacity: 100%

---

## 4. Zestawy znaków (17)

Kolejność: od najgęstszego znaku do najrzadszego (kolejność **gęstości** pokrycia komórki, nie jasności); końcowa spacja to pusta komórka (bez niej nie da się narysować pustej komórki). To, który koniec rampy dostają jasne partie obrazu, zależy od konwencji: w naszym silniku domyślnie jasny ton = gęsty znak (jasny tekst na ciemnym tle), `invert` odwraca (brief 00, sekcja 3; `engine/src/effects/grid.ts`, `charAt`).

| Preset | Grupa | Ramp |
|---|---|---|
| Standard | Classic | `@#S08Xx+=-;:. ` |
| Classic ASCII | Classic | `@%#*+=-:. ` |
| Ink | Classic | `@&$%#?*+~:. ` |
| Minimal | Classic | `█▄▀ ` |
| Forensic | Classic | stała wewnętrzna (patrz uwaga) |
| Blocks | Blocks | `█▓▒░ ` |
| Bars | Blocks | `█▇▆▅▄▃▂▁ ` |
| Quadrants | Blocks | `█▛▙▟▜▚▞▘▝ ` |
| Braille | Blocks | `⣿⣷⣦⣤⣠⣄⡄⠆⠄⠂ ` |
| Numeric | Coded | `8069453271. ` |
| Binary | Coded | `10 ` |
| Hacker | Coded | `@#10Xx*+-. ` |
| Alpha | Coded | `WMBHAXKOQwvcr:. ` |
| Dots | Glyphs | `●◕◑◔○∙·. ` |
| Geometric | Glyphs | `█◆◼▲▼◇△▽·. ` |
| Math | Glyphs | `#ΣΔΨΩ×÷+·. ` |
| Katakana | Glyphs | `ﾊﾐﾋﾂｳｼﾅﾓﾆｻﾜｵﾘｱﾎﾃﾏｹﾒｰ･ ` |

**[docs]** Dokładnie ten ramp Forensic przełącza renderer na ścieżkę bitmapowych stempli zamiast rysowania fontem. Zmiana o jeden znak wraca do zwykłego renderu.

---

## 5. Silnik Dither (tryb `dither`, darmowy)

**[docs]** 15 algorytmów × 15 palet = 225 kombinacji.

### Algorytmy
- **Uporządkowane (stabilne w animacji):** `bayer2`, `bayer4`, `bayer8`, `bayer16`, `halftone` (klastrowy punkt), `radial`, `linesH`, `linesV`, `linesD`
- **Szum:** `whiteNoise`, `blueNoise`
- **Dyfuzja błędu (organiczne, do stillów):** `floyd` (Floyd–Steinberg), `atkinson`, `stucki`, `sierraLite`

**[docs]** Dyfuzja błędu w wideo „gotuje się”, bo błąd jednego piksela przenosi się na sąsiadów. Do ruchu używaj algorytmów uporządkowanych.

### Palety (id)
`mono` (1-bit) · `grey4` (4 poziomy) · `grey8` (8 poziomów) · `gameboy` · `cga0` · `cga1` · `pico8` (16) · `c64` (16) · `nes16` (16) · `rgb3` (8) · `cyberpunk` · `pastel` · `riso` · `sepia` · `original` (zachowuje kolory, dithering tylko luminancji)

**[docs]** Opisy palet w dokumentacji są przesunięte względem nazw, więc nie zamieszczam ich. Jakie dokładnie kolory ma paleta, trzeba sprawdzić w edytorze.

### Parametry panelu Dither [UI]

| Parametr | Wartość na zrzucie | Szacowany zakres [?] |
|---|---|---|
| Algorithm | Horizontal Lines / Atkinson | 15 opcji |
| Palette | Original colours / Sepia | 15 opcji, przy palecie z kolorami widać próbki |
| Chroma | Standard | opcje nieznane |
| Pixel Size | 1 | min 1, max nieznany |
| Effect Strength | 100 | 0–100 |
| Contrast | 158 / 118 | 0–200 |
| Threshold | 71 / 50 | 0–100 |
| Angle | 0° | tylko przy algorytmach liniowych (widoczny przy Horizontal Lines, brak przy Atkinson) |

---

## 6. Panel trybu Characters (Block, Diamond) [UI]

- **Block Size** (Block) / **Font Size** (Diamond): 11 / 12 — to `fontSize`
- **Blend Mode:** Normal (lista nieznana)
- **Char Opacity:** 100%
- **Przełączniki:** Invert Mapping, Dot Grid Overlay, Randomize Characters
- **Intensity:** Coverage 100%, Brightness 0, Contrast 100 lub 120

Wartości Contrast 120 i Softness 2px na zrzucie Diamond różnią się od domyślnych z docs. Prawdopodobnie efekt Restyle/Shuffle **[?]**.

---

## 7. Zakładki edytora wspólne dla stylów [UI]

### Animation (przy zrzucie: LEGO)
Animated (przełącznik) · Type: Signature (lista nieznana) · Speed 1× (wg docs 0.25×–4×) · Intensity 60% · Animate Matrix (przełącznik) · Matrix Shimmer (przełącznik) · Matrix Speed 1× (pasek bez wypełnienia, **[?]** może nieaktywny).
Zawartość tej zakładki może zależeć od stylu.

### Lights
Enable Lights · pole 2D z siatką kropek (dotknięcie dodaje światło, przeciągnięcie przesuwa, kliknięcie zaznacza, max 4 światła, kosz) · Radius 30 · Intensity 80. Zrzut był ucięty, więc pod spodem mogą być kolejne kontrolki.

### Color
- Chipy: None, B&W, Sepia, Warm, Cool, Vintage, Fade, Cyber
- Photo Filter (lista „Choose a filter…”, zawartość nieznana)
- Tint (kolor) · Tint Opacity 0% · Blend: Multiply
- Saturation 100% · Vibrance 0 · Hue 0°
- Gradient Map (None) · Grayscale 0% · Invert Image (przełącznik)

---

## 8. Post FX — 28 efektów

### Kolejność renderowania [docs]
1. Colour overlay, potem greyscale
2. Blur
3. Vignette, scan lines, bloom
4. Chromatic, RGB split, CRT curve, glitch, film grain
5. Pixelate, halftone (rasteryzacja, kwantyzuje wszystko wcześniej)
6. Warpy: pinch, spherize, twirl, ripple, zigzag, polar, shear
7. Reduce noise, diffuse, threshold, fragment, ASCII
8. Film dust, sharpen, noise
9. Saturation i hue → Levels → Curves
10. Warstwa tekstu

**Wyjątki:** Character Bloom i Character Chromatic rysują się per glif podczas malowania siatki znaków (nie jako pass po klatce), więc działają tylko w trybach glifowych i nie da się zmienić ich kolejności.
**[UI]** Kolejność na liście w edytorze nie odpowiada kolejności renderowania.

### Tabela efektów
Zakres suwaka podany jest tak, jak go wymusza panel. Parametr bez zakresu to przełącznik, kolor lub lista. W nawiasie domyślna opcja listy, jeśli znana.

**Darmowe (16)**

| Efekt | Klucz | Parametry |
|---|---|---|
| Vignette | `vignette` | `center` (xy), `intensity` 0–100, `size` 0–100, `feather` 0–100, `roundness` 0–100, `shape` (round), `color` |
| Scan Lines | `scanLines` | `intensity` 0–100, `spacing` 1–10, `thickness` 1–6, `color` |
| CRT Curvature | `crtCurve` | `intensity` 0–100 |
| Chromatic | `chromatic` | `center` (xy), `offset` 1–40, `angle` 0–360, `radial` 0–100 |
| Bloom | `bloom` | `spotlight` (xy), `spotlightR` 0–100, `threshold` 0–100, `intensity` 0–100, `blur` 0–100, `spread` 0–100, `glow` 0–100, `tint` (kolor), `tintAmount` 0–100, `vignette` 0–100, `vignetteSoftness` 0–100 |
| Character Bloom | `charBloom` | `intensity` 0–100 |
| Character Chromatic | `charChroma` | `offset` 1–20 |
| Film Grain | `filmGrain` | `intensity` 0–100, `colour` 0–100 |
| Glitch | `glitch` | `intensity` 0–100, `sliceMax` 2–80, `rgb` 0–100 |
| RGB Split | `rgbSplit` | `offset` 1–20 |
| Pixelate | `pixelate` | `size` 2–30 |
| Halftone | `halftone` | `size` 2–20, `shape` (dots), `colour` (source) |
| Film Dust | `filmDust` | `density` 0–100 |
| Noise | `noise` | `amount` 0–100, `size` 1–10, `colour` 0–100 |
| Sharpen | `sharpen` | `amount` 0–100 |
| Blur | `advBlur` | `type` (gaussian), `amount` 0–100, `focus` 0–100, `progNear` 0–100, `progFar` 0–100, `progAngle` 0–360 |

**Pro (12 + Levels i Curves)**

| Efekt | Klucz | Parametry |
|---|---|---|
| ASCII | `ascii` | `charset` (forensic), `size` 4–64, `color` (source), `invert` (lista) |
| Diffuse | `diffuse` | `amount` 0–100, `mode` (normal) |
| Threshold | `threshold` | `cutoff` 0–100, `smoothness` 0–100 |
| Reduce Noise | `reduceNoise` | `amount` 0–100, `radius` (lista) |
| Pinch | `pinch` | `amount` -150…150, `radius` 10–150, `centerX` 0–100, `centerY` 0–100 |
| Spherize | `spherize` | `amount` -150…150, `radius` 10–150, `centerX` 0–100, `centerY` 0–100 |
| Twirl | `twirl` | `amount` -300…300, `radius` 10–150, `centerX` 0–100, `centerY` 0–100 |
| ZigZag | `ripple` | `amount` 0–100, `wavelength` 5–100 |
| Ripple | `zigzag` | `amount` 0–100, `ridges` 1–20, `radius` 10–150, `centerX` 0–100, `centerY` 0–100 |
| Polar | `polar` | `mode` (rect2polar), `rotation` 0–100 |
| Shear | `shear` | `amount` -100…100, `period` 25–300 |
| Fragment | `fragment` | `offset` 1–40, `copies` 2–8 |
| Levels | — | para wejściowa (zakres, który przeżywa), gamma środka, para wyjściowa; per kanał lub composite |
| Curves | — | krzywa na kanał + krzywa composite na końcu; interpolacja monotoniczna, bez overshootu |

**[docs]** Klucze `ripple` i `zigzag` mają zamienione etykiety w interfejsie. Receptura z kluczem `ripple` to efekt nazwany w edytorze ZigZag.
**[docs]** Levels i Curves działają na gotowej klatce, przed warstwą tekstu, więc korygują render, nie źródło.

### Warstwa tekstu [docs]
Rysowana na końcu, nie podlega gradingowi. Pozycja i rozmiar to ułamki ramki, nie piksele, więc napis trafia w to samo miejsce przy eksporcie 4×.

---

## 9. Opcje własne wybranych stylów (z podstron stylów)

**[strona stylu]** Źródło: ascii-magic.com/styles/<nazwa> (opisy marketingowe z sekcją „Controls”). Nazwy kontrolek podaję tak, jak w tekście. Podstrony nie podają zakresów liczbowych, więc ich tu nie ma. Przeczytane: Dither, ASCII Studio, LED Matrix, Hex Mosaic, CMYK Drops, Braille, Glitch, ASCII Art (Characters), Block, Animated ASCII (video-to-ascii), Voxel, LEGO.

### Dither — uzupełnienie sekcji 5
- **Chroma:** tryby mapowania koloru po luminancji albo osobno po kanałach RGB. Pasuje to do listy Chroma („Standard”) widocznej na zrzutach **[?]**.
- **Własna paleta:** w Palette wybierasz „Custom palette”. Edytor próbek: `+` dodaje kolor, klik w próbkę otwiera systemowy color picker, `✕` usuwa, minimum 2 kolory. Dither przelicza się na żywo.
- **Animowana macierz:** macierz dithera „płynie” po kadrze w 8 kierunkach, jest tryb shimmer i regulowana prędkość. Dotyczy algorytmów uporządkowanych.
- **Game Boy:** dokładne kolory `#9bbc0f`, `#8bac0f`, `#306230`, `#0f380f`.
- **Algorytmy (jak działają):**
  - Floyd–Steinberg rozprasza błąd na 4 sąsiadów: 7/16 w prawo, 3/16 w lewo-dół, 5/16 w dół, 1/16 w prawo-dół.
  - Atkinson rozprasza tylko 6/8 błędu na 6 sąsiadów (jaśniejszy, bardziej kontrastowy).
  - Stucki rozprasza na 12 sąsiadów (gładsze gradienty). Sierra Lite to lekki wariant.
  - Radial: próg promieniuje od środka.
  - Linie H/V/D: wzór progowy jest siatką linii.
  - Halftone: klastry kropek (rozmiar komórki regulowany).

### ASCII Studio (`asciiStudio`)
- **Kontrolki:** Cell Size · Glyph (Characters lub Shapes) · Shape + Mix (który kształt i jak mocno wmieszany, tylko Shapes) · Chars (zestaw znaków, tylko Characters) · Palette · Seed + Apply · Randomize · Blend Mode · Opacity.
- **Wygląd:** domyślnie solidne czarne tło, więc kolory z palety „wyskakują”.
- **Randomizer:** jedno ziarno (seed) steruje naraz paletą, levels i gradingiem. Wpisanie tego samego seeda i Apply odtwarza dokładnie tę kompozycję.
- **Studio motion** (zakładka Animation, 5 presetów): Colour ripple · Palette wave · Hue cycle · Pulse · Rainbow rain.
- Dawniej był „shape dither” ukryty w Characters, teraz osobny tryb.

### LED Matrix (`ledmatrix`)
- **LED Type:** round dot · square SMD · RGB stripe · marquee bulb (zmienia tylko kształt komórki).
- **Scale** (rozstaw LED), **Glow** (promień i jasność bloomu), **Brightness**.
- **Color:** tryb per-LED (kolor z piksela źródła) albo solid. **LED Color** to kolor w trybie solid (domyślnie bursztyn).
- **Animacja:** w trybie solid kolor pulsuje (marquee).

### Hex Mosaic (`hexmosaic`)
- **Size** (promień heksagonu) · **Orientation** (pointy-top lub flat-top) · **Grout** (grubość spoiny) · **Grout Color**.
- Każdy heksagon ma średni kolor obszaru, który pokrywa. Strona wymienia tylko eksport stillów (PNG/JPG).

### CMYK Drops (`halftonecmyk`)
- **Kolory:** Paper plus cztery farby Cyan, Magenta, Yellow, Black (wszystkie edytowalne).
- **Dot Type:** Dots (okrągłe) · Sharp (twarde) · Ink (rozlewające się, „mokre” krople).
- **Suwaki:** Size (komórka rastra) · Grid Noise (jitter siatki) · Contrast · Softness (krawędź kropki) · Min Dot (najmniejsza drukowana kropka, czyli jak jasne zostają światła) · Ink Gain (osobno C, M, Y, K).
- Efekt „kropli”: Dot Type = Ink plus duży Size, trochę Grid Noise.
- Cztery rastry leżą pod różnymi kątami (rozety), jak w druku offsetowym **[strona stylu]**.

### Braille (`braille`)
- **Kontrolki:** Font Size (rozmiar komórki) · Coverage · Contrast · Brightness · Invert · Background mode (solid lub przezroczyste).
- 8-punktowy Unicode braille daje około 2× więcej szczegółów niż zwykły ramp znaków. Wynik jest monochromatyczny.
- **Eksport:** obraz PNG albo skopiowanie surowego tekstu braille.

### Glitch
- Podstrona opisuje to jako **bazę plus stos post-FX** (Glitch, RGB Split, Chromatic, Scan Lines), nie jako tryb z własnymi parametrami.
- Receptura demonstracyjna ze strony (po zdekodowaniu): `renderMode: pixel`, `fontSize: 6`, glitch `intensity` 50, rgbSplit `offset` 5, chromatic `offset` 7, scanLines `intensity` 22.
- Tryb `glitch` („Digital Distortion”, Pro) z listy stylów to osobna sprawa. Jego parametrów nie znam.
- Przepis VHS ze strony: Scanlines + lekki RGB Split + odrobina Glitch (przesunięcie slice'ów).

### Characters (`characters`, strona „ASCII Art”)
- **Kontrolki wg strony:** zestaw znaków (Character Set), gęstość, kontrast, jasność, **edge emphasis** (wzmocnienie krawędzi), tryb tła, przełącznik **Color** (kolor każdego znaku z piksela źródła, inaczej monochromatycznie), pole **Chars** (własny zestaw znaków).
- **Zestawy znaków wg strony:** 3 presety (Standard, Detailed, Minimal), a docs podają 17. Pole Chars przyjmuje własny ramp. Szerszy ramp daje gładszy ton (np. `@#%xo;:.` = 8 poziomów, `@$#WMG&wo*-:. ` = 14+).
- **Działanie:** jedna komórka na znak, średnia jasność komórki mapowana na znak ze skali tonalnej. Mniejsza komórka = więcej szczegółów, ale wolniejszy eksport.
- **Color overlay** (post FX): 11 trybów mieszania: Multiply, Overlay, Screen, Color, Hue, Saturation, Luminosity, Soft Light, Hard Light, Color Burn, Color Dodge.
- Strona pisze o „10 stackowalnych post-efektach” (Vignette, Scan Lines, CRT Curvature, Chromatic, Bloom, Film Grain, Glitch, RGB Split, Pixelate, Film Dust). Docs mówią o 28, więc strona jest przestarzała.

### Block (`block-chars`)
- **Kontrolki wg strony:** rozmiar komórki, kontrast, kolor (rozmiar i paleta).
- Znaki z bloku Unicode Block Elements (U+2580–U+259F): pełny blok █, połówki ▀ ▄ ▌ ▐, ćwiartki ▘▝▖▗, cieniowane ░ ▒ ▓. Dobierane automatycznie do jasności.
- Wg strony komórka koduje około 2 piksele w pionie, czyli więcej szczegółów niż zwykły ASCII przy tym samym rozmiarze.
- Osobne narzędzie „Text to ASCII” ma fonty FIGlet w stylu block (Block, Big, Banner, Colossal, Univers). To inny produkt niż tryb obrazkowy.

### Voxel (`3d`)
- **Kontrolki:** rozmiar sześcianu (przykłady: 14 px, 28 px, 32 px) i odstępy (spacing) · grubość obrysu (outline) · **niezależne odcienie ścian: top, light, dark** · odwrócenie kierunku światła (light-flip) · tryb mieszania (np. screen, overlay).
- **Działanie:** próbkowanie obrazu na siatce heksagonalnej, na każdym punkcie izometryczny sześcian (kąt 30°, bez perspektywy), trzy widoczne ściany z osobnym cieniowaniem liczonym z jasności piksela.
- **Wydajność:** najcięższy render w całej aplikacji (cieniowanie 3 ścian tysięcy sześcianów na klatkę). W wideo klipy 5–10 s.
- Tabela orientacyjna ze strony (ile sześcianów w poprzek): 8 ikonka · 16 chunky · 32 punkt wyjścia (zalecany) · 64 szczegółowy · 128 tapeta · 256+ subtelna stylizacja.

### LEGO (`lego`)
- **Kontrolki wg strony:** rozmiar klocka (od 1×1 studu do dużych), **coverage**, paleta (lista, zawiera „official LEGO Art colour set”), wysokość studu (stud height).
- **Działanie:** posteryzacja do siatki klocków z wypukłymi kropkami (stud), kolory z obrazu źródłowego.
- Zalecane: do portretu 24 lub 32 study w poprzek. Eksport 4× PNG pod plan budowy.

### Wideo, animacja i eksport (z podstron wideo i stylów)
- **Wejście wideo:** MP4, MOV, WebM do około 150 MB. Obraz: JPG, PNG, WebP, GIF.
- **Przetwarzanie:** każda klatka dekodowana lokalnie (HTML5 Canvas, wg jednej strony też WebGL), ten sam styl i ustawienia na każdej klatce, potem kodowanie do MP4 (H.264) albo animowanego GIF-a.
- **Skala eksportu:** 1×, 2×, 3×, 4× rozdzielczości źródła. Stille do 4×, a GIF i MP4 maksymalnie do 4K. Wg strony 5–30 s w 720p eksportuje się w poniżej minuty na nowoczesnym laptopie, dłuższe klipy lub 4× są ciężkie. Kodowanie w czasie rzeczywistym z CPU/GPU.
- **Stabilność w ruchu (wg stron):** najstabilniejsze Pixel Art i dither uporządkowany (Bayer 8×8, Halftone, linie). Dyfuzja błędu daje charakterystyczny shimmer. Voxel jest ciężki, LEGO zaskakująco stabilny, Dots dobrze czytelne w małym rozmiarze.
- **Receptura „animated”:** link kafelka „Animated ASCII” dekoduje się do `{"v":1,"animated":true}`, więc istnieje klucz `animated` (nie mam jego znaczenia poza nazwą) **[?]**.
- **Brak znaku wodnego** w eksporcie, według wszystkich stron.

---

## 10. Rozbieżności i niepewności

- **Contrast.** Docs: zakres -100…100, neutralny 0, domyślny 100. Zrzuty: Dither 158 i 118 (pasek pasuje do 0–200), Characters 100 i 120 (pasek na końcu, co przeczy -100…100). Zakres najpewniej różni się między silnikami. Do rozstrzygnięcia przez zrzuty skrajnych pozycji.
- **Liczby w różnych źródłach:** 92 style na `/styles` vs 101 kafelków i 91 trybów w docs; 15 vs 16 darmowych; 171 vs 75 presetów generatywnych (starszy `agents.md`). Ufam docs z 28 IX.
- **Dither:** docs podają 15 algorytmów i 15 palet. Podstrona stylu w jednym miejscu pisze „11 algorithms”, w innym „15”, a palet „16” (16. to prawdopodobnie edytor własnej palety). Ufam docs.
- **Opisy palet dither** w docs są przesunięte względem nazw, więc nie korzystam z nich.
- **Etykiety ZigZag/Ripple** zamienione względem kluczy (efekt i tryb).
- **ASCII Studio:** docs listują go jako Pro, podstrona pisze „part of the free core plan”.
- **Eksport tekstu:** docs mówią, że nie ma eksportu tekstowego, a podstrona Braille mówi, że można skopiować tekst braille. Prawdopodobnie wyjątek dla tego trybu **[?]**.
- **Zestawy znaków:** docs 17 presetów, strona ASCII Art 3 presety plus własne pole Chars. Docs są nowsze.
- **Liczba post-efektów:** starsze strony stylów pisą o 10 efektach, docs o 28.
- **Format receptury:** docs pokazują `postFx` z wartościami `true` lub obiektem, a link ze strony Glitch używa klucza `pfx` z polem `enabled`. Format może mieć dwie formy (nowszą i starszą) **[?]**.

---

## 11. Luki do uzupełnienia (następne kroki)

1. **Podstrony stylów, których jeszcze nie przeczytałem:** Pixel Art, Mosaic, Disco, Dots, Mixed, Cross, Diagonal, Diamond, Lines. To starsze strony w stylu SEO, które dały mało parametrów (Block, ASCII Art), więc po lekturze 5 z 14 przerwałem. Voxel i LEGO miały realne kontrolki, więc Pixel Art i Mosaic mogą też mieć.
2. **Style Pro bez podstrony** (około 60): Stippling, Comic, Sketch, Engraving, Warhol, Droste, Truchet, Flow Field, wszystkie Distort, Blur, Glass, Material, Glitch i Light poza Disco. Tu mam tylko nazwy i id.
3. **Rozwinięte listy w edytorze:** Algorithm, Palette, Chroma, Backdrop Mode, Blend Mode, Blur Type, Animation Type, Photo Filter, Gradient Map.
4. **Zakładki warstw i kadru** oraz dolna część Lights.
5. **Animacja:** które tryby ją mają i jakie ustawienia ruchu (plan: osobny plik, na końcu). Do tej pory znane: Signature, Studio motion (5 presetów w ASCII Studio), animowana macierz dithera (8 kierunków, shimmer), pulsowanie LED.
6. **Wartości domyślne per tryb** (docs podają tylko wspólne).
