# UI: ASCII Art Effects (wersja 1)

**Stan silnika: patrz 06; sekcja 1 i krok 3 w sekcji 11 są nieaktualne.**

Stan na 13 X 2026. Uzupełnia `00-brief-dla-claude-code.md` i **zmienia jego zakres** (sekcja 1 poniżej). Dane wizualne pochodzą z 4 zrzutów ascii-magic.com dostarczonych przez użytkownika (pełna strona, hero, sekcja stylów, edytor).

Oznaczenia: `pomiar` = wartość odczytana z pikseli zrzutu, `zrzut` = widoczne na zrzucie, bez pomiaru, `proj` = nasza decyzja, `proj?` = propozycja do potwierdzenia, `BRAK` = nie ma na zrzutach, trzeba zdecydować lub zmierzyć w przeglądarce.

**Uwaga do pomiarów:** kolory tekstu to najjaśniejszy piksel w obszarze (percentyl 99,5), więc przez antyaliasing są to dolne oszacowania. Rozmiary w px dotyczą zrzutów o szerokości 1474–1894 px; skala zrzutów względem rzeczywistego okna przeglądarki nie jest mi znana, więc traktować je jako proporcje, a nie gotowe wartości.

---

## 1. Zmiana zakresu względem briefu 00

Decyzja użytkownika (13 X 2026, potwierdzona):

- **Wersja 1 = efekty obrazkowe:** wczytanie zdjęcia, wybór efektu, parametry, pobranie **PNG**.
- **Wersja 2 = animacje:** moduł animowanych scen (prototyp w Node jest gotowy: 30 scen, ScenePlayer, GIF do 10 s, MP4) i pobieranie wideo/GIF.
- Narzędzie jest darmowe i do własnego użytku: **bez sekcji promocyjnych i opisowych** (cennik, opinie, FAQ, blog, changelog, Go Pro, logowanie, odznaki PRO, tryb generatywny AI, Flow).
- Nazwa: **ASCII Art Effects** (własne logo, nie iskra z ascii-magic).

Konsekwencja: sekcje 1, 5 i 6 briefu 00 są w części nieaktualne. Kod z `ascii-scenes-szkielet-v8.zip` nie jest potrzebny w wersji 1 (zostaje na wersję 2). **Silnik efektów obrazkowych nie ma jeszcze żadnego kodu**; specyfikacja jest w plikach 01 i 02 (zakres Fazy 1: plik 02, sekcja 12).

---

## 2. Tokeny wizualne

### 2.1 Strona (hero, kafelki, listy), `pomiar`

| Token | Wartość | Użycie |
|---|---|---|
| `--bg` | `#040406` | tło strony i nawigacji (lekko niebieskawa czerń) |
| `--line` | `#1a1a1c` (nav: `#1d1b1c`) | 1 px linie: pod nawigacją, między kolumnami kart |
| `--text` | `#ffffff` | nagłówki, tytuły kart, aktywny chip, wypełnienie przycisku głównego |
| `--text-2` | `#cacaca` | podtytuły (zmierzone `#cacaca`), linki nawigacji (`#d4d4d4`) |
| `--text-3` | `#b2b2b2` | opisy kart (dolne oszacowanie) |
| `--muted` | **`#8f8f8f`** (zrzut: `#6b6b6b`) | etykiety `/STYLES`, nieaktywne chipy |
| `--chip` | `#1c1d1f` | tło chipa nieaktywnego (zrzut: `#141416`–`#1d1d1f`) |

**Kontrast (obliczony):** oryginalny `#6b6b6b` na `#040406` daje 3,84:1, a `#787878` na tle chipa 3,82:1. To poniżej 4,5:1 (WCAG AA dla małego tekstu). **Nie kopiujemy tego**: `--muted` = `#8f8f8f` (6,33:1 na `--bg`, 5,22:1 na `--chip`).

### 2.2 Edytor, `pomiar`

