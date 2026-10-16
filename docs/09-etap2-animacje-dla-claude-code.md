# Etap 2: animacje efektów i eksport GIF, MP4, SVG, TS (brief dla Claude Code)

Stan na 16 X 2026. **Zastępuje wcześniejszy plan etapu 2 (sceny ASCII).** Zakres zatwierdził użytkownik w rozmowie 15–16 X. W sprawach etapu 2 ten plik ma pierwszeństwo przed `00-brief-dla-claude-code.md` (sekcja 1 i 9 tam) i przed `05-ui-dla-claude-code.md` (zakładka Animation wyszarzona, sekcja 8.5).

Oznaczenia jak w pozostałych plikach: `test`, `kod`, `docs`, `proj`, `proj?` (propozycja do potwierdzenia), `BRAK` (nie sprawdzone). **Dwie rzeczy w tym pliku to moje domysły, nie wiedza o kodzie:** (a) sposób działania glintu, scanu i stylu Logo na ascii.rest (znam tylko opis ze strony), (b) koszt animowania ciężkich efektów (liczby z pliku 06 są sprzed optymalizacji i z piaskownicy).

---

## 0. Co się zmieniło

- **Odpadają animowane sceny ASCII** (pliki 03 i 04 jako moduł, `/scenes`, `ScenePlayer`, 30 scen). Użytkownik: sceny nie mają zastosowania poza podglądem. Archiwum `ascii-scenes-szkielet-v8.zip` **nie wchodzi do repo**.
- **Z plików 03 i 04 zostają trzy rzeczy:** (1) kontrakt sceny, plik 03 sekcja 2 (potrzebny do eksportu TS, patrz 6.4); (2) licencja MIT i notki, plik 03 sekcja 5; (3) wnioski o GIF i MP4: plik 04 sekcje 2 i 5 (opóźnienie klatki GIF w setnych sekundy, parzyste wymiary, BT.709, `+faststart`).
- **Nowy zakres:** wybrane efekty obrazkowe dostają animację. Użytkownik wczytuje własne zdjęcie, edytuje, pobiera **GIF i MP4**. Efekty z rodziny ASCII mają dodatkowo eksport **SVG** (animowany) i **TS** (plik w formacie biblioteki ascii.rest). Osobna karta **Logo** przenosi narzędzie „image to ascii” z ascii.rest (patrz 7).
- Pozostaje bez zmian: wideo jako wejście (BRAK w tym etapie), tryb generatywny AI, konta, komponent do osadzania, 1–2× skala PNG z etapu 1.

---

## 1. Stan wyjściowy (raport użytkownika z 15 X, nie weryfikowany przeze mnie)

Repozytorium `WojtaSix9/ASCII-Art-Effects`, gałąź `claude/happy-bell-5qulv1`, commit `59bbcbc`. Struktura: `engine/` (czysty TS na buforach RGBA), `app/` (Vite + TS, silnik w Web Workerze z `OffscreenCanvas`), `docs/`. Wg raportu: 91 z 91 efektów gotowych, 308 testów silnika, zgodność przeglądarka = Node 106/106 (bez efektów rysujących czcionką), `hash-baseline` 436 przypadków, PNG/JPG @1x/@2x.

**Krok 0 (przed jakąkolwiek zmianą):**
1. `cd engine && npm ci && node scripts/check-engine.ts`; policz `ready` w `effects.json`. Pełny przebieg testów edytora, smoke i a11y (po partiach 10–13 nie robiono) i zapisz wynik jako **punkt odniesienia**.
2. Zaraportuj, czego raport z etapu 1 nie sprawdzał, a etap 2 na tym stoi: Safari, Firefox, telefony, wydajność na żywo w przeglądarce.
3. Pracuj na **osobnej gałęzi** (np. `etap2-animacje`). Przed wdrożeniem na Vercel zapytaj użytkownika o Deployment Protection i auto-deploy (raport: niedziałający).

---

## 2. Efekty animowane (`proj?`, lista zatwierdzona przez użytkownika, szczegóły ruchu do dopracowania)

Razem **25 efektów**. Wszystkie dostają `animated: true` w `effects.json`. Ruch ma być **okresowy** (patrz 3), żeby GIF i MP4 zapętlały się bez szwu.

