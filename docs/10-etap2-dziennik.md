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
