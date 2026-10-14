# Eksport scen ASCII (część 4)

Oznaczenia jak w pliku 03: `kod` = sprawdzone w kodzie, `test` = sprawdzone uruchomieniem, `docs` = dokumentacja lub wiedza ogólna do potwierdzenia, `proj` = nasz projekt, `proj?` = do decyzji lub niepewne.

## 1. Decyzje

- **Formaty:** MP4, GIF, PNG, tekst (jedna klatka). Komponent interaktywny pomijamy na razie.
- **Zakres pierwszej wersji** (zatwierdzony): 30 scen startowych (tylko tryb tekstowy), opcje eksportu to kolor tuszu, tło, rozmiar wyjścia i prędkość. Bez Post FX i Color z pliku 01. Sceny kolorowe (P2) i reszta P1 później.
- Renderer (`src/render.ts`, `src/glyphs.ts`) i pętle (`reports/loops-tol.json`) są gotowe.

## 2. Co robi każdy format

| Format | Wynik | Uwagi |
|---|---|---|
| **PNG** | jedna klatka `k` (domyślnie 0) | tło przezroczyste dozwolone (`background: null`), tylko tu |
| **Tekst** | jedna klatka `k` jako `.txt` (UTF-8, `rows` linii po `cols` znaków) | to dokładnie wynik `ScenePlayer.at(k)`; bez koloru; wygląda dobrze tylko w czcionce o stałej szerokości; wkleisz do terminala, README, komunikatora |
| **MP4** | H.264, `yuv420p`, `+faststart` | wymiary parzyste; kolory w 4:2:0 lekko się rozmywają na krawędziach znaków (`docs`, do oceny okiem) |
| **GIF** | do ok. 480 px szerokości, paleta do 256 kolorów | scena ma tusz na tle, więc paleta jest mała; tło przezroczyste w GIF **nie** w pierwszej wersji (1-bitowa przezroczystość robi obwódkę na antyaliasowanych znakach, `docs`) |

## 3. Opcje eksportu (`proj`)

| Opcja | Domyślnie | Uwaga |
|---|---|---|
| `scene` | wymagana | jedna z 30 |
| `ink`, `background` | `#7CFFB2` / `#0a0a0a` | `background: null` tylko PNG |
| `size` | 1920×1080 (siatka wyśrodkowana, letterbox) | albo `cellPx: N`: rozmiar wyjścia wynika z siatki sceny (np. 40×22 przy `cw`=24 daje 960×1056); `docs` |
| `speed` | 1 | **jeszcze nie zaimplementowane** (`ScenePlayer` nie ma skalowania czasu); mnoży czas sceny; ze zmianą prędkości zmienia się długość pętli, więc przy pętli blokujemy lub przeliczamy |
| `fps` | fps sceny (8–30) | zob. 5 |
| `seconds` | patrz 4 | |
| `k` | 0 | dla PNG i tekstu |

## 4. Długość klipu (`proj`)

Tabela `loopSeconds` pochodzi z `reports/loops-tol.json` (`recommended`, a dla 9 scen z dokładną pętlą także `exactSeconds`).

- **Sceny z pętlą (15):** 9 z dokładną + 6 z tolerancją (synthwave 10 s, donut 125,667 s, torus-knot 125,667 s, tesseract 35,9 s, dna-helix 37,7 s, typewriter 23,15 s). Domyślnie rekomendowane T, opcjonalnie dokładny okres tam, gdzie jest.
- **Sceny bez pętli (15):** brak T. Domyślnie 10 s (`proj?`), z ostrzeżeniem, że przy zapętleniu wideo będzie widoczny skok.
- Liczba klatek wideo = `round(T × fps)`. Dla fps = fps sceny wychodzi całkowita z konstrukcji (`T = k / fps`). Dla innego fps trzeba sprawdzić, czy `T × fps` jest całkowite, a jeśli nie, ostrzec (`kod`: pętle liczone w klatkach sceny).
- Pętla to klatki `[0, T)`; klatka T nie jest renderowana (jest równa klatce 0 z dokładnością z raportu).