### 2.1 Rodzina ASCII: glint i scan z ascii.rest (9 efektów)
Characters, Braille, Block, Dots, Mixed, Cross, Diamond, Lines, Diagonal. Dwa presety ruchu przeniesione z ascii.rest: **glint** (błysk przesuwający się po obrazie) i **scan** (linia skanu biegnąca w dół), powtarzane co `every` sekund (`docs`, opis ze strony; sposób działania `BRAK`, do odczytu z kodu, patrz 7.5). Tylko ta rodzina ma eksport SVG i TS (6.3, 6.4).

### 2.2 Własny ruch (16 efektów)

| Efekt | Ruch (propozycja) | Uwagi i ryzyka |
|---|---|---|
| Dither | płynąca macierz (8 kierunków) i shimmer (plik 01, sekcja 9) | **Tylko algorytmy uporządkowane** (Bayer, halftone, radial, linie). Dyfuzja błędu (Floyd, Atkinson, Stucki, Sierra Lite) „gotuje się” w ruchu: w panelu animacji wyłączyć i ostrzec |
| LED Matrix | pulsowanie, przemiatanie światła | bloom może być kosztowny |
| Halftone | obrót kąta rastra o pełny okres wzoru | okres: 90° (kropki, kwadraty), 180° (linie), inaczej pętla ma szew. Wg pliku 06 najwolniejszy efekt (636 ms, stan sprzed optymalizacji) |
| Digital Distortion (Glitch) | przesuwane paski, RGB, bloki | szum losowy zwiększa rozmiar GIF; pętla z N ziaren cyklicznie |
| RGB Split | oscylacja offsetu wzdłuż kąta | prosty |
| Scanline | `roll` (przesuwanie linii) | prosty |
| CRT Screen | migotanie, pas odświeżania | umiarkowany |
| Pixel Art | oddychanie rozmiaru bloku | skwantowane kroki: może skakać, nie płynąć. Ocenić okiem |
| Twirl | oscylacja `amount` | prosty |
| Ripple | fala koncentryczna od środka (faza) | **etykiety Ripple i ZigZag zamienione względem kluczy** (plik 01): ZigZag ma klucz `ripple`, Ripple ma `zigzag`. Sprawdź w silniku i nazywaj po zachowaniu |
| ZigZag | przesuwanie fazy fali | jw. |
| Disco | cykl kolorów lub palety | prosty |
| Waves | faza fal | umiarkowany |
| Risograph | dryf niewspółosiowości warstw plus ziarno | ziarno losowe: cykl N ziaren, wpływa na rozmiar GIF |
| Engraving | wolny obrót kąta linii lub falowanie grubości | **największe ryzyko**: GEOM, złożoność L w pliku 02, koszt klatki `BRAK`. Zmierz przed zobowiązaniem; jeśli klatka przekracza budżet (poniżej), wypadnie z listy, a użytkownika trzeba o tym poinformować |
| Fluted Glass | przesuwanie wzoru żłobków lub oscylacja refrakcji | prosty |

**Kolejność (`proj?`):** Tier A (prosty ruch, tani): ASCII family, RGB Split, Scanline, Twirl, Ripple, ZigZag, Fluted Glass, Disco, Pixel Art. Tier B: Dither, LED Matrix, Halftone, Glitch, CRT, Waves, Risograph. Tier C: Engraving. Po każdym Tierze raport, zanim ruszysz następny.

**Budżet czasu klatki (`proj?`):** eksport animacji liczy się offline, więc nie musi mieścić się w 100 ms, ale 240 klatek (10 s w 24 fps) po 500 ms to 2 minuty. Zmierz w przeglądarce i zaproponuj limit rozdzielczości eksportu animacji (domyślnie np. 1080 px dłuższego boku; zdjęcia 4000 px nie renderować w pełnej rozdzielczości). Pasek postępu i anulowanie obowiązkowe.

---

## 3. Model animacji w silniku