| Token | Wartość | Miejsce |
|---|---|---|
| `--ed-top` | `#000000` | pasek górny (wysokość 52 px, linia dolna `#1b1b1b`) |
| `--ed-panel` | `#0a0a0a` | lewy i prawy panel |
| `--ed-rail` | `#0f0f0f` | pasek ikon po prawej (szerokość ok. 55 px, od x=1565 do 1620) |
| `--ed-sep` | `#111111`–`#232323` | separatory sekcji, krawędzie paneli (`#232323` przy lewym panelu) |
| `--ed-field` | `#111111` | pola, listy rozwijane, aktywna zakładka (`#141414`) |
| `--ed-toolbar` | `#0e0e10` | pływający pasek dolny |
| `--ed-track` / `--ed-fill` | `#232323` / `#f5f5f5` | suwak: linia 3 px (zmierzone) |
| `--ed-label` | `#858585` (5,37:1) | etykiety wierszy |
| `--ed-section` | `#8d8d8d` (5,97:1) | nagłówki `/ BACKDROP`, `/ INTENSITY` |
| `--ed-value` | **`#9a9a9a`** (zrzut: `#6d6d6d`, 3,83:1) | wartości po prawej, tekst pomocniczy |
| przycisk główny | tło `#ffffff`, tekst czarny | Export |

Pomiar nieobejmuje: promienia zaokrągleń (wizualnie ostre rogi, chipy i przyciski prostokątne; uchwyt slidera hero okrągły), wyglądu uchwytu suwaka w edytorze (nie widać go na zrzucie, `BRAK`), stanów hover, focus i disabled (`BRAK`: zdefiniować; focus = biały obrys 2 px `proj`).

### 2.3 Typografia (`proj?`)

- **Nagłówki i etykiety:** krój monospace (na zrzutach: duży nagłówek mono, małe etykiety wersalikami z ukośnikiem, np. `/STYLES`, `/ BACKDROP`). **Nazwy kroju z oryginału nie ustaliłem**; nie trzeba go dopasowywać.
- **Teksty:** bezszeryfowy.
- **Propozycja:** Geist Mono (nagłówki, etykiety, pole znaków) + Geist (teksty), obie OFL-1.1, w npm jako `@fontsource/geist-mono` i `@fontsource/geist` (wersje 5.3.0, sprawdzone `npm view`). Alternatywy: JetBrains Mono, Space Mono, IBM Plex Mono (też OFL w `@fontsource/*`).
- **Webfont z npm** (zgoda użytkownika). Cel dodatkowy: ta sama czcionka rysuje znaki w eksporcie, więc PNG wygląda tak samo na każdym urządzeniu.
- **Ryzyko do sprawdzenia przy budowie (`proj?`):** presety znaków z pliku 01, sekcja 4 zawierają znaki spoza typowych krojów mono (Braille, Katakana, bloki, Dots, Geometric, Math). Dla nich czcionka zastępcza zależy od urządzenia, więc eksport przestaje być przenośny. Sprawdzić pokrycie wybranego kroju dla każdego z 17 presetów, a niepokryte znaki rysować własnym kodem (jak `drawGeometric` w prototypie) albo dołożyć krój z pokryciem.

---

## 3. Mapa serwisu

| Trasa | Zawartość |
|---|---|
| `/` | strona główna (sekcja 5) |
| `/effects` | pełna lista efektów (sekcja 6) |
| `/how-to` | jak używać (sekcja 7) |
| `/editor` | edytor (sekcja 8); parametr `?style=<id>` otwiera od razu dany efekt |
| `/scenes` | **wersja 2**, w v1 nie istnieje |

Nawigacja (`proj`, wg opisu użytkownika): logo i nazwa po lewej; po środku **Efekty**, **Jak używać**; po prawej przycisk **Otwórz edytor**. Wysokość 65 px (`pomiar`: linia dolna na y=65), tło `--bg`, 1 px linia `--line`. Przycisk: ciemne tło, biały obrys, lewa i prawa krawędź grubsza niż górna i dolna (`zrzut`).

---

## 4. Zdjęcie robocze i miniatury

