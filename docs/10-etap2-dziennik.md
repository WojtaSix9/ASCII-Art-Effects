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