- **Czas jako faza** `phase ∈ [0, 1)`, nie sekundy: `render(src, opts, { scale, glyphs, phase })`. Czas w sekundach przelicza eksport (`loopSeconds`).
- **`phase` brak lub 0 = dzisiejszy wynik statyczny, bit w bit.** Hash-baseline (436 przypadków) **musi dalej przechodzić** bez zmiany. To główny test regresji tego etapu.
- **Ruch okresowy z konstrukcji:** klatka w `phase = 1` równa się klatce w `phase = 0` (z tolerancją zapisaną po pomiarze). Dla efektów z losowością: ziarno wybierane z cyklu N wartości, a nie z czasu.
- **Determinizm:** ta sama `phase` i parametry dają ten sam obraz (jak dziś). Brak stanu między klatkami (żadnych efektów `STATE` w tej liście, więc eksport może renderować klatki w dowolnej kolejności i równolegle).
- **Rejestr:** pola `animated` i `motions: [{ id, name, params: ParamDef[] }]` w `effects.json`. Parametry ruchu (typ, `speed`, `intensity`, `loopSeconds`, `every`) czytane przez UI z `params`, tak jak parametry stylu.
- **Testy własności per efekt (nie tylko „uruchamia się”):** okresowość, zgodność z hashem statycznym przy `phase = 0`, determinizm, brak wyjścia poza zakres, skala eksportu (liczba komórek jak przy 1×). Progów nie dobieraj, żeby przechodziły; zapisz, jak je wyznaczono.

---

## 4. UI (decyzje użytkownika)

1. **Badge „Animation”** na kafelku efektu (strona główna, `/effects`, lewy panel edytora).
2. **Filtr „Animation”** pokazujący tylko efekty animowane (`/effects` i lewy panel edytora; strona główna `proj?`).
3. **Zakładka Animation** (dziś wyszarzona) aktywna dla efektów z `animated: true`, nieaktywna dla pozostałych. Zawartość `proj?`: wybór ruchu, `speed`, `intensity`, `loopSeconds`, `fps`, odtwarzanie i pauza w pętli na kanwie, podgląd działa w Workerze.
4. **Eksport:** PNG zostaje; dla efektów animowanych dochodzą GIF i MP4, a dla rodziny ASCII SVG i TS (z ostrzeżeniami z sekcji 6). Limit kanwy i zgodność z podglądem jak w etapie 1.
5. **Karta Logo** (sekcja 7): osobny tryb w edytorze obok „Style”, bo ma inne wejście (logo z przezroczystym tłem, SVG) i inne ustawienia. Układ `proj?`, do uzgodnienia z użytkownikiem przed budową.
6. Pytanie otwarte: animowane podglądy kafelków (np. odtwarzanie na hover). **Nie robić bez zgody**; badge i filtr to zatwierdzony zakres.

---

## 5. Czego nie obiecywać

- Efekty spoza listy z sekcji 2 nie dostają animacji.
- SVG i TS **nie dotyczą efektów pikselowych** (Dither, Halftone, Glitch, CRT, Risograph, Engraving, szkło, zniekształcenia, Disco, Pixel Art, LED Matrix, Waves): nie mają siatki znaków, więc nie ma czego zapisać jako tekst. Dla nich tylko GIF i MP4.
- Szum losowy (Glitch, Risograph, ziarno) powiększa GIF; ostrzeż użytkownika o rozmiarze przed eksportem.

---

## 6. Eksport

### 6.1 GIF (`gifenc` albo odpowiednik, `proj?`, sprawdź w przeglądarce)
- Opóźnienie klatki to całkowita liczba setnych sekundy: 24 i 30 fps dają nierówne czasy (4,17 cs, 3,33 cs) i pętla się rozjeżdża (`docs`, plik 04 sekcja 5.4, **nie zweryfikowane odtwarzaniem**). Propozycja: dla GIF fps z całkowitym opóźnieniem (25, 20, 10, 50) z przeliczeniem długości pętli. Sprawdź w kilku przeglądarkach.
- Paleta do 256 kolorów: dla zdjęć z gradientami powstają pasma. Zaprojektuj kwantyzację (`proj?`, np. jedna paleta globalna z całej pętli) i oceń okiem. Limit długości i rozmiaru z ostrzeżeniem (propozycja: ostrzeżenie powyżej 10 s i ok. 20 MB).

