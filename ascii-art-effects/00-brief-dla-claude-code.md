# Brief dla Claude Code: ASCII Art Effects (strona w przeglądarce)

Stan na 12 X 2026. Dokument zbiera to, co jest ustalone i przetestowane, żeby Claude Code mógł zacząć bez czytania całej historii. Szczegóły są w plikach 01–04 i w `reports/`.

Oznaczenia: `test` = sprawdzone uruchomieniem (Node 22, piaskownica), `kod` = sprawdzone w kodzie, `docs` = z dokumentacji, `proj` = decyzja projektowa, `proj?` = propozycja do potwierdzenia, `BRAK` = nie zrobione i nie sprawdzone.

---

## 1. Cel i zakres

**Cel:** własne narzędzie w stylu ASCII Magic (ascii-magic.com), działające w przeglądarce, bez serwera. Nie kopia 1:1: własny katalog 91 efektów (plik 02) i własne nazwy.

**Dwa moduły:**
1. **Style obrazkowe** (pliki 01–02): wejście to zdjęcie lub wideo użytkownika. Na dziś tylko specyfikacja, **BRAK kodu**.
2. **Animowane sceny ASCII** (plik 03): sceny same rysują obraz. **Prototyp działa w Node** (30 scen, odtwarzacz, renderer, eksport).

**Zakres, którego nie ruszamy bez pytania:** bez trybu generatywnego (AI), bez komponentu interaktywnego do osadzania, bez scen z logotypami i dystrybucjami (66 plików, znaki towarowe).

**Do potwierdzenia na starcie (`proj?`):** użytkownik zatwierdził odpowiedzi na pytania z pliku 02 (sekcja 13), ale ich treść nie została zapisana w plikach. Pierwszy krok Claude Code: zapytać, czy wersja 1 obejmuje (a) tylko moduł scen, czy (b) moduł scen plus Fazę 1 efektów obrazkowych z pliku 02, sekcja 12 (18 stylów, 16 darmowych post FX, Color, Backdrop).

**UI:** celujemy stylistycznie w ascii-magic.com (decyzja użytkownika). **BRAK briefu wizualnego.** Użytkownik dostarczy zdjęcia osobno; dopiero one (i ewentualnie zrzuty ekranu) pozwolą opisać kolory, typografię i układ. Plik 01, sekcja 1 opisuje tylko strukturę panelu edytora (Backdrop → parametry stylu → Intensity → Blur, zakładki Style, Animation, Lights, Color, Post FX), nie wygląd.

---

## 2. Zasady pracy (od użytkownika)

- Małe kroki, jeden etap naraz. Oznaczać źródła informacji (docs / kod / test / proj).
- Być rzetelnym i sceptycznym; nie zgadzać się na wszystko; raportować też testy, które zawiodły i błędy w własnych testach.
- **Nie pobierać ponownie** ascii-magic.com ani repozytorium github.com/bas3line/ascii (kosztuje dużo tokenów; wszystko potrzebne jest w plikach). Wyjątek wymaga zgody użytkownika.
- Nie rozszerzać zakresu poza zadanie bez pytania.
- Decyzje użytkownika: GIF **maksymalnie 10 s** (twardy limit); **nie dołączamy pliku czcionki** do repozytorium; formaty eksportu scen: MP4, GIF, PNG, tekst jednej klatki.

---

## 3. Co już jest (kod w `ascii-scenes-szkielet-v8.zip`)

Po rozpakowaniu: `npm install` (node_modules nie ma w archiwum). Node 22 uruchamia `.ts` bezpośrednio w trybie strip-only: bez parameter properties, importy z rozszerzeniem `.ts`.

| Element | Pliki | Status |
|---|---|---|
| Kontrakt sceny, 30 scen startowych | `src/types.ts`, `src/pieces/*.ts` (kopie z commita `2572c26`, MIT) | `test` |
| Rejestr i odtwarzacz | `src/registry.ts`, `src/player.ts` (`ScenePlayer`) | `test` 30/30 |
| Renderer klatki (kanwa i bufor RGBA) | `src/render.ts`, `src/glyphs.ts` | `test` w Node |
| Pętle i długości klipów | `src/durations.ts` (generowany), `src/clip.ts` (`resolveClip`), `reports/LOOPS.md`, `reports/loops-tol.json` | `test` |
| Eksport Node: PNG, tekst, MP4, GIF | `src/export-node.ts`, `src/export-video.ts`, `src/export-gif.ts`, `scripts/export.ts` (CLI) | `test` |
| GIF bez zależności od Node | `src/gif-js.ts` (biblioteka `gifenc`), `src/gif-parse.ts` | `test` 29/29 |
| Testy i raporty | `scripts/check-*.ts`, `scripts/smoke-*.{ts,sh}`, `reports/*` | `test` |
| Licencje | `LICENSES/ascii.rest-MIT.txt`, `THIRD_PARTY_NOTICES.md` | wymóg MIT |

