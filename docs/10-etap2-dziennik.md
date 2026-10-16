# Etap 2: dziennik prac

Oznaczenia: `test`, `kod`, `docs`, `proj`, `proj?`, `BRAK`. Brief etapu: `09-etap2-animacje-dla-claude-code.md`.

## Krok 0: weryfikacja stanu (16 X 2026)

**Stan wejściowy:** gałąź `etap2-animacje` utworzona z `claude/happy-bell-5qulv1` @ `9638902`. To kod z `59bbcbc` plus 4 pliki dokumentacji wgrane przez użytkownika. Node 22.22.0, Chromium (Playwright, headless).

### Wyniki (`test`)

| Test | Wynik | Czas |
|---|---|---|
| silnik `check-engine.ts` | 308/308 | — |
| `effects.json` | 91 z 91 `ready` | — |
| `hash-baseline` | 516 przypadków, zapisane w `engine/reports/hash-baseline-etap1.txt` | — |
| `check:tokens` | 34/34 | 0 s |
| `smoke` | 63/63 | 18 s |
| `test:engine` (pełny) | 14/14 kontroli; przeglądarka = Node 106/106 | 29 min |
| `test:ui` | **38/39, 1 FAIL** (miniatury, opis niżej) | 36 s |
| `test:editor` | 65/65 | 24 s |
| `test:a11y` | 24/24 | 21 s |

Pełny raport `test:engine` (czasy 91 efektów, pamięć): `app/reports/etap2-krok0-browser-engine.txt`.

### Liczba przypadków hash-baseline

Brief podaje 436 przypadków. To stan z partii 11. Po partiach 12–13 (16 nowych efektów × 4 + 16) jest 516. Głównym testem regresji etapu 2 jest plik z 516 wierszami.

### FAIL: miniatury na złym zdjęciu

Test: „każdy z 91 gotowych efektów ma miniaturę na właściwym zdjęciu (naprzemiennie)”. 28 efektów ma miniaturę na niewłaściwym zdjęciu, np. braille, pixel, mosaic, lego, dither, halftone.

**Przyczyna (mój błąd z etapu 1):**
- Zdjęcie miniatury wynika z pozycji efektu na liście.
- Każda nowa partia przesuwa tę pozycję dla części starych efektów.
- W partiach 11–13, już po teście UI, przywracałem stare pliki miniatur, żeby ograniczyć zmiany binarne w repo. To psuło przypisanie zdjęć.
- Test UI uruchamiałem przed tym przywróceniem, więc tego nie wychwycił.

**Naprawa:** jedno `npm run thumbs` i commit wszystkich miniatur. Czeka na zgodę użytkownika.

### Wydajność efektów z listy animacji (`test`)

Mediana z 3 pomiarów w Chromium (Worker), 1600×1067, ta sama maszyna:

| ms | efekty |
|---|---|
| < 60 | Scanline 9, Glitch 27, Mixed 32, Pixel Art 32, Block 33, Characters 37, Disco 45, Diamond 56, Dither 59 |
| 60–200 | Lines 71, Dots 86, Diagonal 97, RGB Split 106, Cross 107, Braille 109, ZigZag 125, Twirl 138, Ripple 150, Fluted Glass 165, Waves 182 |
| 200–500 | LED Matrix 287, Halftone 303, CRT 331, Engraving 470 |
| > 1000 | **Risograph 1266** |

Przy 240 klatkach Risograph w 1600 px to ok. 5 min.

### Czego etap 1 nie sprawdzał, a etap 2 na tym stoi (`BRAK`)

- **Przeglądarki i urządzenia:**
  - Safari i Firefox: Worker typu module, `OffscreenCanvas` 2D, `self.fonts` w Workerze;
  - telefony;
  - WebCodecs i H.264 (nowe w etapie 2).
- **Wydajność:**
  - pomiar jest tylko z headless Chromium w piaskownicy, nie na realnym sprzęcie;
  - brak pomiaru podglądu na żywo przy zmianie suwaka w edytorze.
- **Pamięć:**
  - zmierzono tylko serię 1092 renderów (RSS Chromium 581–717 MB, bez wzrostu liniowego);
  - nie mierzono kodowania wideo ani trzymania wielu klatek naraz.

### Po kroku 0: porządki (zgoda użytkownika)

- **Miniatury:** `npm run thumbs` od nowa, bez przywracania starych plików. `test:ui` 39/39 (wcześniej 38/39). Wniosek na przyszłość: miniatur nie przywracam ręcznie, a test UI uruchamiam po ostatniej zmianie plików.
- **Favicon (`proj`):** `app/public/favicon.svg` to znaki logo „▚▞” narysowane prostokątami, biały wzór na tle `--bg`, bez zależności od czcionki. Dodatkowo PNG 32 px i `apple-touch-icon.png` 180 px wygenerowane z SVG. Linki w `index.html`. Sprawdzone: obraz PNG obejrzany, pliki trafiają do `dist`, `smoke` 63/63. W karcie przeglądarki ani na iOS nie sprawdzone (`BRAK`).
- **Usunięte duplikaty** `docs/03-modul-animowane-sceny (1).md` i `docs/04-eksport (1).md`. Były identyczne z plikami w `docs/v2/`.

### Uwaga użytkownika (do zapamiętania, nie naprawiać teraz)

Na podglądzie w boksie przed/po zdjęcie „przed” i „po” czasem się różnią. Użytkownik i tak zmieni zdjęcia przykładowe. Przyczyny nie badałem (`BRAK`). Wrócić do tego przy wymianie zdjęć.

## Krok 2: model animacji (faza φ, rejestr ruchów), RGB Split end-to-end

Plan zaakceptowany przez użytkownika. Decyzje: podgląd zapętla się w nieskończoność; ruchy definiowane w TS, a `effects.json` generowany z rejestru.

### Co zrobiono (`kod`)

- **Silnik:**
  - `render(src, state, { …, phase })`. `phase` to liczba skończona, brak = 0; NaN i ∞ rzucają błąd.
  - Ruch jest w stanie: `state.motion = { id, params }`. Faza idzie osobno, bo zmienia się co klatkę, a stan zostaje ten sam.
  - Efekt dostaje `ctx.motion = { id, phase, p }` albo `null`. Nieznane id ruchu rzuca błąd.
  - Faza **nie jest** zawijana do [0, 1) w potoku. Okresowość musi wynikać ze wzoru efektu, inaczej test okresowości byłby pusty.
- **Konflikt nazw:** `EffectDef.phase` nadal oznacza fazę katalogu (1/2/3). Faza animacji żyje tylko w `RenderOpts.phase` i `ctx.motion.phase`.
- **Rejestr:**
  - `EffectDef.motions: MotionDef[]` (`{ id, name, params }`).
  - `motionCommon()`: `speed` = całkowita liczba cykli na pętlę (1–8), więc pętla domyka się z konstrukcji; `intensity` 0–100%.
  - `gen-effects-json.ts` dopisuje do `effects.json` pola `animated` i `motions` (id, nazwa). Pozostałe pola bez zmian (sprawdzone porównaniem JSON).