### 6.2 MP4: główne ryzyko etapu (`BRAK`)
- W przeglądarce nie ma procesu `ffmpeg`. Kandydat: **WebCodecs `VideoEncoder`** (H.264) i muxer MP4 z npm. Nie zakładam konkretnej biblioteki ani wersji: **sprawdź** aktualny stan (`npm view`), licencję, wsparcie w Chrome, Safari i Firefox oraz `VideoEncoder.isConfigSupported` dla `avc1` w naszych wymiarach.
- Wymiary parzyste (4:2:0), BT.709, zakres tv, `+faststart` (lekcje z prototypu, plik 04 sekcja 10).
- Bez wsparcia H.264: czytelny komunikat; fallback (WebM/VP9) tylko za zgodą użytkownika. `ffmpeg.wasm` nie proponuj bez raportu o rozmiarze i licencji (GPL przy x264).
- Pamięć: przeciek z prototypu dotyczył `@napi-rs/canvas` w Node. W przeglądarce **niemierzony**; zmierz heap przy 300 klatkach 1080p.
- **Raport z badania wykonalności przed implementacją** (jak w poprzednim briefie).

### 6.3 SVG (rodzina ASCII)
- ascii.rest oferuje dwa animowane SVG (jasny i ciemny), jedna pętla glintu lub scanu, działające w README bez skryptu (`docs`). U nas: tekst komórek jako `<text>` z kolorami, animacja CSS/SMIL (wybór techniki `proj?`, sprawdź, co działa w GitHub README i w przeglądarkach).
- **Rozmiar pliku rośnie z liczbą komórek.** Siatka z naszego silnika bywa dużo większa niż limit biblioteki (ascii.rest: do 80 kolumn, do 32 wierszy). Zaproponuj limit eksportu SVG i ostrzeżenie; zmierz rozmiar.
- Czcionka w SVG: wynik zależy od czcionki systemowej czytelnika. Użytkownik zgodził się na webfont z npm; w SVG osadzanie czcionki powiększa plik. Opisz kompromis w raporcie.

### 6.4 TS (rodzina ASCII)
- Plik w formacie biblioteki ascii.rest („piece”): moduł TypeScript z `meta` i funkcją klatki (`(t, env?) => string`). **Kontrakt: plik 03, sekcja 2**, ale ten opis pochodzi z commita `2572c26` (8 X), a strona ascii.rest jest nowsza (np. 34 sceny zamiast 15). **Przed implementacją odczytaj aktualny format** z `bas3line/ascii` (patrz 7.5).
- Ograniczenia formatu (`kod`, plik 03): paleta do 64 kolorów `#rrggbb`, indeksy kolorów w `env.color`. Zdjęcie trzeba skwantować do 64 kolorów: to stratne, ostrzeż użytkownika.

---

## 7. Karta Logo (przeniesienie „image to ascii” z ascii.rest/make)

### 7.1 Co robi narzędzie (`docs`, ze strony ascii.rest/make, 16 X; kodu nie czytałem)
- Wejście: SVG, PNG, JPG, WebP, GIF (przeciągnięcie, wybór pliku, wklejenie). Wszystko lokalnie, plik nie jest wysyłany.
- Dwa style rysunku: **logo** (każda komórka to znak, którego kształt najlepiej pasuje do krawędzi w tym miejscu) i **shade** (znak dobrany do jasności, od `.` do `@`; obraz bez gładkiego tła startuje w shade). Gładkie tło jest pomijane. Kolory z obrazu.
- Ruch: **glint** (domyślnie dla firm i języków) i **scan** (domyślnie dla dystrybucji), powtarzany co `every` s. Kategoria wybiera domyślny ruch.
- Ustawienia: nazwa, szerokość (maks. kolumn), styl, ruch, `every`, kategoria. Wysoki obraz zajmuje mniej kolumn (limit 32 wierszy w formacie biblioteki).
- Wyjścia: osadzenie na stronie, dwa animowane SVG, `logo.ts`.

