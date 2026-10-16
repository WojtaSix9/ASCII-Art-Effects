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