- **RGB Split, ruch „pulse” (`proj`):** offset × (1 − intensity · (1 − cos 2π·speed·φ)/2). Przy φ = 0 wynik jest dokładnie statyczny; minimum przypada w połowie cyklu.
- **Aplikacja:**
  - zlecenie `render` w Workerze i `client.render(state, scale, phase)` przyjmują fazę;
  - przypadki zgodności przeglądarka = Node mogą mieć fazę;
  - doszły 4 klatki RGB Split: φ 0 / 0,1 / 0,25 / 0,5.
  - UI (zakładka Animation, odtwarzacz) to krok 3.

### Testy (`test`)

| Test | Wynik |
|---|---|
| `hash-baseline` | **516/516 identyczne** z wzorcem z kroku 0 |
| silnik `check-engine.ts` | 316/316 (308 + 8 nowych) |
| przeglądarka = Node (`QUICK`) | 110/110, w tym 4 klatki animacji; hash φ = 0 = hash obrazu statycznego |
| `test:ui` (`ONLY=rgbsplit`) / `smoke` / `test:editor` | 39/39 / 63/63 / 65/65 |

**Nowe testy silnika (sekcja 33):**
- **Rejestr:** unikalne id ruchów, wartości domyślne w zakresach, `effects.json` zgodny z rejestrem.
- **Błędy:** nieznany ruch i nieskończona faza rzucają błąd.
- **Statyka:** φ = 0, jawnie albo domyślnie, daje obraz statyczny bit w bit.
- **Determinizm:** ta sama φ daje ten sam obraz.
- **Okresowość:** φ = 1, 2 i 3 (przy speed 3) daje bit w bit φ = 0. Dla 4 faz φ i φ + 1 (speed 2) też bit w bit.
  - Próg: najpierw dopuszczałem ±1 na kanał, bo cos(2π·n·φ) różni się w ostatnich bitach float.
  - Pomiar dał 0 różnicy, więc test wymaga zgodności bit w bit.
- **Wzór na obrazie z jedną białą linią (x = 80):**
  - φ 0 → R 90 / G 80 / B 70; φ 0,5 → 84/80/76; φ 0,25 → 87/80/73;
  - @2x przesunięcie ±8 px, zgodnie z 10 × 0,4 × 2.
- **Brak ruchu przy intensity 0:** każda faza = obraz statyczny.
- **Zakres:** dla 32 faz z [0, 1) wymiary i alfa są jak w źródle.

**Błąd we własnym przypadku testowym:**
- Pierwsza wersja przypadków przeglądarkowych miała speed 2 i fazy 0 / 0,25 / 0,5 / 0,75.
- Przy speed 2 fazy 0 i 0,5 oraz 0,25 i 0,75 dają identyczne klatki (pełny cykl i symetria cos), więc dwa przypadki nic nie wnosiły.
- Teraz: speed 1, fazy 0 / 0,1 / 0,25 / 0,5, cztery różne hashe.

### Czego nie sprawdzono (`BRAK`)

- Wyglądu ruchu na oko: kroku 2 nie da się jeszcze obejrzeć w aplikacji. Własności ruchu sprawdzają testy.
- Safari i Firefox.
- Odtwarzania w pętli na kanwie i jego płynności (krok 3).
- Pełnych `test:engine` i `test:a11y`: interfejs się nie zmienił, a z `test:engine` uruchomiłem tylko część zgodności (`QUICK`).

## Krok 3: UI (badge, filtr, zakładka Animation, odtwarzacz)

Decyzje użytkownika:
- filtr „Animation” tylko na `/effects` i w lewym panelu edytora; na stronie głównej sam badge;
- zakładka Animation z ruchem, `speed`, `intensity`, długością pętli i fps; odtwarzanie dopiero po kliknięciu;
- podgląd **liczy całą pętlę z góry w niższej rozdzielczości, potem odtwarza gotowe klatki**.

### Co zrobiono (`kod`)

- **Badge „Animation”:**
  - na kafelku efektu: prawy górny róg miniatury, strona główna i `/effects`;
  - na miniaturze stylu w lewym panelu edytora.
  - Na stronie głównej dziś żaden z 9 kafelków nie ma ruchu, więc badge się tam nie pojawia.
- **Filtr „Animation”:**
  - przycisk na `/effects`, łączy się z kategorią i wyszukiwaniem; stan w adresie `?anim=1`;
  - przycisk w lewym panelu edytora.
  - Wspólna funkcja `passesAnim` w `catalog.ts`.
- **Zakładka Animation** (`editor/anim-ui.ts`):
  - aktywna tylko dla efektów z `motions`; dla pozostałych wyłączona z podpowiedzią;
  - zmiana stylu na efekt bez ruchu zatrzymuje odtwarzanie i wraca do zakładki Styl.
  - Zawartość: lista ruchów, parametry ruchu z silnika (`speed`, `intensity`), pętla (`Loop length` 1–10 s, domyślnie 4 s; `Preview fps` 12/24/30, domyślnie 24), przycisk Odtwórz/Pauza, pasek postępu i komunikat.
  - Ruch zapamiętany jest osobno dla każdego stylu (`EditorState.anim`), z historią cofnij/ponów.
- **Odtwarzacz (`proj`):**
  - N = długość × fps klatek, faza i/N, liczone kolejno w Workerze; potem pętla na `requestAnimationFrame` w czasie rzeczywistym.
  - Limity klatek podglądu:
    - dłuższy bok ≤ 720 px i nie więcej niż podgląd;
    - cała pętla ≤ 96 MB RGBA;
    - przekroczenie limitu obniża skalę.
  - Zmiana dowolnego ustawienia w trakcie odtwarzania: pętla stoi, widać zwykły podgląd, po 400 ms pętla liczy się od nowa i gra dalej.
  - Pauza kasuje klatki i przywraca zwykły podgląd w pełnej rozdzielczości.
- **Worker:** `defs` przekazuje `motions`. `toRenderState(s, withMotion)` dodaje ruch tylko dla klatek animacji, więc eksport PNG i zwykły podgląd są dalej statyczne.
- **Ikona pauzy** w przycisku podczas odtwarzania.

### Testy (`test`)

| Test | Wynik |
|---|---|
| `test:editor` | 71/71 (6 nowych) |
| `test:ui` | 41/41 (2 nowe) |
| `smoke` / `test:a11y` / `check:tokens` | 63/63 / 24/24 / 34/34 |