**Decyzja użytkownika:** jedno zdjęcie w repozytorium zastępuje wszystkie zdjęcia; do podmiany później.

- Plik: `public/sample/photo.jpg` (jeden plik, ok. 1600 px szerokości, poniżej 500 KB). **Jedno miejsce konfiguracji** (`src/config/sample.ts`), z którego korzystają hero, kafelki, miniatury i edytor.
- Wymagania wobec zdjęcia (żeby jedno zdjęcie nie ukrywało błędów): gładki gradient, obszar z drobnym detalem, nasycone kolory, bardzo ciemne i bardzo jasne partie, wyraźne krawędzie. Własne lub CC0; **nie** obrazki, nazwa, logo ani teksty z ascii-magic.com.
- **Miniatury efektów:** generowane z tego zdjęcia, nie osobne pliki: `public/thumbs/<id>.webp`, ok. 960×668 px (2× dla kafelka ok. 480×334, proporcja ok. 1,44:1 `pomiar`), jakość ok. 80.
- **Jak generować (`proj?`):** efekty działają w przeglądarce (WebGL/Canvas), więc skrypt musi być uruchomiony w przeglądarce. Wariant A: `npm run thumbs` przez headless Chromium (Playwright); **ryzyko:** pobranie przeglądarki może być zablokowane w środowisku chmurowym Claude Code. Wariant B (odporny): trasa deweloperska `/dev/thumbs`, która renderuje wszystkie efekty i pobiera paczkę `.zip`; wynik wkłada się do `public/thumbs/`. Zacząć od B.
- **Efekty jeszcze niezbudowane** nie mają miniatury: kafelek z oznaczeniem „wkrótce” (wzór CSS, bez obrazka).
- **Rejestr** `src/data/effects.json`: `id`, `name`, `category` (10 kategorii z pliku 01), `phase` (1, 2, 3), `status` (`ready` | `soon`), `description`, `engine`. Wszystkie listy i kafelki czytają z niego.

---

## 5. Strona główna `/`

Wzorzec: `pomiar`/`zrzut`; bez sekcji promocyjnych.

**5.1 Hero ze sliderem before/after**
- Pełna szerokość, wysokość ok. 672 px (zrzut 1474 px szerokości: od y=66 do 738), na całą szerokość okna.
- Lewa strona: oryginał z etykietą `BEFORE` (lewy górny róg), prawa strona: wynik efektu z etykietą `AFTER` (prawy górny róg). Etykiety małymi wersalikami mono w ciemnym prostokącie z cienkim obrysem (`zrzut`).
- Pionowa biała linia 1 px i **okrągły uchwyt** (ok. 48 px, ciemne wypełnienie, cienki obrys, strzałki `‹ ›`). Startowa pozycja: środek. Przeciąganie myszą i dotykiem; **klawiatura** (strzałki, rola `slider`, `aria-label`).
- **Chipy stylów** na dolnej krawędzi (ok. 13 efektów + chip `…`): aktywny ma biały obrys i biały tekst, nieaktywne `--chip`. Wybór chipa przełącza efekt po prawej stronie (render **na żywo, jednym płótnem**); chip `…` prowadzi do `/effects`. Lista chipów: wybrane efekty ze statusem `ready`, pierwsze to Characters.
- Pod sliderem: nagłówek mono (np. „Turn your images…” w oryginale) i przycisk **Otwórz edytor**; tekst własny, krótki. Treści `BRAK`, do napisania przez Claude Code i zatwierdzenia.

