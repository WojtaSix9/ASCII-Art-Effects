# Katalog efektów — wersja robocza do akceptacji (część 2)

Cel: ustalić **listę efektów i to, jak mają działać**, zanim ustalimy eksport. To nie jest kopia 1:1 ASCII Magic, tylko nasz własny katalog.
Szczegóły z dokumentacji, zrzutów i podstron są w `01-efekty-i-opcje.md`.

## Jak czytać wpisy

Każdy efekt ma: opis działania, opcje modyfikacji, silnik i złożoność.

**Źródło opisu**
- `docs`: opis oparty na dokumentacji, podstronach albo zrzutach (patrz plik 01).
- `proj`: **projekt własny**, napisany na podstawie samej nazwy (to głównie efekty Pro, o których nic nie wiadomo). To propozycja do poprawienia, nie fakt o oryginale.
- `proj?`: nazwa jest niejednoznaczna i interpretacja jest szczególnie niepewna. Proszę o decyzję.

**Silnik** (jak to się technicznie rysuje)
- `GRID`: siatka komórek, na każdej rysujemy glif lub kształt (canvas 2D).
- `TILE`: kafelki o średnim kolorze obszaru (canvas 2D).
- `SHADER`: przekształcenie każdego piksela (WebGL, fragment shader).
- `GEOM`: generowana geometria (Voronoi, Delaunay, linie, kształty).
- `STATE`: potrzebuje stanu między klatkami lub cząstek (kłopotliwe przy eksporcie klatka po klatce).
- `3D`: render izometryczny z cieniowaniem ścian (ciężki).

**Złożoność:** S = prosty, M = średni, L = złożony. To względne oszacowanie, nie czas pracy.

**Opcje wspólne `[W]`** (jeśli efekt ich używa): `cellSize`, `coverage`, `brightness`, `contrast`, `invert`, `bgMode` (blur / solid / original / none), `bgBlur`.

Każdy efekt, który da się animować, dostaje później parametr czasu. Animacje zostają na koniec.

---

## Zasada ogólna dla opcji

Każdy efekt ma 3 poziomy opcji:
1. **Główne** (3–6 suwaków widocznych od razu).
2. **Zaawansowane** (reszta, schowana).
3. **Seed** (ziarno losowości) wszędzie tam, gdzie występuje losowość, żeby wynik był powtarzalny.

---

## 1. ASCII i tekst (6)

- **Characters** `characters` · GRID · S · docs
  Każda komórka dostaje znak ze skali tonalnej wg jasności (ciemne = gęste znaki).
  Opcje: `[W]`, `charSet` (preset lub własny ciąg, 17 presetów z pliku 01), `colorMode` (mono / z obrazu), `edgeEmphasis`, `font`.
- **ASCII Studio** `asciiStudio` · GRID · M · docs
  Obraz złożony z zaprojektowanych kształtów lub znaków, kolorowanych przez paletę, domyślnie na czarnym tle.
  Opcje: `cellSize`, `glyph` (shapes / characters), `shape` + `mix`, `chars`, `palette`, `seed` + randomize, `blendMode`, `opacity`. Presety ruchu: colour ripple, palette wave, hue cycle, pulse, rainbow rain.
- **Block** `block-chars` · GRID · S · docs
  Komórki z znaków blokowych Unicode (pełne, połówki, ćwiartki, cieniowane) dobieranych do tonu.
  Opcje: `[W]`, `blockSet` (full / half / quarter / shaded), `colorMode`.
- **Dots** `dots` · GRID · S · docs/proj
  Okrągłe kropki o rozmiarze zależnym od jasności (raster półtonowy).
  Opcje: `[W]`, `dotShape`, `minDot`/`maxDot`, `colorMode`, `gridAngle`.
- **Mixed** `mixed` · GRID · M · proj
  Mieszanka kilku zestawów znaków w jednym obrazie: np. gęste bloki w cieniach, litery w półtonach, kropki w światłach.
  Opcje: `[W]`, lista zestawów z progami tonów, `mixRatio`, `seed`.
- **Braille** `braille` · GRID · S · docs
  Każda komórka to znak Braille'a 2×4 punkty, więc ok. dwa razy więcej szczegółów niż zwykły ramp. Monochromatyczne.
  Opcje: `cellSize`, `coverage`, `contrast`, `brightness`, `invert`, `bgMode`. Możliwość skopiowania jako tekstu.