**Czego nie ma (BRAK):** kod przeglądarkowy (cała strona), opcja `speed`, 42 pozostałe sceny P1 (z 72), sceny kolorowe z paletą (P2), wszystkie style obrazkowe i post FX, UI.

---

## 4. Kluczowe fakty techniczne (wszystkie `test`, o ile nie napisano inaczej)

**Sceny i odtwarzanie**
- Scena = moduł z `meta` i domyślnym eksportem `Frame = (t, env?) => string` (`rows` linii po `cols` znaków). Brak `Math.random`, więc sceny są deterministyczne (`kod`).
- **7 z 30 scen jest sekwencyjnych** (doom-fire, reaction-diffusion, flow-field, snowfall, smoke, falling-sand, tesseract): pamiętają ostatni czas, więc skok do dowolnej klatki daje inny obraz. **Zawsze wołać sceny przez `ScenePlayer`, kolejno, bez równoległości.** `ScenePlayer` odtwarza taką scenę od zera przy skoku lub cofnięciu.
- Znak jest ok. 2× wyższy niż szeroki (`meta.cell = 2`). Pominięcie tego daje elipsy zamiast kół.
- Pętle: 9 scen ma dokładną pętlę, 6 ma pętlę z tolerancją, 15 nie ma pętli (domyślny klip 10 s z ostrzeżeniem o szwie).
- Typowe sceny P1 nie mają opcji poza `fps`; opcje wspólne dodaje moduł (plik 03, sekcja 4). **`speed` jest niezaimplementowane**: skaluje czas, więc zmienia długość pętli (pętlę trzeba zablokować lub przeliczyć).

**Rendering**
- Dwie ścieżki: kanwa (PNG) i bufor RGBA (`renderFrameToBuffer`, wideo i GIF), zgodne do ±1 na kanał. Ścieżka buforowa przyjmuje tylko kolory `#rgb` i `#rrggbb`.
- **Przeciek pamięci dotyczy Node** (`@napi-rs/canvas`: `getImageData` zatrzymuje ok. 8 MB na klatkę 1080p). **W przeglądarce nie mierzono**; zmierzyć przed założeniem, że problemu nie ma.
- Glify geometryczne (bloki, ramki) rysowane własnym kodem (`drawGeometric`): 210 z 210 poprawnych w Node; reszta znaków idzie przez czcionkę.
- **Czcionka:** brak pliku w repozytorium (decyzja użytkownika). W przeglądarce stos monospace z CSS, więc piksele zależą od urządzenia. Bitowe wyniki z testów (PSNR 99 dB) dotyczą Node z DejaVu Sans Mono i **nie przenoszą się 1:1**; w przeglądarce testować układ i strukturę, nie piksele.

**Eksport**
- Długość klipu: `resolveClip`: domyślnie rekomendowana pętla, `loop: 'exact'`, `repeat n`, `seconds`; przy fps ≠ fps sceny ostrzega o dryfie pętli.
- **GIF:** limit 10 s (jawne `seconds`/`repeat` > 10 rzuca błąd; domyślna dłuższa pętla jest ucinana z ostrzeżeniem), domyślnie 480×270, bez przezroczystego tła (tło przezroczyste tylko PNG), pętla nieskończona. Opóźnienia GIF to całkowite setne sekundy: używać `exactDelays` (suma = `round(klatki·100/fps)`, bez dryfu pętli, jitter ±1 cs przy 15, 24, 30 fps; fps 20 i 25 są równe). Paleta dokładna, jeśli klip ma ≤ 255 kolorów (sceny testowe: 3–126, więc GIF bez strat). `gif-js.ts` jest większy od ffmpeg 1,1–4,5× (nie przycina klatek do obszaru zmian).
- **MP4 w Node:** ffmpeg (libx264, CRF 18, yuv420p, BT.709, `+faststart`), wymiary parzyste. Donut, pełna pętla 1080p, 3770 klatek: 196 s.
- **MP4 w przeglądarce: BRAK.** Plan (`proj?`): klatka RGBA → `VideoFrame` → `VideoEncoder` (`avc1`, np. High L4.0 dla 1080p) → muxer MP4 (Mediabunny, licencja MPL-2.0 wg npm; `mp4-muxer` jest przestarzały). Wsparcie H.264 Baseline/Main w WebCodecs ponad 99% wg zbioru z 7,66 mln sesji (`docs`; tylko `isConfigSupported`, próba z użytkowników jednej strony, więc może być obciążona). Wtórne źródło sugeruje ograniczenia Firefoksa i Safari (**niepotwierdzone**). WebCodecs nie ma CRF, więc jakość i tagi koloru mogą się różnić od ffmpeg. Przed pokazaniem przycisku MP4: `VideoEncoder.isConfigSupported`; przy braku wsparcia ukryć MP4.