**Nowe testy:**
- **Badge:** na `/effects` i w lewym panelu badge mają dokładnie efekty z `animated` (dziś: RGB Split).
- **Filtr:**
  - `/effects`: filtr pokazuje tylko te efekty, `?anim=1` w adresie;
  - `?anim=1&cat=glass` daje pusty wynik z komunikatem;
  - lewy panel: filtr włącza i wyłącza się.
- **Zakładka:** aktywna dla RGB Split, wyłączona dla Characters; ma ruch „pulse” i 4 kontrolki.
- **Odtwarzanie:**
  - 96 klatek (4 s × 24 fps) policzonych przed startem; klatki ≤ 720 px;
  - kanwa ma rozmiar klatki;
  - w 12 próbkach co 90 ms co najmniej 4 różne obrazy; licznik pokazanych klatek rośnie.
- **Zmiana intensity w trakcie:** pętla zatrzymana, policzona od nowa, gra dalej.
- **Pauza:** zwykły podgląd w pełnej rozdzielczości, hash kanwy równy obrazowi sprzed odtwarzania.
- **Zmiana stylu na Characters:** odtwarzanie zatrzymane, zakładka wyłączona, panel Styl.

**Pomiar (headless Chromium, dpr 1):**
- przy oknie 1440×900 i 1920×1080 podgląd ma ok. 726×558 px;
- 96 klatek 584×449 px liczy się w 1,3 s i 1,9 s;
- 726×558 przy 96 klatkach przekracza 96 MB, więc skala została obniżona.

**Przy zrzucie ekranu:** miniatura Comic w lewym panelu była czarna. Sprawdziłem plik: poprawny (średnia jasność 110). To leniwe ładowanie (`loading="lazy"`) w chwili zrzutu, nie błąd.

### Czego nie sprawdzono (`BRAK`)

- **Płynności na realnym sprzęcie:** licznik pokazanych klatek rośnie, ale nie mierzyłem fps ani pomijanych klatek.
- **Wydajności na wolniejszym sprzęcie:** wolniejsze efekty (Risograph ok. 1,3 s na klatkę w 1600 px) będą liczyć pętlę znacznie dłużej. Pasek postępu jest, ale anulowanie działa tylko przez Pauzę albo zmianę ustawień.
- **Ekranów HiDPI (dpr 2):** podgląd ma tam więcej pikseli, więc limit 96 MB mocniej obniży rozdzielczość klatek.
- **Safari i Firefox; telefony** (pamięć 96 MB może być za dużo na iOS).
- **`prefers-reduced-motion`:** animacja startuje tylko po kliknięciu, więc nie gra sama. Osobnej obsługi nie dodawałem.

## Krok 4a: eksport GIF

Decyzje użytkownika:
- dłuższy bok najwyżej 1080 px (wybór 480 / 720 / 1080, domyślnie 1080);
- natywny fps z rozkładem opóźnień z pliku 04;
- limit 10 s, ostrzeżenie ponad 20 MB;
- jedna paleta globalna bez ditheringu;
- koder `gifenc`.

### Co zrobiono (`kod`)

- **Biblioteka:** `gifenc` 1.0.3 (MIT, Matt DesLauriers, zero zależności, ostatnie wydanie 2022), zainstalowana w dokładnej wersji. Licencja: `LICENSES/MIT-gifenc.txt` i `THIRD_PARTY_NOTICES.md`. Typy: `app/src/types/gifenc.d.ts`.
  - Node w testach bierze build CommonJS, Vite build ESM. Import w `gif.ts` obsługuje oba.
- **`app/src/engine/gif.ts`** (działa w Workerze):
  - `gifDelays(fps, n)`: `round((i+1)·100/fps) − round(i·100/fps)` cs;
  - `paletteFrames`: do 8 klatek równo w pętli do palety;
  - `flattenOnBlack`: GIF bez alfy, tło czarne jak w JPG;
  - `encodeGif`: paleta 256 kolorów z próbki ≤ 2^20 pikseli tych klatek, potem wszystkie klatki z `applyPalette`, pętla w nieskończoność.
  - Klatki do palety renderują się dodatkowo, więc koszt to n + 8 renderów. Pamięć: jedna klatka naraz plus próbka.
- **Worker:**
  - zlecenie `exportAnim` (stan z ruchem, skala, n klatek, fps);
  - wiadomości postępu (`Progress`);
  - zlecenie `cancel`: między klatkami Worker oddaje sterowanie pętli zdarzeń, więc przerwanie dociera najpóźniej po bieżącej klatce.
- **Klient:** `callLong(req, onProgress)` → `{ promise, cancel }`.
- **Okno eksportu:**
  - opcja GIF tylko dla efektów z ruchem;
  - po jej wyborze pole „Rozmiar animacji” (480/720/1080) z opisem: wymiary, liczba klatek z zakładki Animation, uwaga o szumie;
  - pasek postępu; „Anuluj” przerywa eksport, zamknięcie okna też;
  - plik `ascii-art-<styl>-<bok>px.gif`; komunikat z rozmiarem, czasem i ostrzeżeniem ponad 20 MB.
- **Poprawka błędu znalezionego testem:** `.ed-dialog fieldset { display: grid }` wygrywało z atrybutem `hidden`, więc pole „Skala” nie znikało po wyborze GIF. Dodane `.ed-dialog [hidden] { display: none }`.

### Testy (`test`)

**`npm run test:gif`** (Node, nowy, 7/7):
- **Opóźnienia** dla 12/24/25/30 fps i pętli 1–10 s:
  - suma = round(n·100/fps), czyli długość pętli jest dokładna;
  - odchyłka pojedynczego opóźnienia ≤ 1 cs; każde ≥ 2 cs (przeglądarki zamieniają 0–1 cs na ok. 10 cs);
  - 24 fps: 4,4,5…
- **Plik** z prawdziwych klatek silnika, odczytany własnym parserem bloków GIF89a: wymiary, paleta globalna 256, NETSCAPE loop 0, 24 ramki bez palet lokalnych, opóźnienia równe `gifDelays`, poprawne zakończenie.
- **Koszt:** n + 8 renderów; postęp rośnie do końca.
- **Przerwanie:** daje `CANCELLED`.

**`test:editor`** (76/76, 5 nowych):
- **Okno eksportu:** opcja GIF tylko dla RGB Split; pole rozmiaru i opis; pobranie pliku z okna.
- **`ImageDecoder` w Chromium:** 12 klatek, 1080 px, pętla ∞, czasy 8/8/9 cs, suma dokładnie 1 s.
- **Każdy kolor klatki należy do palety globalnej.**
- **Klatka k jest najbliższa renderowi silnika w fazie k/12, a nie fazom (k+1)/12 i (k+3)/12:**
  - błąd średni ok. 4,2–5,0 wobec 7,3–8,5;
  - to porównanie względne, bez progu.
- **Ruch:** klatka 6 różni się od klatki 0.
- **Przerwanie** w trakcie daje `CANCELLED`.