## 2. Piksele i bloki (6)

- **Pixel Art** `pixel` · TILE · S · docs
  Obraz sprowadzony do dużych bloków koloru, opcjonalnie z ograniczoną paletą.
  Opcje: `blockSize`, `paletteSize`/`palette`, `coverage`, `dither` (off / on).
- **Mosaic** `mosaic` · TILE · S · docs/proj
  Kafelki kwadratowe o średnim kolorze, ze spoiną.
  Opcje: `tileSize`, `grout`, `groutColor`, `tileJitter`, `coverage`.
- **LEGO** `lego` · TILE · M · docs
  Kafelki w postaci klocków z wypukłą kropką (stud), kolory posteryzowane do palety (w tym zestaw w stylu LEGO Art).
  Opcje: `brickSize` (od 1×1), `palette`, `studHeight`, `coverage`.
- **Voxel** `3d` · 3D · L · docs
  Izometryczne sześciany na siatce heksagonalnej z osobnym cieniowaniem ścian (góra, jasna, ciemna).
  Opcje: `cubeSize`, `spacing`, `outline`, `topShade`/`lightShade`/`darkShade`, `lightFlip`, `blendMode`.
- **Hex Mosaic** `hexmosaic` · TILE · S · docs
  Plaster miodu z sześciokątnych kafelków o średnim kolorze obszaru.
  Opcje: `size`, `orientation` (pointy / flat), `grout`, `groutColor`.
- **LED Matrix** `ledmatrix` · GRID · M · docs
  Matryca świecących diod z bloomem: czarny panel, jasne miejsca rozlewają światło.
  Opcje: `ledType` (round / square SMD / RGB stripe / marquee bulb), `scale`, `glow`, `brightness`, `colorMode` (per-LED / solid), `ledColor`.

## 3. Druk i papier (15)

- **Dither** `dither` · SHADER · M · docs
  Redukcja do małej palety z rozpraszaniem błędu lub wzorem progowym. 15 algorytmów, 15 palet, edytor własnej palety.
  Opcje: `algorithm`, `palette`, `chroma`, `pixelSize`, `strength`, `contrast`, `threshold`, `angle` (algorytmy liniowe). Szczegóły w pliku 01.
- **Stippling** `stippling` · GEOM · M · proj
  Obraz zbudowany z tysięcy małych punktów: gęsto w cieniach, rzadko w światłach (rysunek tuszem punktowym).
  Opcje: `density`, `dotSize` min/max, `distribution` (losowy / blue noise / ważony Voronoi), `inkColor`, `paperColor`, `seed`.
- **Risograph** `risograph` · SHADER · M · proj
  Druk risograficzny: 2–3 farby w osobnych warstwach, każda z rastrem, lekko przesunięte względem siebie, z ziarnem i nakładaniem kolorów.
  Opcje: `inks` (2–3 kolory), `halftoneSize`, `misregistration`, `grain`, `overprint`, `paperColor`.
- **Comic** `comic` · SHADER · M · proj
  Styl komiksowy: posteryzacja do kilku plam koloru, czarne kontury i raster Ben-Day w cieniach.
  Opcje: `levels`, `outlineThickness`, `halftoneSize`, `palette`, `inkColor`.
- **Sketch** `sketch` · SHADER · M · proj
  Szkic ołówkiem: wykryte krawędzie plus lekkie kreskowanie w cieniach na papierze.
  Opcje: `edgeStrength`, `strokeLength`, `hatchDensity`, `lineColor`, `paperTexture`, `jitter`.
- **Engraving** `engraving` · GEOM · L · proj
  Sztych: linie o zmiennej grubości, pogrubiane w cieniach i cienkie w światłach, układające się wzdłuż form.
  Opcje: `lineSpacing`, `angle`, `thicknessRange`, `curvature`, `inkColor`, `paperColor`.
- **Warhol** `warhol` · SHADER · S · proj
  Siatka 2×2 (lub 3×3) kopii obrazu, każda w innej kontrastowej, mocno posteryzowanej palecie (pop-art).
  Opcje: `grid`, `palettes` (lista), `levels`, `hueShiftPerTile`.
- **Cyanotype** `blueprint` · SHADER · S · proj
  Monochromatyczny druk w odcieniach błękitu pruskiego z bielą, z plamami papieru i ziarnem.
  Opcje: `toneCurve`, `lineMode` (tony / krawędzie), `paperStain`, `grain`.