---

## 5. Proponowana kolejność budowy (`proj?`, małe kroki)

Stos: TypeScript + Vite bez frameworka UI to propozycja (sceny nie mają zależności; użytkownik zna HTML, Framer, Figma). Claude Code może zaproponować inny, z uzasadnieniem.

1. **Szkielet strony** i port renderera do przeglądarki (`OffscreenCanvas`, atlas par znak-kolor). Test: układ siatki i glify geometryczne; **bez** porównywania pikseli z Node.
2. **Przeglądarka scen:** lista 30 scen, podgląd w pętli czasu rzeczywistego (limit fps sceny, pauza poza ekranem, `prefers-reduced-motion` pokazuje klatkę 0), pasek do przewijania przez `ScenePlayer`.
3. **Opcje wspólne:** kolor tuszu, tło, rozmiar wyjścia, fps; potem `speed` (z decyzją o pętli).
4. **Eksport:** tekst i PNG, potem GIF (`gif-js.ts`, limit 10 s), na końcu MP4 przez WebCodecs z kontrolą wsparcia.
5. **Reszta P1** (42 sceny), każda z testem determinizmu i dostępu losowego; sceny z `clock` (analog-clock, calendar, digital-clock, landscape, sundial) wymagają opcji `at`.
6. **UI wg zdjęć użytkownika** (zrzuty ascii-magic.com jako kierunek stylistyczny) i dopiero potem polerowanie.
7. Opcjonalnie (po potwierdzeniu zakresu): Faza 1 efektów obrazkowych z pliku 02, sekcja 12.

---

## 6. Testy do powtórzenia w prawdziwej przeglądarce

Nie da się ich zrobić w piaskownicy bez przeglądarki. Raportować wynik każdego.

1. **Determinizm i dostęp losowy** `ScenePlayer`: skok, cofnięcie, powtórzenie, 30 z 30 (logika to czysty JS, ten sam test co w Node).
2. **Renderer:** układ siatki i proporcje komórek (`cell: 2`), glify geometryczne; odczyt pikseli i pamięć przy długim przebiegu (3000 klatek 1080p: pamięć ma być płaska).
3. **GIF:** pobrany plik sprawdzić w Node (`parseGif`): liczba klatek, opóźnienia, pętla; wizualnie w Chrome, Firefox, Safari. **Nie testowano GIF w żadnej przeglądarce ani komunikatorze** (jitter 3/4 cs, przezroczystość międzyklatkowa).
4. **MP4:** `ffprobe` na pobranym pliku (kodek `h264`, `yuv420p`, wymiary, liczba klatek, fps), odtwarzanie w Chrome, Firefox, Safari, pomiar czasu 1080p, porównanie jakości z wersją ffmpeg okiem.
5. **Import `gifenc`:** Node ładuje wersję CommonJS, bundlery ESM; `gif-js.ts` obsługuje oba, ale w bundlerze **niesprawdzone**.
6. Przed wdrożeniem wydzielić `exactDelays` z `gif-parse.ts` (parser używa typu `Buffer`).

---

## 7. Licencje i atrybucja

- Kod scen: MIT, `Copyright (c) 2026 bas3line`. **Zachować** `LICENSES/ascii.rest-MIT.txt` i `THIRD_PARTY_NOTICES.md` oraz nagłówki przejętych plików; dodać w aplikacji podziękowanie i link do ascii.rest (dobra praktyka, nie wymóg).
- Biblioteki: `gifenc` (MIT), Mediabunny (MPL-2.0 wg npm; zmiany w jej plikach wymagałyby ich opublikowania), do sprawdzenia przy dodawaniu: dołączyć ich notki do `THIRD_PARTY_NOTICES.md`.
- H.264: w przeglądarce koduje przeglądarka (nie wbudowujemy x264). CLI z ffmpeg (x264, GPL; patenty H.264) tylko do narzędzi deweloperskich. Nie jestem prawnikiem.
- Nie przejmować logotypów języków, dystrybucji i firm (znaki towarowe).

---

## 8. Otwarte pytania

1. Zakres wersji 1: tylko moduł scen, czy także Faza 1 efektów obrazkowych (sekcja 1 tego pliku).
2. Domyślne wymiary eksportu: letterbox 1080p (MP4) i 480×270 (GIF). Przy 480×270 znaki są małe; czy dodać tryb `cellPx`.
3. Domyślnie ucięte do 10 s GIF-y scen z długą pętlą (9 z 15) będą miały widoczny szew; czy to akceptowalne.
4. Czy ostatecznie dołączać `loopSeconds` do kontraktu sceny (plik 03, sekcja 6) czy zostawić tabelę generowaną.
5. Brief UI: zdjęcia i zrzuty od użytkownika.