### 7.2 Co przenosimy
Wejścia, style logo i shade, ruchy glint i scan, ustawienia, wyjścia **GIF, MP4, SVG i TS** (osadzenia na stronie nie robimy, użytkownik o nie nie prosił). Limity biblioteki (80 kolumn, 32 wiersze) są wymaganiem formatu `piece`, nie naszego narzędzia: GIF i MP4 mogą korzystać z większej siatki (`proj?`).

### 7.3 Styl „shade” a Characters
Shade to w praktyce nasz Characters. Nie duplikuj: karta Logo może wołać ten sam silnik. Styl **logo** (dopasowanie znaku do kształtu krawędzi) to nowy algorytm, którego silnik nie ma; potraktuj go jako osobny tryb silnika z testami własności.

### 7.4 Znaki towarowe
Do testów i przykładów używaj własnych obrazów (logo ASCII Art Effects, własne SVG). **Nie dołączaj do repo logotypów firm, języków ani dystrybucji** (znaki towarowe; w plikach 03 i 05 już wykluczone).

### 7.5 Wymagana zgoda i odczyt kodu
Dokładny sposób działania glintu, scanu i stylu logo oraz aktualny format `piece` jest w kodzie `github.com/bas3line/ascii` (MIT, `Copyright (c) 2026 bas3line`). **Użytkownik zgodził się na przeniesienie funkcji; odczyt kodu z tego repozytorium wymaga jego jawnej zgody**, którą zawiera prompt startowy. Jeśli środowisko blokuje GitHub, poproś użytkownika o archiwum, **nie odtwarzaj kodu z opisów**. Zachowaj nagłówki plików, `LICENSES/ascii.rest-MIT.txt` i `THIRD_PARTY_NOTICES.md`. Glint i scan to proste efekty: **preferuj własną implementację** według zachowania z kodu; przejmuj kod 1:1 tylko tam, gdzie to konieczne (styl logo, format `piece`).

---

## 8. Kolejność prac (małe kroki, po każdym raport: co zrobiono, co i jak przetestowano, czego nie sprawdzono)

1. **Krok 0:** weryfikacja stanu (sekcja 1), punkt odniesienia testów. *Odbiór:* raport.
2. **Model animacji:** `phase`, rejestr (`animated`, `motions`), testy okresowości i zgodności z hashem statycznym; **jeden** efekt (RGB Split) end-to-end w silniku i na kanwie. *Odbiór:* 436 hashy dalej przechodzi; test okresowości.
3. **UI:** badge, filtr, aktywna zakładka Animation, odtwarzacz w Workerze dla jednego efektu.
4. **GIF** dla tego efektu, potem **badanie wykonalności MP4 i raport** (6.2), potem MP4.
5. **Tier A**, raport. 6. **Rodzina ASCII: glint i scan**, potem SVG i TS (po odczycie formatu, 7.5). 7. **Tier B**, raport. 8. **Karta Logo.** 9. **Tier C** (Engraving) po pomiarze kosztu. 10. Test dymny wszystkich 25 efektów w przeglądarce (GIF i MP4, rozmiary i czasy), Safari i Firefox.

---

## 9. Zasady pracy

Jak w briefie 00, sekcja 5: jeden etap naraz, oznaczanie źródeł, sceptycyzm, raportowanie testów, które zawiodły, i błędów we własnych testach. Nie rozszerzaj zakresu bez pytania. Progów tolerancji nie dobieraj tak, by test przechodził, bez zapisania, jak je wyznaczono.

## 10. Pytania do użytkownika (zadawaj przed krokiem, którego dotyczą)

1. **Krok 2:** czy ruch podglądu ma się zapętlać w nieskończoność, czy zatrzymywać po jednej pętli?
2. **Krok 4:** limit rozdzielczości i długości animacji w eksporcie; zasady fps dla GIF; fallback, gdy przeglądarka nie koduje H.264.
3. **Krok 6:** limit rozmiaru siatki dla SVG i TS; sposób osadzenia czcionki w SVG.
4. **Krok 8:** układ karty Logo (osobna karta w edytorze czy osobna trasa), domyślna szerokość.
5. **Krok 9:** co zrobić z Engravingiem, jeśli klatka okaże się za droga.
6. Animowane podglądy kafelków: tak czy nie (sekcja 4, punkt 6).