- **Halftone** `halftone` · SHADER · S · docs/proj
  Klasyczny raster: kropki, linie lub kwadraty ułożone pod kątem, wielkość wg tonu.
  Opcje: `cellSize`, `angle`, `shape` (dot / line / square), `colorMode` (mono / z obrazu), `contrast`.
- **Woodblock** `ukiyoe` · SHADER · L · proj
  Japoński drzeworyt: płaskie plamy koloru z ograniczonej palety, ciemne kontury, faktura słojów drewna i papieru.
  Opcje: `colorCount`, `outline`, `woodGrain`, `paperTexture`, `palette`.
- **Posterize** `posterize` · SHADER · S · proj
  Redukcja do N poziomów na kanał, z ostrymi przejściami (plamy koloru).
  Opcje: `levels`, `smoothing`, `palette` (z obrazu / własna).
- **Mezzotint** `mezzotint` · SHADER · M · proj
  Mezzotinta: ziarnisty, aksamitny szum o dużym kontraście, ciemne tło i jasne plamy światła.
  Opcje: `grainSize`, `density`, `threshold`, `inkColor`, `paperColor`.
- **Pointillize** `pointillize` · GEOM · M · proj
  Pointylizm: losowe okrągłe plamki koloru z obrazu, różnej wielkości, częściowo nachodzące na siebie.
  Opcje: `dotSize` min/max, `density`, `jitter`, `overlap`, `bgColor`, `seed`.
- **Crosshatch** `crosshatch` · SHADER · M · proj
  Kreskowanie krzyżowe: kolejne warstwy linii pod różnymi kątami włączają się w coraz ciemniejszych miejscach.
  Opcje: `layers` (2–4), `angles`, `spacing`, `thickness`, `jitter`, `inkColor`, `paperColor`.
- **CMYK Drops** `halftonecmyk` · SHADER · L · docs
  Rozdzielenie na cztery farby (C, M, Y, K) z rastrem pod różnymi kątami na kolorze papieru.
  Opcje: `paper`, `cyan`/`magenta`/`yellow`/`black`, `dotType` (dots / sharp / ink), `size`, `gridNoise`, `contrast`, `softness`, `minDot`, `inkGain` na kanał.

## 4. Geometryczne (15)

- **Cross** `cross` · GRID · S · docs
  Siatka znaków plus/krzyżyk skalowanych jasnością. Opcje: `[W]`, `strokeThickness`, `rotation`, `colorMode`.
- **Diamond** `diamond` · GRID · S · docs
  Siatka rombów o rozmiarze zależnym od tonu. Opcje: `[W]`, `fill` (pełny / kontur), `rotation`, `colorMode`.
- **Lines** `lines` · GRID · S · docs
  Poziome segmenty linii, których długość lub grubość zależy od jasności. Opcje: `[W]`, `orientation`, `thickness`, `colorMode`.
- **Diagonal** `diagonal` · GRID · S · docs
  Ukośne kreski (jak Lines, ale pod kątem). Opcje: `[W]`, `angle`, `thickness`, `colorMode`.
- **Specimen** `specimen` · GRID · M · proj?
  Interpretacja: plansza próbek pisma. Obraz złożony ze znaków kroju pisma w różnych rozmiarach i wagach, układających się jak tablica specimenowa. Opcje: `font`, `sizeRange`, `weightRange`, `textSource`, `[W]`.
- **Low Poly** `lowpoly` · GEOM · M · proj
  Triangulacja Delaunaya z losowych punktów, każdy trójkąt wypełniony średnim kolorem. Opcje: `pointCount`, `distribution` (losowy / po krawędziach), `outline`, `jitter`, `seed`.
- **Droste** `droste` · SHADER · L · proj
  Efekt Droste: obraz rekurencyjnie zagnieżdżony w sobie, ze spiralnym obrotem. Opcje: `scaleRatio`, `rotation`/`spiral`, `repeats`, `center`.
- **Truchet** `truchet` · GEOM · M · proj
  Kafelki Truchet: w każdej komórce losowo obrócony łuk lub linia, wybierane i grubione wg jasności. Opcje: `tileSize`, `tileSet` (arcs / diagonals / triangles), `thickness`, `colors`, `seed`.
- **Iso Extrude** `isoextrude` · 3D · L · proj
  Izometryczne słupki, których wysokość zależy od jasności komórki (histogram 3D). Opcje: `cellSize`, `maxHeight`, `angle`, `shading`, `outline`, `colorMode`.