## 5. Wymagania techniczne

1. **Kolejność klatek:** tylko rosnąco od 0, bez równoległości (7 scen jest sekwencyjnych, `test`). Dla fps wideo ≠ fps sceny: klatka wideo n bierze klatkę sceny `round(n / fps_wideo × fps_sceny)`, nie malejącą.
2. **Pamięć i odczyt pikseli (`test`):** nowe kanwy w jednym procesie zabijały pamięć (30 scen w jednym procesie: OOM). Jedna kanwa używana wielokrotnie jest stabilna przy samym rysowaniu (3000 klatek 1080p: RSS 138 → 217 MB, bez wzrostu liniowego). Ale **odczyt pikseli z kanwy** do strumienia dla ffmpeg się nie nadaje: `getImageData` i `canvas.data()` zatrzymują ok. 8 MB na klatkę 1080p, RSS rośnie do ok. 2,1 GB po 250 klatkach i proces ginie (`@napi-rs/canvas`, GC tego nie zwalnia). `toBuffer('image/png')` jest stabilne, ale 125 ms na klatkę (9000 klatek to ok. 19 min). **Rozwiązanie (zrobione): ścieżka buforowa** `renderFrameToBuffer`: maski alfa glifów wyciągane z atlasu raz, klatka składana w jednym wielokrotnie używanym buforze RGBA, bez kanwy na klatkę. Zgodność z kanwą ±1 na kanał (30 scen), pamięć płaska (144 MB po 3000 klatek), 6–7 ms na klatkę razem ze sceną. PNG idzie przez kanwę (tam odczyt pikseli nie jest potrzebny), MP4 i GIF przez bufor. Konsekwencja: klatka PNG i klatka wideo mogą różnić się o 1 na kanał na antyaliasowanych krawędziach. Ścieżka buforowa przyjmuje tylko kolory `#rgb` i `#rrggbb`.
3. **Kodowanie:** ffmpeg 6.1.1 z `libx264` i `gif` dostępny w środowisku (`test`). Na maszynie użytkownika potrzebny `ffmpeg` w PATH albo paczka `ffmpeg-static` (zainstalowała się, `test`). Licencje: x264 jest na GPL, H.264 ma patenty przy dystrybucji komercyjnej (`docs`, nie jestem prawnikiem). Ważne, jeśli narzędzie miałoby być rozpowszechniane z wbudowanym kodekiem.
4. **GIF:** opóźnienie klatki to całkowita liczba setnych sekundy (`test`). **Korekta wcześniejszego założenia:** ffmpeg przy 30, 24, 15 i 12 fps rozkłada opóźnienia naprzemiennie (np. 3,4,3,3,4…), więc suma jest dokładna i długość pętli się nie rozjeżdża; zostaje jitter ±1 cs na klatkę. Wyjątek: 8 fps dało 201 cs zamiast 200 (żadna z 30 scen nie ma 8 fps, ale dotyczy dowolnego `--fps`). Dlatego **zamiast zaokrąglać fps** (które zmieniałoby tempo i dobór klatek sceny) zostajemy przy natywnym fps, a opóźnienia nadpisujemy własnym wzorem `round((i+1)·100/fps) − round(i·100/fps)` (`setGifDelays`). Zaokrąglenie do 25/20/10 pozostaje dostępne jako zwykłe `--fps`. Czy jitter jest widoczny w przeglądarkach, nie oceniałem (`proj?`).
5. **Paleta GIF:** `palettegen` + `paletteuse` bez ditheringu (płaskie kolory tusz/tło), **twardy limit 10 s** (decyzja użytkownika, sekcja 12).

## 6. Testy do napisania