`test:ui` 41/41, `smoke` 63/63, `test:a11y` 24/24.

**Błędy we własnych testach (poprawione bez podnoszenia progów):**
1. **Próg „średni błąd ≤ 4”** wpisałem przed pomiarem. Zmierzone 4,2–5,0, bo to błąd kwantyzacji 256 kolorami, nie rozjazd faz. Zastąpiłem go własnością bez progu: kolory z palety plus „klatka k najbliższa fazie k”.
2. **Pierwsza wersja porównywała z fazą k+6.** Ruch „pulse” to cos, więc fazy k i n−k dają ten sam obraz; dla k = 3 faza 9/12 jest lustrzana. Teraz k+1 i k+3: 2k+1 i 2k+3 nigdy nie dają 12.

### Pomiar domyślnego eksportu (`test`, headless Chromium)

RGB Split, 4 s × 24 fps = 96 klatek, 1080 px:

| zdjęcie | wymiary | rozmiar | czas |
|---|---|---|---|
| 1 | 1080×830 | **26,7 MB** | 12,4 s |
| 2 | 1080×720 | **41,8 MB** | 15,3 s |

- **Oba pliki przekraczają próg ostrzeżenia 20 MB.** Zdjęcia z detalem słabo się kompresują w GIF, a w RGB Split zmienia się prawie każdy piksel.
- **Pasma** na gradiencie nieba (256 kolorów bez ditheringu) widać na oko.

### Czego nie sprawdzono (`BRAK`)

- Odtwarzania pliku w Safari i Firefoksie (jitter ±1 cs); rozmiaru dla innych efektów.
- Pamięci przy 10 s × 30 fps (300 klatek): klatki nie są trzymane, ale nie mierzyłem.
- Eksportu z przezroczystością: GIF jest zawsze na czarnym tle.

## Krok 4b: badanie wykonalności MP4 (raport przed implementacją)

Prototyp był w osobnym katalogu poza repozytorium, bez zmian w aplikacji. Środowisko: Chromium 141 z Playwrighta (headless), `ffprobe` 6.1.1.

### Wyniki (`test`)

**1. W tym Chromium nie ma kodera H.264.**
- `VideoEncoder.isConfigSupported` zwraca `false` dla wszystkich `avc1`: profile 42/4d/64, poziomy 3.1–5.1, wymiary 720–1920 px, przy każdym ustawieniu przyspieszenia (68 kombinacji).
- Działają VP9 (`vp09.00.10.08`) i AV1 (`av01.0.08M.08`) we wszystkich wymiarach.
- Otwarty Chromium nie zawiera kodeków H.264; ma je Chrome od Google. **Kodowania H.264 nie da się tu przetestować** (`BRAK`). Wymaga testu użytkownika w Chrome, Safari i Firefoksie.

**2. Ścieżka koder → muxer → MP4 działa** (sprawdzone na VP9 i AV1 w kontenerze MP4, odczyt `ffprobe`):
- 96 klatek 1080×830 przy 24 fps: plik ma `nb_frames=96`, `duration=4.000000`, `r_frame_rate=24/1`, `yuv420p`, `color_range=tv`;
- `+faststart`: `moov` (bajt 28) przed `mdat`, zarówno w `mp4-muxer` (`fastStart: 'in-memory'`), jak i w Mediabunny;
- czas kodowania (bez renderu efektu): 96 klatek ok. 0,5–0,8 s; 300 klatek 1080×830 przy 30 fps 1,7 s.

**3. Pamięć:**
- 300 klatek 1080p z bufora RGBA (jak z silnika); co 50 klatek GC i odczyt sterty JS strony;
- sterta: 6 → 47 → 48 → 38 → 41 → 49 → 45 MB, płasko, bez wzrostu liniowego;
- pamięci kodera i GPU poza stertą JS nie mierzyłem.

**4. Metadane koloru: BT.601, nie BT.709.**
- `ffprobe` pokazuje `color_primaries/transfer/space=smpte170m` (BT.601), także gdy `VideoFrame` dostaje jawne `colorSpace` BT.709.
- Wymaganie z pliku 04 (BT.709) **nie jest spełnione bez dodatkowej pracy**. Możliwe drogi: nadpisanie `decoderConfig.colorSpace` w metadanych dla muxera albo sprawdzenie, jaką macierz RGB→YUV koder faktycznie stosuje (etykieta inna niż macierz = przesunięcie kolorów).
- Do zbadania przy implementacji; może zachowywać się inaczej dla H.264 w Chrome.

### Biblioteki (`npm view`, 16 X 2026)

| Pakiet | Wersja | Licencja | Stan | Uwagi |
|---|---|---|---|---|
| `mp4-muxer` | 5.2.2 | MIT | **wycofany** („superseded by Mediabunny”) | działa (sprawdzone); bez dalszych poprawek |
| `mediabunny` | 1.61.x | **MPL-2.0** | aktywnie rozwijany (1.61.5 z 15 X) | działa (sprawdzone); następca `mp4-muxer` |
| `mp4box` | 2.4.1 | BSD-3 | aktywny | głównie parser; muxowanie WebCodecs bardziej pracochłonne |

**MPL-2.0** to copyleft na poziomie pliku (`docs`, treść licencji; nie jestem prawnikiem):
- użycie niezmienionej biblioteki z npm w naszym buildzie jest dozwolone;
- zmienione pliki samej biblioteki trzeba by udostępnić;
- w notkach licencyjnych należy podać źródło.

Propozycja: Mediabunny w wersji co najmniej dwutygodniowej (np. 1.61.0 z 29 IX), dokładnie przypiętej.

### Propozycja implementacji (`proj?`)

1. **Kodek:** H.264 (`avc1.640028`, High 4.0; do 1080 px wystarcza), gdy `isConfigSupported` zwraca `true`. Wymiary zaokrąglone do parzystych.
2. **Brak H.264** (np. Chromium bez kodeków, część Firefoksów): komunikat zamiast pliku. Fallback (WebM/VP9 albo MP4/AV1) tylko za zgodą użytkownika.
3. **Testy automatyczne** (bo H.264 tu nie działa):
   - ścieżka kodowania i kontener sprawdzane na VP9 w MP4, przez wymuszenie kodeka w haku testowym;
   - liczba klatek, czas, faststart, wymiary parzyste, BT.709 po poprawce, odczyt `ffprobe`;
   - komunikat przy braku H.264;
   - test dymny H.264 w prawdziwych przeglądarkach wykonuje użytkownik.
4. **Raport wsparcia na `/dev/engine`:** sekcja „WebCodecs”, czyli lista `isConfigSupported` dla H.264/VP9/AV1. Użytkownik otwiera ją na swoich urządzeniach i odsyła wynik.
5. **Bitrate (`proj?`):** ok. 8 Mb/s przy 1080 px. Rozmiar do oceny na zdjęciach (oczekiwany wielokrotnie mniejszy niż GIF).