- **Flow Field** `flowfield` · STATE · L · proj
  Linie lub cząstki podążające za polem wektorowym wyliczonym z kierunków gradientu obrazu, kolor z obrazu. Opcje: `lineCount`, `length`, `step`, `noiseScale`, `thickness`, `seed`.
- **Lattice** `lattice` · GEOM · M · proj
  Kratownica: węzły siatki połączone krawędziami, grubość węzłów i linii zależy od jasności. Opcje: `spacing`, `nodeSize`, `connections` (4 / 8 / heks), `lineThickness`.
- **Topography** `topography` · GEOM · M · proj
  Warstwice: izolinie jasności jak na mapie topograficznej. Opcje: `lineCount`, `thickness`, `smoothing`, `colorRamp`, `fillBands` (linie / wypełnienie).
- **Forms** `forms` · GEOM · M · proj?
  7 wariantów (z docs). Interpretacja: komórki zastąpione prostymi bryłami lub formami (kula, kostka, stożek, piramida, walec…) z cieniowaniem. Opcje: `formType` (7 wariantów), `size`, `rotation`, `shading`, `[W]`.
- **Schematic** `schematic` · GEOM · M · proj
  Schemat techniczny: linie siatki, krzyże pomiarowe, wykryte krawędzie i etykiety jak na rysunku inżynierskim. Opcje: `gridSpacing`, `lineColor`, `annotationDensity`, `edgeThreshold`.
- **Neon Grid** `neongrid` · SHADER · M · proj
  Neonowa siatka w stylu synthwave: jasność obrazu steruje jasnością i grubością świecących linii. Opcje: `gridSpacing`, `lineWidth`, `glow`, `hue`, `perspective` (on / off).

## 5. Zniekształcenia (8)

Zniekształcają obraz geometrycznie. Są tym samym algorytmem co post FX o tej samej nazwie (patrz plik 01). W wersji stylu działają na źródle, bez rasteryzacji znaków.

W dokumentacji etykiety ZigZag i Ripple są zamienione względem kluczy. W naszym katalogu nazywamy je **po zachowaniu**.

- **Smudge** `smudge` · SHADER · M · proj
  Rozmazanie pociągnięciem: piksele ciągnięte w kierunku, jak palec po mokrej farbie. Opcje: `strength`, `angle`, `length`, `noise`, `seed`.
- **Pinch** `pinch` · SHADER · S · docs
  Ściąganie lub rozpychanie do punktu. Opcje: `amount` (−150…150), `radius` (10–150), `centerX`, `centerY`.
- **Spherize** `spherize` · SHADER · S · docs
  Efekt kuli, wypukły lub wklęsły. Opcje: `amount` (−150…150), `radius`, `centerX`, `centerY`.
- **Twirl** `twirl` · SHADER · S · docs
  Skręcenie wokół środka. Opcje: `amount` (−300…300), `radius`, `centerX`, `centerY`.
- **ZigZag** · SHADER · S · docs
  Falowe przesunięcie linii (zygzak poprzeczny). Opcje: `amount` (0–100), `wavelength` (5–100). (Klucz w oryginale: `ripple`.)
- **Ripple** · SHADER · S · docs
  Koncentryczne fale od środka. Opcje: `amount` (0–100), `ridges` (1–20), `radius`, `centerX`, `centerY`. (Klucz w oryginale: `zigzag`.)
- **Polar** `polar` · SHADER · S · docs
  Przekształcenie prostokątne ↔ biegunowe (obraz zawijany w okrąg). Opcje: `mode`, `rotation` (0–100).
- **Shear** `shear` · SHADER · S · docs
  Falowe ścięcie linii. Opcje: `amount` (−100…100), `period` (25–300).

## 6. Rozmycie i ostrość (4)

- **Motion Blur** `motionblur` · SHADER · S · proj
  Rozmycie ruchem w kierunku. Opcje: `angle`, `length`, `samples`.
- **Tilt-Shift** `tiltshift` · SHADER · M · proj
  Efekt miniatury: ostry pas, reszta rozmyta, podbite nasycenie. Opcje: `focusPosition`, `focusWidth`, `blurAmount`, `angle`, `saturationBoost`.
- **Gaussian Blur** `gaussianblur` · SHADER · S · proj
  Klasyczne rozmycie gaussowskie. Opcje: `radius`.