1. **PNG** = klatka renderera piksel w piksel (dekodowanie PNG, hash).
2. **Tekst** = `ScenePlayer.at(k)` bajt w bajt.
3. **MP4:** `ffprobe`: liczba klatek, fps, wymiary, czas trwania; zgodność z oczekiwaniem (wynik lossy, więc zgodność pikseli przez PSNR, nie równość).
4. **Powtarzalność:** dwa eksporty tej samej sceny; czy MP4 są identyczne bajtowo (nie wiem, `proj?`; jeśli nie, porównujemy zdekodowane klatki).
5. **Pętla:** zdekodowana klatka ostatnia → pierwsza w granicach progu z raportu pętli (dla scen z rekomendowaną pętlą).
6. **Dym 30 scen:** każda scena 2 s do MP4 i GIF, każda w osobnym procesie; rozmiary plików, czasy.
7. **GIF:** liczba klatek, długość pętli i opóźnienia (sprawdzić nierówność czasów).

## 7. Plan (małe kroki)

1. ✅ `renderFrameInto` + eksport **PNG i tekstu** (zrobione, sekcja 9) oraz ścieżka buforowa dla wideo (zrobione, punkt 5.2).
2. ✅ Tabela długości z `loops-tol.json` + wybór `seconds` (zrobione, sekcja 10).
3. ✅ **MP4** przez potok do ffmpeg (zrobione, sekcja 10).
4. ✅ **GIF** (zrobione, sekcja 12).
5. ✅ Test dymny 30 scen i raport (zrobione, sekcja 12, `reports/SMOKE.md`).
6. Dalej (do decyzji): reszta P1 (72 sceny), `speed`, czcionka w repozytorium, `loopSeconds` jako część kontraktu.

## 8. Do rozstrzygnięcia

Decyzje i wartości domyślne (stan po kroku 5):

1. Limit długości GIF: **10 s, twardy** (decyzja użytkownika). Jawne `seconds`/`repeat` dające więcej rzuca błąd; domyślna pętla dłuższa niż 10 s (dotyczy 9 z 15 scen z pętlą: plasma, mandelbrot, voronoi, donut, tesseract, torus-knot, dna-helix, wave-interference, typewriter) jest ucinana do 10 s z ostrzeżeniem, że szew będzie widoczny. Dla dłuższych klipów służy MP4.
2. Domyślne 10 s dla scen bez pętli: **tak**.
3. Czcionka: **decyzja użytkownika: nie dołączamy pliku czcionki do repozytorium.** Konsekwencja (`proj`): w przeglądarce znaki rysuje czcionka monospace z listy CSS, więc piksele zależą od urządzenia; testy bitowej zgodności (PSNR 99 dB) dotyczą środowiska Node z DejaVu Sans Mono i nie przenoszą się 1:1 na inne maszyny.
4. Tryb rozmiaru: letterbox (domyślnie 1920×1080 dla MP4, **480×270 dla GIF**). Przy 480×270 siatka sceny zajmuje ok. połowę kadru i znaki są małe; `cellPx` dla GIF nie jest przetestowane okiem.
4. Czy eksport MP4 ma mieć opcję dłuższego klipu przez powtórzenie pętli (np. 3 × T) zamiast jednej pętli.

## 9. Wyniki kroku 1 (PNG i tekst, `test`)

Pliki: `src/export-node.ts` (API `exportPng`, `exportText`, `resolveSize`), `scripts/export.ts` (CLI), `scripts/check-export.ts`, `scripts/check-buffer.ts`, `scripts/mem-curve.ts`; wyniki w `reports/export-check.txt` i `reports/buffer-check.txt`.