## Krok 4c: eksport MP4

Decyzje użytkownika:
- biblioteka Mediabunny;
- bez H.264 w przeglądarce komunikat zamiast pliku (bez fallbacku);
- sekcja WebCodecs na `/dev/engine`;
- testy automatyczne na wymuszonym VP9, H.264 sprawdza użytkownik.

### Co zrobiono (`kod`)

- **Biblioteka:** `mediabunny` 1.61.0 (MPL-2.0, z 29 IX, więc ponad 2 tygodnie), przypięta dokładnie, używana bez zmian.
  - Licencja: `LICENSES/MPL-2.0-mediabunny.txt`, `THIRD_PARTY_NOTICES.md` z linkiem do źródła.
  - Ładowana w Workerze dopiero przy eksporcie MP4 albo sprawdzeniu kodeka (`import()`). Worker ma 337 kB jak przed zmianą; MP4 to osobny plik 189 kB. Bez tego Worker urósłby o 190 kB (+48 kB po gzip).
- **`app/src/engine/mp4.ts`:**
  - **Wymiary parzyste:** `evenDims`, w dół do parzystych; najwyżej 1 px z prawej lub z dołu.
  - **Bitrate (`proj`):** `mp4Bitrate` = 8 Mb/s przy 1080×810, proporcjonalnie do liczby pikseli, min 1,5 Mb/s.
  - **Kolory:** `rgbaToI420` zamienia RGBA → I420 macierzą **BT.709** w zakresie tv, z chromą uśrednioną 2×2. Klatka trafia do kodera jako I420 z `colorSpace` BT.709.
    - Powód: w kroku 4b przy klatkach RGBA przeglądarka zapisywała BT.601 mimo jawnego `colorSpace`.
    - Teraz macierz i oznaczenie są pod naszą kontrolą; `ffprobe` pokazuje BT.709.
  - **Kodowanie:** `encodeMp4` przez `VideoSampleSource` → `Mp4OutputFormat({ fastStart: 'in-memory' })`. Klatka i ma czas i/fps, klatka kluczowa co 2 s; przerwanie anuluje plik.
  - Tło czarne, jak w GIF.
- **Worker:**
  - `exportAnim` z `format: 'mp4'` (i `codec` tylko dla testów); sprawdza kodek **przed** renderem: brak → błąd `NO_CODEC:avc`;
  - `mp4Support` (H.264 i VP9 w danych wymiarach);
  - `webcodecs` (tabela dla `/dev/engine`).
- **Okno eksportu:**
  - opcja MP4 dla efektów z ruchem; rozmiar 480/720/1080 i opis z wymiarami parzystymi;
  - po wyborze MP4 sprawdzenie H.264; bez niego komunikat „Ta przeglądarka nie koduje wideo H.264…” i wyłączony przycisk Pobierz;
  - plik `ascii-art-<styl>-<bok>px.mp4`.
- **`/dev/engine`:** sekcja „WebCodecs w Workerze (eksport MP4)” z tabelą `isConfigSupported` (H.264 High/Main/Baseline, VP9, AV1 × 1080/720/480) i werdyktem. Wynik też w `window.__engineReport.webcodecs`.

### Testy (`test`)

| Test | Wynik |
|---|---|
| `test:mp4` (Node, nowy) | 6/6 |
| `test:editor` | 80/80 (4 nowe) |
| `test:gif` / silnik | 7/7 / 316/316 |
| `test:ui` / `smoke` / `test:a11y` | 41/41 / 63/63 / 24/24 |
| przeglądarka = Node (`QUICK`) | 110/110 |

**`test:mp4`:**
- **Wartości referencyjne BT.709** (zakres tv, 8 bit, ±1): czerń 16/128/128, biel 235/128/128, czerwień 63/102/240, zieleń 173/42/26, niebieski 32/240/118.
- **Odróżnienie od BT.601:** czerwień w BT.601 ma Y 81, a nie 63, więc test nie przejdzie przy złej macierzy.
- **Struktura I420:** chroma 2×2; szerokość wiersza źródła różna od wyjścia.
- **Wymiary parzyste i bitrate.**

**`test:editor` (Chromium z Playwrighta, bez H.264):**
- **UI bez kodera:** komunikat i wyłączony przycisk.
- **Worker:** zlecenie H.264 kończy się `NO_CODEC:avc`; przerwanie daje `CANCELLED`.
- **Kontener na wymuszonym VP9** (sprawdzenie `ffprobe`; bez `ffprobe` w PATH test jest jawnie oznaczony jako pominięty):
  - 12 klatek, 1,000 s, 12 fps;
  - wymiary parzyste, yuv420p, zakres tv;
  - **primaries/transfer/matrix = BT.709**;
  - `moov` przed `mdat`; typ `video/mp4`.
- **Piksele:** klatka 3 zdekodowana przez `ffmpeg` (YUV→RGB według znaczników) jest najbliższa renderowi silnika w fazie 3/12, a nie 1/12 i 5/12.

**Błąd we własnym teście:**
- Pierwsza wersja porównywała klatkę 6 z fazami 6, 7 i 9/12.
- Faza 6/12 to minimum cos, więc przesunięcie RGB Split wynosi 4,0 px przy 6/12 i 4,4 px przy 7/12. Różnica 0,4 px ginie w stratnej kompresji (błędy 2,81 i 2,77).
- Teraz klatka 3, gdzie ruch jest najszybszy: 7 px wobec 9,3 i 4,4 px.
- Progu nie ma.

### Pomiar (`test`, VP9 jako zastępstwo H.264)

RGB Split, domyślnie 4 s × 24 fps, 1080 px:
- **zdjęcie 1:** 1080×830, 3,35 MB, 9,7 s;
- **zdjęcie 2:** 1080×720, 3,33 MB, 9,2 s.

Dla porównania GIF tych samych klatek: 26,7 i 41,8 MB.

### Czego nie sprawdzono (`BRAK`)

- **Kodowania H.264**, a więc i wyglądu, rozmiaru oraz BT.709 w pliku H.264. Wymaga Chrome, Safari lub Firefoksa użytkownika: `/dev/engine`, sekcja WebCodecs, potem eksport MP4 w edytorze.
- **Odtwarzania MP4** w QuickTime, na iOS i w odtwarzaczach systemowych.
- **Pamięci przy 300 klatkach** z renderem efektu; w kroku 4b mierzyłem samo kodowanie.

## Krok 5: Tier A (Scanline, Twirl, Ripple, ZigZag, Fluted Glass, Disco, Pixel Art)

RGB Split miał ruch od kroku 2. Rodzina ASCII to osobny krok 6.

### Ruchy (`proj`; brief: plik 09, sekcja 2.2)

Każdy jest okresowy z konstrukcji (całkowita liczba cykli `speed`) i przy φ = 0 daje obraz statyczny.