**5.2 Kafelki z przykładowymi efektami**
- Etykieta sekcji `/EFEKTY` (mono, `--muted`), nagłówek, jedno zdanie, siatka **3 kolumny** (zrzut: 3 × ok. 495 px przy szerokości 1482), zdjęcie od krawędzi do krawędzi (wysokość ok. 340 px), pod nim tytuł pogrubiony, opis jednym zdaniem w `--text-3`, strzałka `›` w lewym dolnym rogu; kolumny rozdzielone 1 px linią `--line`.
- **9 kafelków** (3 × 3) `proj?` i przycisk **Pokaż wszystkie** → `/effects`.
- **Hover:** domyślnie widać wynik efektu; po najechaniu płynne przejście (crossfade ok. 200 ms) do oryginału z etykietą `BEFORE`; po opuszczeniu powrót. Tę interpretację zdania użytkownika („hover effect na zdjęcie przed i po”) proponuję (`proj?`). Na urządzeniach bez hovera (dotyk): bez przełączania, wynik zawsze widoczny. Respektować `prefers-reduced-motion` (przełączenie bez animacji).

**5.3 Całość efektów**
- Niżej pełna lista 91 efektów **pogrupowana w 10 kategorii** (nazwy z pliku 01, sekcja 2), czytana z rejestru. Na stronie głównej wersja zwarta (nazwa efektu jako link do `/editor?style=<id>`, status `wkrótce` wyszarzony); bogatsza wersja z miniaturami na `/effects` (`proj?`, patrz pytanie 1).

Dolna część strony (stopka): minimalna, bez linków promocyjnych: nazwa, link do ascii.rest i informacja o licencjach (wymóg MIT; patrz brief 00, sekcja 7).

---

## 6. Strona `/effects`

- Nagłówek, pole wyszukiwania i filtr kategorii (`proj?`), siatka kafelków jak w 5.2, pogrupowana po kategoriach (nagłówki sekcji w stylu `/KATEGORIA`).
- Kafelek: miniatura (lub „wkrótce”), nazwa, jedno zdanie opisu z pliku 02, to samo zachowanie hover. Kliknięcie otwiera `/editor?style=<id>`.
- Efekty `soon` nie są klikalne albo otwierają edytor z komunikatem (`proj?`, do decyzji).

## 7. Strona `/how-to`

Krótka instrukcja (`proj`), bez marketingu: 1) wczytaj zdjęcie, 2) wybierz efekt, 3) ustaw parametry (3 poziomy: główne, zaawansowane, seed, plik 02), 4) opcjonalnie Color, Post FX, 5) pobierz PNG (skala 1–4×). Wzór układu: jedna kolumna tekstu, nagłówki `/KROK 1`. Treść `BRAK`, do napisania.

---

## 8. Edytor `/editor`

Układ wg zrzutu 3 (`pomiar`/`zrzut`), dostosowany do naszego zakresu.

```
┌ pasek górny 52 px ───────────────────────────────────────────────────────┐
│ logo + nazwa │ − 100% + · kadr · porównaj · T · cofnij · ponów │ Pomoc ☰ │
├ lewy panel 311 px ┬ płótno (czarne) ───────────────┬ szyna 55 px ┬ prawy ─┤
│ Style             │                                │ ikony       │ panel  │
│ [szukaj]          │        zdjęcie                 │             │ /STYL  │
│ Eksploruj|Ulubione│                                │             │ /BACKDROP
│ kategorie + siatka│  [ Wczytaj · Losuj · Eksport ] │             │ /INTENSITY
└───────────────────┴────────────────────────────────┴─────────────┴────────┘
```

**8.1 Pasek górny.** Po lewej logo i nazwa. Środek: zoom −/+ z wartością (`100%`), kadr, porównanie przed/po, warstwa tekstu (`T`), cofnij, ponów. Po prawej: Pomoc (otwiera `/how-to`) i menu. **Usunąć:** przełącznik Studio/Flow, Go Pro, Sign in, ikonę warstw (znaczenie nieznane, plik 01 oznacza ją `[?]`).

**8.2 Lewy panel (311 px, można zwinąć).**
- Nagłówek „Style”, przyciski rozwijania i zwijania.
- Pole wyszukiwania („Szukaj nazwy lub tagu”).
- Zakładki **Eksploruj | Ulubione** (`Ulubione` w `localStorage`, `proj?`). **Usunąć:** Realtime/Generative, Recipes, sekcję „SUGGESTED FOR THIS IMAGE” (wymaga logiki, której nie specyfikujemy), odznaki PRO.
- Kategorie (nagłówki mono, np. `ASCII & TEXT`) z siatką **3 kolumn** miniatur 1,44:1: obrazek, pod spodem nazwa (`#898989` zrzut; użyj `--ed-label`), wybrany styl ma biały obrys. Miniatury ze zdjęcia roboczego (sekcja 4); **efekt zastosowany do zdjęcia użytkownika w miniaturach nie jest w v1** (`proj?`).