- **PNG** = klatka renderera piksel w piksel (donut, big-text, synthwave, doom-fire). Przezroczyste tło: narożnik alfa 0, są piksele pełne.
- **Tekst** = `ScenePlayer.at(k)` + `\n` bajt w bajt, kształt rows × cols zgodny z `meta`, dla 30 scen przy k = 0 i k = 7. Opcja `trimEnd` obcina spacje na końcach linii (domyślnie wyłączona, żeby prostokąt został).
- Scena sekwencyjna (doom-fire): eksport klatki 40 z odtwarzacza świeżego równa się przebiegowi kolejnemu.
- Rozmiar: `{width, height}` i `{cellPx: 24}` (donut: 960×1056). Błędne wejście (nieznana scena, k < 0, k niecałkowite, rozmiar 0) rzuca błąd.
- 60 PNG 1080p w jednym procesie przeszło, ale RSS wzrosło do ok. 0,9 GB (kanwy tworzone na nowo nie są zwalniane od razu). Dla pojedynczego eksportu bez znaczenia; **eksport wsadowy powinien używać jednej kanwy**.
- **Czcionka:** wynik zależy od czcionki systemowej (DejaVu Sans Mono). Bez niej `export-node` ostrzega i używa zastępczej, więc piksele będą inne. Do rozważenia: dołączyć plik czcionki do repozytorium (licencja do sprawdzenia, `proj?`).

## 10. Wyniki kroków 2 i 3 (tabela długości i MP4, `test`)

**Pliki:** `scripts/gen-durations.ts` → `src/durations.ts` (generowane z `reports/loops-tol.json`), `src/clip.ts` (`resolveClip`), `src/export-video.ts` (`exportMp4`), CLI `node scripts/export.ts <scena> mp4 [--seconds N | --repeat N] [--loop exact|recommended] [--fps N] [--crf N]`, testy `scripts/check-mp4.ts` (18 sprawdzeń), `scripts/long-mp4.ts`; wyniki w `reports/mp4-check.txt`.

**Wybór długości (`resolveClip`):** domyślnie rekomendowana pętla (cube 144 klatki = 6 s, synthwave 200 = 10 s, donut 3770 = 125,667 s); `loop: 'exact'` bierze dokładny okres (cube 432 klatki = 18 s); `repeat: n` powtarza pętlę; `seconds` ma pierwszeństwo, a jeśli nie jest wielokrotnością okresu, ostrzega, że szew będzie widoczny. Scena bez pętli dostaje 10 s z ostrzeżeniem. Przy fps wideo ≠ fps sceny ostrzega o rozjechaniu pętli (big-text przy 30 fps: 96,24 klatki → 96, dryf 0,24 klatki). Błędy: `repeat` bez pętli, `seconds` razem z `repeat`, nieznana scena.

**MP4 (`exportMp4`):**
- Potok: bufor RGBA → ffmpeg `libx264` (CRF 18, preset medium), `yuv420p`, macierz BT.709, zakres `tv`, tagi koloru, `+faststart`, `bitexact`. Każdy bufor jest używany ponownie dopiero po potwierdzeniu zapisu (`write` nie kopiuje).
- Zapis do `.part`, potem zmiana nazwy. Po błędzie nie zostają pliki. Brak ffmpeg daje czytelny komunikat (można podać ścieżkę w `ffmpeg` lub `FFMPEG_PATH`).
- Struktura: 7 wariantów (cube, glitch, donut, doom-fire, tv-static, big-text przy 30 fps, cube ×2) ma oczekiwaną liczbę klatek, fps, wymiary, kodek, `bt709/tv`.
- Dokładność: zdekodowana klatka vs renderer, PSNR 43,2 / 43,7 dB (cube), 35,2 dB (doom-fire, sekwencyjna), 50,1 dB (glitch).
- Mapowanie klatek przy innym fps: donut 30 → 20 fps, klatka wideo 10 odpowiada klatce sceny 15 (PSNR 35,6 dB wobec 22–24 dB dla k = 13, 14, 16, 17). Pierwszy wariant tego testu (big-text) nic nie dowodził, bo jego sąsiednie klatki są prawie identyczne, więc go zastąpiłem.
- Powtarzalność: dwa eksporty cube dały identyczny plik bajt w bajt (**na tej maszynie i tej wersji ffmpeg 6.1.1**).
- Długi klip: donut, pełna pętla 1080p, 3770 klatek: 196 s (ok. 19 klatek/s, limitem jest x264), RSS procesu Node płaskie 142–144 MB, plik 28,0 MB, `ffprobe` 3770 klatek i 125,667 s. Rozstrzyga to obawę o 9000 klatek.
- Ocena okiem (jeden zrzut, cienkie znaki donut, zbliżenie 4×): brzegi lekko miękkie, bez widocznej kolorowej obwódki. Nie oceniałem odtwarzania w różnych odtwarzaczach.