- **Radial Blur** `radialblur` · SHADER · S · proj
  Rozmycie od środka: zoom lub obrót. Opcje: `type` (zoom / spin), `amount`, `centerX`, `centerY`.

## 7. Glitch i sygnał (10)

- **CRT Screen** `crt` · SHADER · M · proj
  Ekran kineskopowy: zakrzywienie, linie skanowania, maska luminoforu RGB, poświata, lekkie migotanie. Opcje: `curvature`, `scanlines`, `phosphorMask`, `bloom`, `flicker`.
- **Pixel Sort** `pixelsort` · SHADER · L · proj
  Sortowanie pikseli w wierszach lub kolumnach wg jasności, w segmentach wyznaczonych progiem. Opcje: `thresholdLow`/`thresholdHigh`, `direction`, `sortBy` (luminancja / odcień), `maxLength`.
- **Forensics** `forensics` · SHADER · M · proj?
  Interpretacja: wizualizacja jak w analizie kryminalistycznej obrazu (mapa szumu, ELA, krawędzie, kolorowa mapa błędów, opcjonalnie etykiety nakładki). Opcje: `mode` (noise / ELA / edge), `colormap`, `overlayLabels`.
- **Digital Distortion** `glitch` · SHADER · M · docs/proj
  Przesunięcia poziome pasków, rozdzielenie RGB, bloki i szum, jak uszkodzony sygnał. Opcje: `intensity`, `sliceMax`, `rgb`, `blockSize`, `seed`.
- **Datamosh** `datamosh` · STATE · L · proj
  Rozmazywanie pikseli wg wektorów ruchu (jak uszkodzona kompresja wideo); na stillu symulowane przesunięciem bloków. Opcje: `blockSize`, `smearAmount`, `keyframeInterval`, `seed`.
- **Lofi** `lofi` · SHADER · M · proj
  Zniszczony nośnik: niska rozdzielczość, kwantyzacja kolorów, artefakty kompresji i błędy taśmy VHS. Opcje: `resolution`, `colorBits`, `compressionArtifacts`, `noise`, `tracking`.
- **RGB Split** `rgbsplit` · SHADER · S · docs
  Przesunięcie kanałów R, G, B względem siebie. Opcje: `offset` (1–20), `angle`, `perChannel`.
- **Scanline** `scanline` · SHADER · S · docs/proj
  Linie skanowania. Opcje: `spacing`, `thickness`, `intensity`, `roll` (przesuwanie).
- **Thermal** `thermal` · SHADER · S · proj
  Kamera termowizyjna: jasność mapowana na paletę ciepła, szum sensora, ewentualne znaczniki. Opcje: `palette` (ironbow / rainbow / white-hot), `contrast`, `noise`, `crosshair`.
- **Beacon** `beacon` · STATE · M · proj?
  Interpretacja: pole punktów światła, przez które przechodzi pulsujący sygnał od źródła (jak radar lub ping). Opcje: `center`, `pingSpeed`, `ringWidth`, `dotSize`, `colors`.

## 8. Światło i kolor (11)

- **Disco** `disco` · TILE · S · docs
  Kolorowe bloki o mocno podbitym nasyceniu, jak oświetlenie dyskotekowe. Opcje: `cellSize`, `saturation`, `palette`, `coverage`.
- **Anaglyph 3D** `anaglyph` · SHADER · S · proj
  Efekt 3D z czerwono-cyjanowych kanałów przesuniętych wg głębokości (z jasności). Opcje: `separation`, `depthSource`, `colorMode`.
- **Gradient Map** `gradientmap` · SHADER · S · proj
  Mapowanie jasności na wielopunktowy gradient kolorów. Opcje: `stops` (edytor gradientu), `preset`, `interpolation`, `blend`.
- **Prism** `prism` · SHADER · M · proj
  Rozszczepienie światła jak w pryzmacie: tęczowe smugi i dyspersja przy krawędziach. Opcje: `angle`, `strength`, `spread`.
- **Dreamdust** `dreamdust` · STATE · M · proj
  Marzycielska poświata z unoszącym się pyłem, bokeh i iskrami. Opcje: `particleDensity`, `particleSize`, `glow`, `drift`, `seed`.
- **Light Wind** `lightwind` · SHADER · M · proj
  Kierunkowe smugi światła ciągnące się z jasnych obszarów (god rays). Opcje: `angle`, `length`, `threshold`, `falloff`, `tint`.