**8.3 Płótno.** Czarne tło, obraz wyśrodkowany (zrzut: marginesy z góry ok. 80 px, obraz na całą szerokość między panelami). Zoom (przyciski i kółko), przesuwanie, porównanie przed/po (przytrzymanie przycisku lub suwak `proj?`). Stan pusty: obszar „Przeciągnij zdjęcie lub wybierz plik” oraz przycisk Wczytaj; domyślnie ładuje się zdjęcie robocze (sekcja 4).

**8.4 Pływający pasek dolny.** Wyśrodkowany, `--ed-toolbar`, ok. 575 × 40 px (zrzut), przyciski z ikoną i etykietą: **Wczytaj**, **Losuj** (nowy `seed`; plik 02: każdy efekt z losowością ma `seed`), **Eksport** (biały przycisk, czarny tekst). **Usunąć:** Inspire, Restyle, Library (znaczenie Restyle i Inspire niepewne `[?]`, Library to zapisane przepisy poza zakresem).

**8.5 Prawy panel i szyna ikon.** Szyna ikon pionowo (zrzut: Aa, warstwy, odtwarzanie, słońce, kropla, iskra, kadr). W v1:

| Ikona | Zakładka | v1 |
|---|---|---|
| Aa | Parametry stylu | tak |
| odtwarzanie | Animacja | **wyszarzona** (wersja 2) |
| słońce | Lights (do 4 świateł, plik 01 sekcja 7) | `proj?` (pytanie 4) |
| kropla | Color (presety, tint, saturacja…) | tak |
| iskra | Post FX (16 darmowych z pliku 01 sekcja 8) | tak |
| kadr | Kadr | tak |

Zakładka parametrów stylu (wzór: Characters na zrzucie):
- Nagłówek `/ NAZWA STYLU` z listą rozwijaną (przełączanie stylu), potem sekcje `/ BACKDROP`, parametry stylu, `/ INTENSITY` (Coverage, Brightness, Contrast).
- **Wiersz suwaka:** etykieta po lewej, wartość po prawej (`--ed-value`), pod spodem linia 3 px (`--ed-track`, wypełnienie `--ed-fill`). **Lista rozwijana:** pole `--ed-field` z szewronem. **Przełącznik:** mały kwadrat po prawej. **Pole znaków** (Chars): krój mono. Zakresy i domyślne wartości: pliki 01 i 02 (niektóre `[?]`: kontrast ma sprzeczne dane w pliku 01, sekcja 10).
- Parametry czytane z rejestru efektów, nie zakodowane w UI; trzy poziomy: główne (3–6 suwaków), zaawansowane (zwijane), seed.
- Szerokość prawego panelu `BRAK` (zrzut ucina go na 1894 px; od x=1620 widać co najmniej 274 px).

**8.6 Eksport (v1).**
- **PNG**, skala 1×–4× (plik 01: w oryginale 1–4×). JPG `proj?` (pytanie 5).
- **Limity kanwy:** przeglądarki ograniczają rozmiar kanwy i różnią się między sobą (Safari na iOS historycznie ma niski limit powierzchni). Przy skali 4× dużego zdjęcia eksport może się nie udać. `BRAK` pomiaru: wykryć limit w czasie działania, ostrzec i zaproponować mniejszą skalę.
- Eksport musi dawać obraz zgodny z podglądem: parametry w pikselach skalować przez skalę eksportu (plik 01, sekcja 1: promienie blura, odstępy scan lines, rozmiar komórki ASCII mnożą się przez skalę).

---

## 9. Dostępność i zachowanie