| Efekt | Ruch | Wzór |
|---|---|---|
| Scanline | roll | wzór przesuwa się o speed okresów (roll + speed·φ okresu) |
| Twirl | oscillate | amount × (1 − I·(1 − cos 2π·speed·φ)); przy I = 100% do −amount i z powrotem |
| Ripple | spread | faza sinusa −2π·speed·φ: fale biegną od środka |
| ZigZag | flow | fala trójkątna przesuwa się o speed długości fali w pionie |
| Fluted Glass | slide | żłobki (soczewki) przesuwają się o speed szerokości; obraz pod nimi stoi |
| Disco | hue cycle | obrót koloru wokół osi szarości o 360°·speed·φ (Rodrigues), mieszany z oryginałem w proporcji I |
| Pixel Art | breathe | blok × (1 − I·(1 − cos)/2), zaokrąglony do px przy skali 1, potem × skala |

**Uwagi:**
- **Ripple/ZigZag (`kod`):** w naszym silniku nazwy odpowiadają zachowaniu, więc zamiana etykiet z pliku 01 nas nie dotyczy.
- **Pixel Art „breathe”** zmienia rozmiar skokami po 1 px, a siatka jest zaczepiona w lewym górnym rogu. Ocena na oko: ruch widać, ale nie jest płynny (zgodnie z ryzykiem w briefie).
- **Poprawka przed testem:** pierwsza wersja zaokrąglała rozmiar bloku już po przeskalowaniu, przez co @2x miałby inną liczbę bloków. Teraz rozmiar jest liczony w px przy skali 1.

### Testy (`test`)

**Silnik (323/323, sekcja 34).** Własności wspólne dla **każdego** ruchu w rejestrze (dziś 8):
- φ 0 = statyczny bit w bit;
- φ 1 = φ 0; dla faz 0,1 / 0,25 / 0,6: φ i φ + 1 bit w bit (pomiar: 0 różnic we wszystkich 8 ruchach, próg 0);
- φ 0,25 ≠ statyczny, czyli ruch jest;
- determinizm; alfa i wymiary;
- speed 2 daje okres 1/2;
- komórki @2x = @1x.

Po jednej własności na efekt:
- **Scanline:** φ 0,2 przy okresie 5 px = wzór przesunięty o 1 wiersz.
- **Twirl:** φ 0,5 (100%) = statyczny Twirl z amount −120, bit w bit.
- **Disco:**
  - szarość nie zmienia się w żadnej fazie (obrót wokół osi szarości);
  - czerwień po 120° → zieleń (0,255,0).
- **Pixel Art:** φ 0,5 → blok 6 px, 27×20 komórek zamiast 14×10.
- **Fluted Glass:** na płaskim obrazie wzór cieniowania po 1/3 pętli = statyczny przesunięty o 8 px (1/3 z 24 px).
- Ripple i ZigZag mają tylko własności wspólne; kierunku ruchu fali nie sprawdzałem osobno.

**Błąd we własnym teście:** pierwsza wersja testu Fluted Glass zakładała, że przesuwa się obraz. Ruch przesuwa soczewki, a nie treść, więc własność była źle sformułowana. Teraz test sprawdza przesunięcie wzoru cieniowania na płaskim obrazie.

**Aplikacja:**
- `hash-cases` obejmuje każdy ruch z rejestru w fazie 0,3; przeglądarka = Node 117/117;
- `test:ui` 41/41, `test:editor` 80/80, `smoke` 63/63, `test:a11y` 24/24;
- badge „Animation” jest teraz na 8 efektach, w tym na kafelku Pixel Art na stronie głównej.
- `hash-baseline` 516/516 identyczny.

**Ocena na oko:**
- arkusz 7 efektów × fazy 0 / 0,25 / 0,5 na zdjęciu 1 (360 px): ruch widoczny w każdym;
- czas klatki w Node przy 360 px: 1–19 ms.

### Czego nie sprawdzono (`BRAK`)

- Płynności odtwarzania w aplikacji na prawdziwym sprzęcie.
- Wyglądu GIF i MP4 dla tych efektów (ścieżka eksportu jest wspólna i sprawdzona na RGB Split).

## Krok 5a: GIF domyślnie 720 px, opcjonalny dithering (decyzja użytkownika)

- **Okno eksportu:** rozmiar animacji domyślnie **720 px** (480 / 720 / 1080). Dla GIF pole „Dithering”, domyślnie wyłączone.
- **Dithering uporządkowany Bayer 8×8** (`proj`), amplituda ±12 (`DITHER_AMP` 24).
  - Przesunięcie zależy tylko od pozycji piksela, więc wzór jest stały w każdej klatce.
  - Dyfuzja błędu (Floyd-Steinberg) dałaby w animacji migoczące ziarno i większy plik, dlatego jej nie użyłem.
  - Amplituda dobrana na oko.

**Testy (`test`):**
- `test:gif` 10/10, 3 nowe:
  - wzór taki sam w dwóch klatkach, średnia 0, zakres ±12;
  - na gradiencie 256 px przy palecie 8 szarości błąd średniej w blokach 8×8 spada z 9,19 (bez) do 3,52 (z ditheringiem), czyli mniej pasm;
  - GIF z ditheringiem ma tę samą strukturę.
- `test:editor` 80/80: domyślne 720 px, plik `…-720px.gif`, `ImageDecoder` 720 px.

**Pomiar** (RGB Split, zdjęcie 1, 4 s × 24 fps, 720×553):

| wariant | rozmiar | czas |
|---|---|---|
| bez ditheringu | 12,6 MB | 7,7 s |
| z ditheringiem | 16,8 MB | 8,6 s |

Na oko: pasma na niebie znikają, zostaje drobny, regularny wzór.

## Podgląd na Vercel (zgoda użytkownika)

- Wdrożenie typu preview gałęzi `etap2-animacje` @ `f054109`; **produkcja bez zmian**.
- Adres stały dla gałęzi: `https://ascii-art-effects-git-etap2-animacje-wojta-six9.vercel.app`; tego wdrożenia: `ascii-art-effects-8vu5ji5bf-wojta-six9.vercel.app`.
- Stan READY (Vercel, `test`). Otworzyć ze środowiska sesji się nie da (blokada sieci), a projekt ma Vercel Authentication, więc wymaga zalogowania.

## Krok 6: odczyt kodu ascii.rest (przed implementacją)

**Źródło:**
- `github.com/bas3line/ascii` @ `8fd792e` (16 X 2026); licencja MIT, `Copyright (c) 2026 bas3line`;
- sklonowane poza repozytorium, tylko do odczytu; nic nie skopiowane.