- **Kaleidoscope** `starburst` · SHADER · S · proj
  Lustrzane sektory wokół środka. Opcje: `segments`, `rotation`, `center`, `zoom`.
- **Warpbloom** `warpbloom` · SHADER · M · proj
  Falowe odkształcenie połączone z poświatą. Opcje: `warpAmount`, `frequency`, `bloomIntensity`, `threshold`.
- **Duotone** `duotone` · SHADER · S · proj
  Dwa kolory: jeden dla cieni, drugi dla świateł. Opcje: `shadowColor`, `highlightColor`, `contrast`, `blend`.
- **Edge Glow** `edgeglow` · SHADER · M · proj
  Wykryte krawędzie świecące neonowo na przyciemnionym tle. Opcje: `threshold`, `glowRadius`, `colorMode`, `sourceDim`.
- **Aberration** `lens` · SHADER · S · proj
  Wady obiektywu: aberracja chromatyczna, dystorsja beczkowata i winietowanie. Opcje: `strength`, `radial`, `barrel`, `fringe`.

## 9. Szkło (7 trybów, 16 kafelków)

Wszystkie to refrakcja obrazu przez wirtualną taflę szkła. Wspólne opcje: `refraction`, `blur`, `tint`, `highlight`, `dispersion`, `scale`.

- **Frosted Glass** `frostedglass` · SHADER · M · proj
  Szkło matowe: rozmycie z drobnym ziarnem. Opcje: `blur`, `frostGrain`, `tint`, `opacity`.
- **Tinted Glass** `stainedglass` · GEOM · L · proj
  Witraż: komórki Voronoi w płaskich kolorach z ołowianymi obrysami i efektem podświetlenia. Opcje: `cellCount`, `leadThickness`, `leadColor`, `jitter`, `backlight`.
- **Shatter** `shatter` · GEOM · L · proj
  Rozbite szkło: fragmenty Voronoi przesunięte i obrócone, z liniami pęknięć od punktu uderzenia. Opcje: `fragmentCount`, `displacement`, `rotation`, `crackLines`, `impactCenter`, `seed`.
- **Vitrine** `vitrine` · SHADER · M · proj?
  Interpretacja: obraz za szklaną taflą z odblaskami i ramką. Opcje: `reflection`, `glareAngle`, `frame`, `tint`.
- **Glass Orb** `glassorb` · SHADER · M · proj
  Obraz widziany przez szklaną kulę, z odwróceniem i refrakcją. Opcje: `radius`, `ior`, `position`, `highlight`, `backgroundBlur`.
- **Fluted Glass** `flutedglass` · SHADER · S · proj
  Szkło żłobkowane: pionowe walcowate soczewki. Opcje: `fluteWidth`, `refractionStrength`, `direction`.
- **Liquid Glass** `liquidglass` · SHADER · M · proj
  Wspólny silnik z mapą normalnych tekstury szkła. 10 tekstur (parametr `texture`):
  `cross` (krzyżowo żłobkowane), `hammered` (młotkowane), `diamond` (romby), `hexagon` (sześciokąty), `ripple` (fale), `crackle` (popękany lód), `chevron` (jodełka), `seedy` (pęcherzyki), `pixel` (kwadratowe), `jello` (galaretowate, miękkie).

## 10. Materiał i tekstura (9)

- **Waves** `waves` · SHADER · M · proj
  Obraz na falującej powierzchni lub zbudowany z falistych linii. Opcje: `frequency`, `amplitude`, `direction`, `lineMode`.
- **Oil Paint** `oilpaint` · SHADER · L · proj
  Obraz olejny: wygładzenie typu Kuwahara plus faktura pociągnięć pędzla i relief farby. Opcje: `brushSize`, `strokeDirection`, `impasto`, `specular`.
- **Watercolor** `watercolor` · SHADER · L · proj
  Akwarela: miękkie rozlewy koloru, ciemniejsze krawędzie pigmentu, faktura papieru. Opcje: `wetness`, `edgeDarkening`, `paperGrain`, `granulation`.
- **Chrome** `chrome` · SHADER · M · proj
  Jasność jako wysokość, mapowana na metaliczne odbicie otoczenia. Opcje: `relief`, `environment` (preset), `smoothness`, `tint`.
- **Thin-Film** `thinfilm` · SHADER · M · proj
  Iryzacja jak bańka mydlana: kolory interferencyjne zależne od „grubości” (jasności). Opcje: `thicknessScale`, `hueShift`, `fresnel`, `noise`.