**Ograniczenia:** `speed` nie jest zaimplementowane; ścieżka buforowa przyjmuje tylko kolory `#rgb`/`#rrggbb`; rozmiar musi być parzysty; bez przezroczystości; powtarzalność bajtowa tylko w tym środowisku; przy 60 klatkach/s lub innych fps nie testowano.

## 12. Wyniki kroków 4 i 5 (GIF i test dymny, `test`)

**Pliki:** `src/export-gif.ts` (`exportGif`), `src/gif-parse.ts` (własny parser GIF: klatki, opóźnienia, pętla, palety; `exactDelays`, `setGifDelays`), CLI `node scripts/export.ts <scena> gif [--seconds N | --repeat N] [--loop exact|recommended] [--fps N] [--colors N] [--size WxH]`, testy `scripts/check-gif.ts` (51 sprawdzeń, `reports/gif-check.txt`), `scripts/pil-decode.py`, `scripts/long-gif.ts`, test dymny `scripts/smoke-one.ts` + `scripts/smoke-all.sh` (`reports/SMOKE.md`).

**Potok:** dwa przebiegi po tych samych deterministycznych klatkach (świeży `ScenePlayer` w każdym, ścieżka buforowa, bez kanwy na klatkę): (1) `palettegen` (jedna paleta globalna, `stats_mode=full`, bez zarezerwowanej przezroczystości) → PNG z paletą, (2) `paletteuse` bez ditheringu i bez `diff_mode`, pętla nieskończona, `bitexact`. Potem nadpisanie opóźnień. Dwa przebiegi zamiast jednego (`split`+`palettegen`) trzymają pamięć płaską niezależnie od długości klipu. Zapis do `.part`, potem zmiana nazwy. Domyślny rozmiar 480×270, rozmiar nieparzysty dozwolony.