**Glint (`site/src/lib/logo-file.ts`, `kod`):**
- ukośny pas o połowie szerokości 5 komórek, przesunięty o 0,9 komórki na wiersz (pochyła kreska);
- przechodzi przez zasięg tuszu w 2 s, co `every` s (≥ 2,5 s), pierwszy po 0,5 s;
- siła k = smoothstep(1 − d/5);
- znak z zestawu „pełnych” (`8dbqpPYOo0`, w stylu shade `-=+*#%@`) przy k > 0,55 zamienia się na `/`;
- kolor bierze jeden z 3 poziomów palety: bez zmian, rozjaśniony 35% lub 70% w stronę bieli (k > 0,25 i k > 0,6).

**Scan (`kod`):**
- pozioma linia biegnie z góry na dół przez zasięg tuszu w 2 s, co `every` s;
- „głowa” 2 wiersze: znaki zamienione na szum `#$%&*+<=>?@[]{}` z prawdopodobieństwem 3/4 (hasz komórki i „tiku”; szum zmienia się co drugą klatkę);
- „ogon” 5 wierszy: kolor rozjaśniony 35%.

**Paleta logo:**
- 6 poziomów na kolor: bazowy, +35%, +70%, oraz te same dla ciemnego tła;
- przy limicie formatu 64 kolorów daje to najwyżej 10 kolorów obrazu.