- **Marble** `marble` · SHADER · M · proj?
  Interpretacja: żyłki marmuru ze sterowaniem tonem obrazu i turbulencją. Opcje: `veinScale`, `turbulence`, `palette`, `contrast`.
- **Molten Metal** `molten` · SHADER · L · proj?
  Interpretacja: płynny, rozgrzany metal. Jasność deformuje powierzchnię (metaballe), ciepła paleta i poświata. Opcje: `flow`, `heatPalette`, `viscosity`, `glow`.
- **Crystallize** `crystallize` · GEOM · M · proj
  Komórki Voronoi o średnim kolorze, ze ściętymi krawędziami jak kryształy. Opcje: `cellSize`, `edge`, `bevelShading`.
- **Emboss** `emboss` · SHADER · S · proj
  Tłoczenie: obraz wygląda jak wypukła rzeźba oświetlona z kierunku. Opcje: `angle`, `height`, `softness`, `baseColorMode`.

---

## 11. Moduły globalne (niezależne od stylu)

- **Post FX (28 efektów):** pełna lista z kluczami, zakresami i kolejnością w pliku 01, sekcja 8. W katalogu nie powtarzam.
- **Color:** presety (None, B&W, Sepia, Warm, Cool, Vintage, Fade, Cyber), filtr zdjęcia, tint z blendem, saturation, vibrance, hue, gradient map, grayscale, invert (plik 01, sekcja 7).
- **Lights:** do 4 świateł punktowych z promieniem i intensywnością (plik 01, sekcja 7).
- **Backdrop:** tryb tła, softness, opacity (plik 01, sekcja 3).
- **Blur:** osobny typ rozmycia, odrębny od post FX (zawartość listy nieznana).
- **Warstwa tekstu:** zawsze na wierzchu, pozycja w ułamkach kadru.
- **Animowane sceny ASCII:** osobny moduł (nie styl obrazkowy), opisany w pliku 03.
- **Tryb generatywny (AI):** poza zakresem. Wymaga zewnętrznego modelu. Zakładam, że pomijamy, chyba że zdecydujesz inaczej.

---

## 12. Propozycja kolejności budowy

Do ustalenia razem, to szkic.

**Faza 1: rdzeń** (siatki i kafelki, najpewniejsze)
Characters, Block, Dots, Braille, Pixel Art, Mosaic, LEGO, Hex Mosaic, Cross, Diamond, Lines, Diagonal, Disco, Dither, Halftone, Posterize, Duotone, Gradient Map. Do tego 16 darmowych post FX oraz moduły globalne (Color, Backdrop).

**Faza 2: popularne i efektowne**
LED Matrix, ASCII Studio, CMYK Drops, Risograph, Comic, Sketch, Crosshatch, Stippling, Pointillize, Low Poly, Truchet, Voxel, wszystkie zniekształcenia i rozmycia, RGB Split, Scanline, CRT, Thermal, Aberration, Edge Glow.

**Faza 3: złożone**
Engraving, Woodblock, Droste, Flow Field, Iso Extrude, Pixel Sort, Datamosh, całe Szkło, Oil Paint, Watercolor, Chrome, Thin-Film, Marble, Molten, Crystallize.

Efekty typu `STATE` (Flow Field, Datamosh, Dreamdust, Beacon) wymagają osobnej decyzji przy eksporcie: wynik zależy od poprzednich klatek, więc eksport musi renderować kolejno od klatki 0.

---

## 13. Pytania do rozstrzygnięcia (przed eksportem)

1. **Niejednoznaczne nazwy** (`proj?`): Specimen, Forms, Forensics, Beacon, Vitrine, Marble, Molten Metal. Czy moje interpretacje są OK, czy chcesz inne?
2. **Zakres:** czy w pierwszej wersji budujemy wszystkie 91, czy tylko Fazę 1 i 2?
3. **Nazwy:** używamy własnych nazw (np. „Woodblock” zamiast „ukiyoe”, „Kaleidoscope” zamiast „starburst”) i własnych id, bez kopiowania ich numeracji. Zgoda?
4. **Tryb generatywny (AI):** pomijamy?
5. **Eksport** ustalimy po zatwierdzeniu listy. Z wiedzy o oryginale: PNG, JPG, GIF, MP4 (H.264), skala 1–4×, a wejście to obraz lub wideo.