**Wyniki testów GIF (51 z 51):**
- Struktura dla 8 wariantów (cube, glitch, synthwave, big-text, tv-static, donut, doom-fire, big-text przy 25 fps): liczba klatek, wymiary, pętla nieskończona, paleta globalna.
- **Opóźnienia:** suma = `round(klatki·100/fps)` we wszystkich przypadkach (cube 600 cs = 6,00 s, glitch 700, synthwave 1000, big-text 321 przy 3,208 s). Fps 20 i 25 dają opóźnienia równe (5 cs, 4 cs). Fps 15, 24 i 30 dają dwie wartości różniące się o 1 cs (15 fps: 6/7, 24 fps: 4/5, 30 fps: 3/4). `exactDelays` daje dokładną sumę także dla 8, 7 i 14,5 fps.
- **Dokładność pikseli:** zdekodowane klatki GIF są **bitowo zgodne z rendererem** (PSNR 99 dB, wszystkie klatki cube, doom-fire, donut). Wynika to z konstrukcji: scena to jeden tusz mieszany z tłem, w testowanych scenach 67–196 unikalnych kolorów, czyli mieści się w 256. Dwa niezależne dekodery (ffmpeg i Pillow) dają identyczne klatki, więc przezroczystość międzyklatkowa (143 z 144 klatek cube ma flagę przezroczystości) jest dekodowana poprawnie. **Nie testowano przeglądarek.**
- Mapowanie klatek przy innym fps: donut 30 → 20 fps, klatka GIF 10 = klatka sceny 15 (PSNR 99 dB wobec 22–25 dB dla sąsiednich).
- `maxColors`: donut przy 8 kolorach daje dokładnie 8 kolorów. Tablica palety w pliku zawsze ma 256 wpisów (ffmpeg dopełnia do potęgi dwójki), więc liczbę użytych kolorów trzeba liczyć z dekodowanych klatek.
- Powtarzalność: dwa eksporty cube identyczne bajt w bajt (**ta maszyna, ffmpeg 6.1.1**); to samo dla wszystkich 30 scen w teście dymnym.
- Błędy: tło przezroczyste, `maxColors` poza 2–256, kolor spoza `#hex`, nieznana scena, brak ffmpeg (czytelny komunikat). Po błędach brak plików i `.part`.
- **Limit 10 s:** jawne `seconds`/`repeat` > 10 s rzuca błąd, domyślna pętla > 10 s jest ucinana (donut: 300 klatek, 632 KB), 10 s dokładnie przechodzi, pętla 10 s (synthwave) nie jest ucinana. Testy GIF: 51 z 51.
- Ostrzeżenia: dryf pętli przy zmienionym fps (big-text 24 → 25 fps: 80,2 klatki), fps > 50.
- **Flagi gif:** domyślne `offsetting+transdiff` dają pliki 2–5× mniejsze niż wyłączone (donut 60 klatek: 127 KB vs 303 KB; cube: 27 KB vs 133 KB; tv-static: 207 KB vs 276 KB). Zostawiamy domyślne.
- Długi klip (zmierzone przed wprowadzeniem limitu 10 s, `scripts/long-gif.ts` z 15 s już rzuca błąd): donut 15 s (450 klatek) 2,2 s, 0,90 MB, szczytowe RSS Node 138 MB; tv-static 15 s 0,67 MB, 139 MB.

**Test dymny (30 scen × 2 s, każda w osobnym procesie): 30 z 30 bez problemów.** MP4 1080p: h264, yuv420p, poprawne klatki i fps. GIF: poprawne klatki, suma opóźnień, pętla, powtarzalność. Maksima: MP4 2030 KB (tunnel), GIF 215 KB, RSS Node 183 MB. Szczegóły w `reports/SMOKE.md`. Sceny z niewieloma różnymi klatkami w 2 s (cube, typewriter, glitch, wave-text, big-text, scramble) to cecha scen.

**Ograniczenia:** brak testu odtwarzania w przeglądarkach i komunikatorach (jitter 3/4 cs, przezroczystość różnicowa); GIF bez przezroczystego tła; dryf pętli przy fps ≠ fps sceny (ostrzega, nie naprawia); powtarzalność bajtowa tylko w tym środowisku; wartości czasu z piaskownicy są orientacyjne; test dymny dotyczy klipów 2 s, a nie pełnych pętli.

## 13. Eksport w przeglądarce (decyzja i wyniki, `test` / `docs` / `proj?`)

**Decyzja (użytkownik nie rozstrzyga tego technicznie, więc proponuję):** strona działa w przeglądarce, więc ffmpeg z Node (kroki 1–5) zostaje jako **narzędzie CLI i wzorzec do testów**, a eksport na stronie idzie własną ścieżką bez serwera.

| Format | Ścieżka w przeglądarce | Status |
|---|---|---|
| PNG | `OffscreenCanvas.convertToBlob` (renderer jest niezależny od implementacji kanwy, `src/render.ts`) | `proj`, port nieprzetestowany |
| Tekst | `ScenePlayer.at(k)` (czysty JS) | `proj`, wynik niezależny od przeglądarki |
| **GIF** | `src/gif-js.ts`: enkoder bez zależności od Node, `gifenc` (MIT) | **`test`: 29 z 29** (poniżej) |
| **MP4** | WebCodecs `VideoEncoder` (H.264) + muxer MP4 (Mediabunny, licencja MPL-2.0 wg npm; `mp4-muxer` jest oznaczony jako przestarzały) | **nieprzetestowane** (w piaskownicy brak przeglądarki), tylko plan |