**Format `piece` (`src/types.ts`, aktualny):**
- `meta` = { name, category, note, cols, rows, fps, options?, clock?, palette? (≤ 64 #rrggbb), ground?, cell?, **loop?**, **still?** } plus `default(options) → Frame(t, env)`.
- Względem pliku 03 (commit z 8 X) doszły `loop` (okres w s, potrzebny ich SVG) i `still` (klatka dla `prefers-reduced-motion`).
- Biblioteka ma dziś 240 piece’ów.

**SVG (`src/svg.ts`, `kod`):**
- pętla próbkowana 15 razy na sekundę; każda różna klatka to grupa wierszy `<text>` pokolorowanych odcinkami;
- CSS pokazuje grupy po kolei; wiersze rozciągnięte do siatki (`textLength`), więc pasują w każdej czcionce o stałej szerokości;
- czcionka systemowa (`ui-monospace, …`), bez osadzania;
- przy `prefers-reduced-motion` jedna klatka.

## Krok 6A: glint i scan dla rodziny ASCII

Decyzje użytkownika: ruch przez **znaki, jak w oryginale**, dla wszystkich 9 efektów. SVG z wyborem: z czcionką osadzoną albo bez. TS: 6 odcieni na kolor (najwyżej 10 kolorów zdjęcia); siatka ponad 80×32 automatycznie zmniejszana z komunikatem.

### Co zrobiono (`kod`)

- **`grid.ts`:**
  - `ASCII_MOTIONS` = **glint** (speed, pass %, width w komórkach) i **scan** (speed, pass %);
  - dołączone do Characters, Block, Braille, Dots, Cross, Diamond, Lines, Diagonal i Mixed;
  - zachowanie odczytane z `bas3line/ascii` @ `8fd792e` (`site/src/lib/logo-file.ts`); implementacja własna, okresowa w fazie; w nagłówku sekcji źródło i licencja MIT.
- **Glint:**
  - ukośny pas: 0,45 px w poziomie na 1 px w pionie (odpowiednik 0,9 komórki 1:2 na wiersz), połowa szerokości 5 komórek;
  - siła k = smoothstep;
  - komórka z tonem ≥ 0,3 przy k > 0,55 → znak `/` z czcionki;
  - kolor rozjaśniony o 35% (k > 0,25) lub 70% (k > 0,6).
- **Scan:**
  - linia wierszy z góry na dół;
  - głowa 2 wiersze: 3/4 komórek z tuszem → znaki szumu `#$%&*+<=>?@[]{}` (hasz komórki i tiku, 12 tików na przejście), kolor +70%;
  - ogon 5 wierszy: kolor +35%.
- **Czas:** `speed` przejść na pętlę; przejście zajmuje `pass`% cyklu (oryginał: 2 s co 4 s = 50%), reszta to przerwa. Przy φ = 0 pas jest przed obrazem.
  - Z oryginału **pominięte**: początkowe 0,5 s opóźnienia (nasza pętla musi być okresowa od 0).
- **Efekty kształtowe** (Dots, Cross, Diamond, Lines, Diagonal, Block, Braille):
  - zastępowana komórka zamiast kształtu dostaje znak `/` lub szum z czcionki;
  - pozostałe komórki w pasie zostają kształtem w rozjaśnionym kolorze;
  - bez dostawcy glifów: czytelny błąd.
- **Eksport tekstowy** (Characters, Block, Braille, Mixed) z tym samym ruchem (`motionChar`); puste znaki (spacja, U+2800) zostają puste, jak w oryginale.
- **Aplikacja:** glint i scan wyłączone z porównania przeglądarka = Node, bo rysują znaki czcionką, a raster zależy od silnika.

### Testy (`test`)

**Silnik 330/330:**
- **Własności wspólne** dla 26 ruchów (18 nowych): φ 0 = statyczny, okresowość bit w bit, ruch widoczny, speed 2, @2x.
- **Sekcja 35:**
  - **Przy φ 0 i w przerwie** (φ 0,75 przy pass 50%) tekst i obraz są statyczne.
  - **Glint, tekst Characters:**
    - 47 zmian, wyłącznie na `/`, wyłącznie w ukośnym pasie liczonym wzorem z kodu;
    - nigdy w miejscu spacji.
  - **Scan, tekst Characters:**
    - zmiany tylko w 2 wierszach głowy i tylko na znaki szumu;
    - zmieniona część znaków głowy 39/54 ≈ 0,72 (oczekiwane ≈ 3/4);
    - szum zmienia się w czasie.
  - **Glint, Dots (kształty):** poza komórkami pasu 0 zmienionych pikseli; w pasie 3900.
  - **Kolor:** ten sam znak w komórce ma jasność × 1,00 / ×1,34–1,36 / × 1,70, czyli dokładnie poziomy 0 / 35% / 70% przy tuszu #808080.
  - **Brak dostawcy glifów** daje czytelny błąd.
- **`hash-baseline`:** 516/516 identyczny.

**Błędy we własnych testach (poprawione bez zmiany progów):**
1. **„Glint podnosi średnią jasność klatki”** to fałszywa własność: zamiana pełnej kropki na cienki `/` zmniejsza ilość tuszu. Zastąpiona przez stosunek jasności tej samej komórki z tym samym znakiem.
2. **Druga wersja zakładała maksimum piksela 128 i 217.** Antyaliasing maski znaku nie daje pełnego krycia (wyszło 125 i 202). Stosunek w tej samej komórce nie zależy od krycia.
3. **Brak czcionek w teście wspólnym:** sekcja 34 renderowała bez dostawcy glifów, a efekty znakowe go wymagają; dodany.

**Aplikacja:**
- `test:editor` 81/81:
  - Characters ma teraz zakładkę Animation, więc testy z „efektem bez ruchu” używają LEGO;
  - nowy test: Characters glint w podglądzie, 96 klatek, kanwa zmienia się w czasie.
- `test:ui` 41/41, `smoke` 63/63, `test:a11y` 24/24, przeglądarka = Node 117/117.

**Na oko:** arkusz 6 przypadków (Characters glint/scan, Dots glint, Braille scan, Block glint, Diagonal scan) na zdjęciu 1 przy 480 px: zachowanie jak w opisie oryginału.

### Czego nie sprawdzono (`BRAK`)

- Porównania 1:1 z animacją na ascii.rest (strony nie da się otworzyć w tym środowisku).
- Czy w przeglądarce znaki `/` i szum zawsze mają już wczytaną czcionkę; podzbiór łaciński Geist Mono wczytuje się przy starcie, ale osobnego testu „świeży Worker” dla tych znaków nie ma.

## Krok 6B: eksport animowanego SVG

Decyzja użytkownika: SVG z wyborem, z osadzoną czcionką albo bez.

### Co zrobiono (`kod`)

- **Silnik:**
  - `CellGrid` (siatka znaków + kolor każdej komórki + kolor tła), `EffectDef.cells()`, `renderCells()`;
  - `cells()` mają Characters, Block, Braille i Mixed (efekty z wersją tekstową). Kolor komórki = średnia komórki albo kolor tuszu (mono), rozjaśniony przez glint/scan tak jak w rastrze.
- **`engine/src/export/svg.ts`** (kod własny, technika jak ascii.rest `src/svg.ts` @ `8fd792e`, nic nie skopiowane):
  - pętla próbkowana 15 fps (jak oryginał, `proj`); kolejne identyczne klatki łączone w jedną grupę;
  - kolory wszystkich klatek sprowadzone median cut do ≤ 32 klas CSS (`proj`: dłuższe odcinki `<tspan>`);
  - **warstwa bazowa** = klatka 0 (zawsze widoczna); każda inna grupa zawiera tylko odcinki komórek różne od bazy (prostokąt w kolorze tła + tekst). Pierwsza wersja kopiowała całe klatki: ok. 1,8 MB zamiast 300–400 kB przy tej samej siatce;
  - CSS: `step-end`, wspólny czas pętli, ujemne opóźnienia; wiersze rozciągnięte `textLength`, więc pasują w każdej czcionce o stałej szerokości;
  - `prefers-reduced-motion`: nakładki ukryte, widać obraz statyczny.
- **Aplikacja:**
  - format `svg` w `exportAnim` (Worker): klatki `renderCells` w skali 1 (gęstość siatki nie zależy od skali, bo rozmiar komórki skaluje się z obrazem), N = długość pętli × 15;
  - opcja **„Osadź czcionkę”**: podzbiory Geist Mono 400, których `unicode-range` obejmuje użyte znaki, jako woff2 base64. Znaków spoza Geist Mono (Braille, grecki, katakana) nie osadzamy; komunikat po eksporcie je wymienia;
  - w oknie eksportu radio SVG tylko dla efektów z ruchem i siatką znaków; zamiast rozmiaru w px opis siatki („Siatka C×R znaków, N klatek”) i informacja, że SVG zawiera tylko znaki efektu (bez Post FX, Color i napisów);
  - przy okazji: ukrywanie GIF/MP4 dla efektów bez ruchu obejmowało tylko pierwszą etykietę (`querySelector`); teraz wszystkie.

### Pomiary (`test`, Node, zdjęcie 1, 4 s = 60 klatek, ustawienia domyślne)

| Szerokość źródła | Characters glint | Characters scan | Braille scan | Block glint |
|---|---|---|---|---|
| 800 px (134 kol.) | 490 kB | 472 kB | 51 kB | 334 kB |
| 1200 px (200 kol.) | 1021 kB | 639 kB | 84 kB | 731 kB |
| 1600 px (267 kol.) | 1920 kB | 840 kB | 115 kB | 1433 kB |

- Rozmiar zależy głównie od efektu (Braille ma mało kolorów i krótkie zmiany), nie tylko od siatki, więc **ostrzeżenia „duży plik” z góry nie ma**: pokazujemy rzeczywisty rozmiar po eksporcie.
- **Osadzenie czcionki** dla Characters: 1 podzbiór (latin), 589 → 602 kB, czyli ok. 13 kB. Wcześniejsze szacunki 40–70 kB były zawyżone.

### Testy (`test`)

- **`test:svg` 12/12** (`app/scripts/svg-check.ts`, Chromium): dla Characters glint/scan, Braille scan, Block glint, Mixed scan:
  - w każdej z 30 klatek animacja CSS zatrzymana w chwili klatki k (Web Animations `currentTime`), widoczny tekst złożony z bazy i widocznych nakładek = tekst klatki k z silnika, znak w znak; najwyżej 1 nakładka naraz; ≤ 32 klasy kolorów;
  - `prefers-reduced-motion` → widać tylko bazę = obraz statyczny efektu;
  - median cut na 4 kolorach; jedna klatka → SVG bez animacji.
  - Test znalazł **błąd krytyczny**: skrót `g.f{animation:…}` zerował `animation-name` i miał wyższą specyficzność niż `.gN`, więc nic się nie animowało. Poprawione (właściwości rozpisane, selektory `.f.gN`).
- **`test:editor` 85/85** (4 nowe): radio SVG tylko dla efektów z siatką; opis siatki i 15 klatek; pobranie `ascii-art-characters.svg`; bez osadzenia brak `@font-face`, plik otwiera się jako `<img>` i ma animacje; z osadzeniem każdy podzbiór wczytuje się jako `FontFace`, Geist Mono pierwszy w stosie, różnica rozmiaru ≈ długość base64 (zapas 400 znaków na podzbiór to długość reguły `@font-face` z `unicode-range`, nie próg dobrany do wyniku).
- Silnik 330/330, `hash-baseline` 516/516 identyczny, `test:ui` 41/41, `smoke` 63/63, `test:a11y` 24/24, `test:gif` 10/10, `test:mp4` 6/6.

### Czego nie sprawdzono (`BRAK`)

- SVG w Safari, Firefoksie, README na GitHubie i jako `<img>` w innych przeglądarkach niż Chromium.
- Wyglądu znaków bez osadzenia na różnych systemach (czcionka systemowa; siatka trzyma się dzięki `textLength`, kształt znaków się różni).
- Wydajności odtwarzania dużych plików (ok. 2 MB, 267 kolumn) na słabszym sprzęcie.

### Otwarte (`decyzja użytkownika`)

- **Efekty kształtowe** (Dots, Cross, Diamond, Lines, Diagonal) mają glint/scan, ale nie mają wersji tekstowej, więc SVG (i TS) dla nich nie ma.