- Kontrast tekstu co najmniej 4,5:1 (tokeny z sekcji 2 spełniają). Widoczny focus (biały obrys 2 px). Wszystkie przyciski i slidery dostępne z klawiatury.
- `prefers-reduced-motion`: bez przejść crossfade i animacji uchwytu.
- Responsywność: **BRAK na zrzutach** (tylko widok desktopowy). `proj?`: strony `/`, `/effects`, `/how-to` jednokolumnowe poniżej ok. 700 px (3 → 2 → 1 kolumna); **edytor w v1 desktop-first**, na wąskim ekranie panele jako dolne arkusze (do dopracowania, nie blokuje v1).
- Treść w interfejsie: język do ustalenia (pytanie 6).

## 10. Poza zakresem v1

Cennik, opinie, FAQ, blog, changelog, „Give your agents…”, przepisy (Recipes), tryb generatywny AI, Flow, konta i logowanie, odznaki PRO, zakładka Animacja (wyszarzona), `/scenes`, GIF i MP4, komponent do osadzania.

---

## 11. Kolejność budowy UI (małe kroki, każdy z kryterium odbioru)

1. **Szkielet i tokeny:** Vite + TypeScript (`proj?`), tokeny CSS z sekcji 2, fonty z npm, nawigacja, trasy. *Odbiór:* strony się ładują, kontrast tokenów zgodny z sekcją 2.
2. **Rejestr efektów** `effects.json` ze wszystkimi 91 wpisami (nazwy, kategorie, fazy, opisy z pliku 02). *Odbiór:* 91 wpisów, 10 kategorii, 0 duplikatów id.
3. **Silnik efektów, Faza 1** (osobny etap, specyfikacja: pliki 01 i 02) i render pojedynczego efektu na zdjęciu roboczym.
4. **Hero ze sliderem** (z jednym efektem, potem chipy) i **kafelki z hoverem**.
5. **Skrypt miniatur** (wariant B) i podmiana zdjęcia roboczego jedną komendą. *Odbiór:* po podmianie `public/sample/photo.jpg` i uruchomieniu skryptu wszystkie miniatury się zmieniają.
6. **Lista efektów** na stronie głównej i `/effects`.
7. **Edytor:** układ, lewy panel, płótno, prawy panel dla jednego stylu, potem reszta; eksport PNG.
8. **`/how-to`, stopka z licencjami, dostępność, widoki wąskie.**

Po każdym kroku raport: co zrobiono, co przetestowano (i jak), czego nie sprawdzono.

---

## 12. Pytania otwarte

**Odpowiedzi użytkownika (14–15 X 2026):** 1) wariant A (zwarta lista na stronie głównej, kafelki z miniaturami na `/effects`); 2) hover = płynne przejście do oryginału; 3) **bez Ulubionych** (usunąć z 8.2); 4) Lights: projekt Claude Code do akceptacji; 5) **PNG i JPG, skala @1x i @2x** (zastępuje 1×–4× z 8.6); 6) i 7) bez odpowiedzi: obowiązują propozycje domyślne (interfejs po polsku, nazwy efektów po angielsku; treści pisze Claude Code do akceptacji).


1. Dolna część strony głównej: zwarta lista nazw (jak w 5.3) a osobny `/effects` z miniaturami, czy ta sama lista w obu miejscach?
2. Hover kafelka: wynik → oryginał (sekcja 5.2), czy suwak przed/po pod kursorem?
3. Zakładka Ulubione w v1?
4. Lights w v1 (do 4 świateł, plik 01 sekcja 7; w pliku nie ma opisu, jak oddziałują na poszczególne style), czy odłożyć?
5. Eksport: tylko PNG, czy także JPG?
6. Język interfejsu: polski czy angielski (nazwy efektów w plikach są po angielsku)? Domyślnie `proj?`: interfejs po polsku, nazwy efektów po angielsku.
7. Treści: hero, opisy kafelków i `/how-to` pisze Claude Code do zatwierdzenia, czy dostarczysz własne.