**GIF w JS (`src/gif-js.ts`, `scripts/check-gif-js.ts`, `reports/gif-js-check.txt`):**
- Enkoder woła funkcję klatki dwa razy (przebieg 1: paleta, przebieg 2: kodowanie), więc pamięć jest płaska, a wynik deterministyczny.
- Paleta jest **dokładna**, jeśli klip ma do 255 kolorów (sceny testowe: 3–126), więc GIF jest **bez strat**: min PSNR 99 dB na wszystkich klatkach w 6 scenach (cube, glitch, doom-fire, donut, tv-static, big-text przy 25 fps). ffmpeg i Pillow dekodują go identycznie. Gdy kolorów jest więcej, używany jest kwantyzator `gifenc` (donut przy limicie 16: 15 kolorów, średni PSNR 49,2 dB).
- Opóźnienia: `gifenc` zapisuje `round(ms/10)` cs, więc przekazujemy `cs·10` i dostajemy dokładne wartości z `exactDelays` (suma = `round(n·100/fps)`).
- Przezroczystość międzyklatkowa (niezmienione piksele = zarezerwowany indeks, dispose 1) jest zaimplementowana własnym kodem.
- **Rozmiar:** 1,1–4,5× większy od ffmpeg (cube 115 KB vs 37 KB, big-text 55 KB vs 12 KB, donut 144 vs 124 KB), bo `gifenc` zapisuje całą klatkę, a ffmpeg przycina ją do obszaru zmian. Przy limicie 10 s to nadal setki KB. Możliwa poprawa: własny zapis przyciętych klatek (`proj?`).
- Czas (Node, orientacyjnie): 144 klatki 480×270 w 0,9 s razem z dwukrotnym renderem sceny.
- Import `gifenc`: Node ładuje wersję CommonJS (nazwane eksporty w `.default`), bundlery wersję ESM; moduł obsługuje oba przypadki. W przeglądarce niesprawdzone.
- `gif-js.ts` nie importuje niczego z Node. Importuje `exactDelays` z `gif-parse.ts`, który używa typu `Buffer` tylko w parserze (do testów); przed wdrożeniem w przeglądarce warto wydzielić `exactDelays` do osobnego pliku.

**MP4 w przeglądarce, co wiemy a czego nie:**
- `docs` (zbiór „Codec Support Dataset”, 7,66 mln sesji, `isConfigSupported()`, próba z użytkowników jednej strony do upscalingu wideo, więc może być obciążona): H.264 Baseline/Main ma ponad 99% wsparcia enkodera we wszystkich przeglądarkach i platformach. To test deklarowanego wsparcia, nie jakości ani szybkości.
- `docs` (wtórne, README narzędzia, nieautorytatywne): Firefox i Safari mają ograniczenia w enkodowaniu; nie potwierdziłem tego w źródle pierwotnym.
- `proj?`: klatka RGBA z naszego bufora → `new VideoFrame(...)` → `VideoEncoder` (`avc1`, np. High L4.0 dla 1080p) → muxer. Wymiary parzyste. WebCodecs nie ma CRF, więc sterujemy bitrate; jakość i tagi BT.709 mogą się różnić od ffmpeg (nie sprawdzone). Przed pokazaniem przycisku MP4 test `VideoEncoder.isConfigSupported`, a przy braku wsparcia ukrycie MP4 i pozostawienie GIF, PNG i tekstu.
- Licencje: H.264 przy WebCodecs koduje przeglądarka (nie wbudowujemy x264), więc problem GPL/patentów z sekcji 5.3 dotyczy tylko CLI z ffmpeg. Nie jestem prawnikiem.
- **Do zrobienia przez Claude Code w prawdziwej przeglądarce (nie da się tu):** test eksportu MP4 w Chrome, Firefox i Safari, porównanie jakości z ffmpeg okiem, pomiar czasu 1080p.
