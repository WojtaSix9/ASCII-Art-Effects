# Brief dla Claude Code: ASCII Art Effects

Stan na 14 X 2026. Zastępuje wcześniejszą wersję 00 (v1 była tam opisana jako moduł scen, a jest nią teraz edytor efektów obrazkowych). Zbiera to, co ustalone i sprawdzone, żeby zacząć bez czytania historii. Szczegóły: pliki 01–06 i `reports/`.

Oznaczenia: `test` = sprawdzone uruchomieniem (Node 22, piaskownica), `kod` = sprawdzone w kodzie, `docs` = z dokumentacji, `proj` = decyzja projektowa, `proj?` = propozycja do potwierdzenia, `BRAK` = nie zrobione i nie sprawdzone.

**Które plik czytać do czego**
| Plik | Zawartość | Aktualność |
|---|---|---|
| 05 | UI: tokeny, układ stron i edytora, kolejność budowy UI | aktualny, poza zdaniem o braku silnika (sekcja 1 i krok 3 w sekcji 11: silnik już jest, patrz 06) |
| 06 | silnik efektów Fazy 1: API, testy, wydajność, plan | **aktualny, źródło prawdy o stanie silnika** |
| 01, 02 | specyfikacja efektów (opcje, katalog 91 efektów, fazy) | aktualne; poprawki w sekcji 4 poniżej |
| 03, 04 | moduł scen i jego eksport | **wersja 2**, w v1 nie dotykać |

---

## 1. Cel i zakres

**Cel:** własne narzędzie w stylu ASCII Magic (ascii-magic.com), w przeglądarce, bez serwera, darmowe i do własnego użytku. Nazwa: **ASCII Art Effects**. Nie kopia 1:1: własny katalog 91 efektów i własne nazwy.

**Wersja 1 (zakres):** wczytanie zdjęcia, wybór efektu, parametry, Color, Post FX, pobranie **PNG** (skala 1–4×). Strony: `/`, `/effects`, `/how-to`, `/editor`.

**Wersja 2 (poza zakresem v1):** animowane sceny ASCII (`/scenes`), animacje efektów, GIF (max 10 s) i MP4. Prototyp scen działa w Node (`ascii-scenes-szkielet-v8.zip`, pliki 03–04). Nie wnosić go do v1.

**Nie ruszać bez pytania:** tryb generatywny (AI), komponent do osadzania, konta/logowanie/cennik i inne sekcje promocyjne (lista w 05, sekcja 10), logotypy języków, dystrybucji i firm ze scen (znaki towarowe), ponowne pobieranie ascii-magic.com lub repozytorium bas3line/ascii (wszystko potrzebne jest w plikach; wyjątek tylko za zgodą użytkownika).

---

## 2. Co już jest

**Silnik efektów** (`ascii-effects-engine-v1.zip`, opis w 06): czysty TypeScript na buforach RGBA, bez DOM. Po rozpakowaniu `npm install`; Node 22 uruchamia `.ts` bezpośrednio (bez parameter properties, importy z `.ts`).
- 18 efektów Fazy 1: Characters, Block, Braille, Dots, Cross, Diamond, Lines, Diagonal, Pixel Art, Mosaic, LEGO, Hex Mosaic, Disco, Halftone, Posterize, Duotone, Gradient Map, Dither (15 algorytmów × 15 palet).
- Backdrop, Color (8 presetów, tint, saturation, vibrance, hue, grayscale, invert), 13 z 16 darmowych post FX w stałej kolejności, eksport tekstowy (Characters, Block, Braille), skala eksportu 0,1–8×.
- `src/data/effects.json`: rejestr 91 efektów (id, nazwa, kategoria, silnik, złożoność, opis, faza, status `ready`/`soon`). To krok 2 z 05, sekcja 11.
- Każdy efekt deklaruje `params` (`ParamDef`), z których UI ma budować panel. `resolveParams` obcina zakresy i rzuca błąd dla nieznanych kluczy.

**Stan testów (`test`, Node):** 81 z 81 (`node scripts/check-engine.ts`). Testy sprawdzają własności (liczba komórek przy skali 2×, zagnieżdżenie coverage, dither tylko w kolorach palety itd.). Trzy progi tolerancji ustawiono po pomiarze (06, sekcja 3), nie z góry.

**Czego nie sprawdzono (`BRAK`), a co zwykle daje niespodzianki:**
1. Cokolwiek w przeglądarce: Worker, `OffscreenCanvas`, czas każdego efektu, pamięć przy wielu renderach.
2. Wygląd na prawdziwych zdjęciach (twarze, skóra, tekstury). Efekty oceniono tylko na obrazie syntetycznym.
3. Pokrycie znaków wybranej czcionki w 17 presetach (Braille, Katakana, Dots, Geometric, Math, bloki).
4. Wydajność na żywo: halftone 636 ms, bloom 422, blur 342 (obraz 1600×1067, piaskownica, orientacyjnie). Cel podglądu ok. 100 ms spełnia tylko część efektów.
5. Brakujące elementy Fazy 1: Character Bloom i Chroma, post-halftone, Lights, warstwa tekstu, Photo Filter, Gradient Map w Color, Levels i Curves.

Nie podajemy procentu gotowości: bez testu w przeglądarce nie da się go uczciwie oszacować.

---

## 3. Decyzje użytkownika (obowiązują)

- v1 = efekty obrazkowe, PNG; sceny, GIF i MP4 w v2.
- UI: kierunek stylistyczny ascii-magic.com, specyfikacja 05 zatwierdzona. Jedno zdjęcie robocze w repozytorium (`public/sample/photo.jpg`, konfiguracja w `src/config/sample.ts`) zastępuje wszystkie zdjęcia; do podmiany później.
- Webfont z npm (OFL) do UI i, jeśli się sprawdzi, do rysowania znaków w eksporcie.
- Szczegóły Fazy 2 i 3 (73 efekty) dopracowuje Claude Code na podstawie pliku 02.
- **Characters: domyślnie jasny = gęsty znak** (jasny tekst na ciemnym tle), `invert` odwraca. Automatyczne odwracanie dla jasnego tła: opcja na później.
- **Palety:** zachować pole `source` w `palettes.ts`. Paleta LEGO to **przybliżenie** 24 kolorów; w interfejsie nie nazywać jej „official LEGO Art set”. Dokładne kolory znamy tylko dla Game Boy.
- 23 efekty bez fazy zostają w fazie 3 z `phaseAssigned: false`, dopóki ktoś ich nie przypisze. Propozycja (ocena z nazw i złożoności, nie wiedza o oryginale): do fazy 2 raczej pasują Mixed, Warhol, Cyanotype, Mezzotint, Kaleidoscope, Anaglyph 3D. Claude Code może to zatwierdzić po przeczytaniu opisów w 02.

## 4. Poprawki dokumentów do zrobienia na początku

1. `02-katalog-efektow.md`, opis Characters: zamiast „ciemne = gęste znaki” wpisać „jasne = gęste znaki (domyślnie, jasny tekst na ciemnym tle); `invert` odwraca”. Ten sam opis poprawić w `src/data/effects.json` (dziś kopiuje starą wersję i jest sprzeczny z silnikiem).
2. `01-efekty-i-opcje.md`, sekcja 4: dopisać, że rampy znaków są uporządkowane od najgęstszego do najrzadszego (kolejność gęstości, nie jasności).
3. `05-ui-dla-claude-code.md`: dodać na początku zdanie „Stan silnika: patrz 06; sekcja 1 i krok 3 w sekcji 11 są nieaktualne”.

---

## 5. Zasady pracy

- Małe kroki, jeden etap naraz; po każdym raport: co zrobiono, co i jak przetestowano, czego nie sprawdzono.
- Oznaczać źródła informacji (docs / kod / test / proj).
- Być rzetelnym i sceptycznym; nie zgadzać się na wszystko. Raportować też testy, które zawiodły, i błędy we własnych testach.
- Nie rozszerzać zakresu bez pytania.
- Testy mają sprawdzać własności, a nie tylko „uruchamia się”. Progów tolerancji nie dobierać tak, by test przechodził, bez zapisania, jak je wyznaczono.

---

## 6. Kolejność prac

Źródła: 06, sekcja 6 (silnik) i 05, sekcja 11 (UI). Proponowane połączenie (`proj?`):

1. **Szkielet i tokeny** (05, krok 1): Vite + TypeScript (propozycja, można uzasadnić inny stos), tokeny CSS, fonty z npm, trasy.
2. **Silnik w przeglądarce** (06, krok 1): Web Worker, `OffscreenCanvas`, czcionka z npm. **Pierwsze testy w prawdziwej przeglądarce**: pokrycie znaków w 17 presetach, czas każdego efektu, pamięć przy wielokrotnym renderze. Wyniki tego kroku mogą zmienić dalszy plan, więc raportować przed kontynuacją.
3. **Render na zdjęciu roboczym i hero ze sliderem** (05, krok 4), podpięcie panelu parametrów do `params`.
4. **Miniatury** (05, krok 5, wariant B: trasa `/dev/thumbs`), listy efektów, `/effects`.
5. **Edytor** (05, krok 7) i **eksport PNG** z kontrolą limitów kanwy (Safari/iOS) i zgodnością z podglądem.
6. **Optymalizacja** efektów > 100 ms (halftone, bloom, blur, sharpen); testy silnika CPU jako wzorzec dla ewentualnego WebGL.
7. **Brakujące elementy Fazy 1** (sekcja 2, punkt 5), potem **Faza 2 i 3** (każdy efekt: definicja `params`, test własności, wpis w `effects.json` ze `status: ready`).
8. `/how-to`, stopka z licencjami, dostępność, widoki wąskie.

---

## 7. Licencje

- Silnik efektów jest nasz; nie zawiera kodu ascii-magic.com.
- Kod scen (v2): MIT, `Copyright (c) 2026 bas3line`. Przy wnoszeniu do repozytorium zachować `LICENSES/ascii.rest-MIT.txt`, `THIRD_PARTY_NOTICES.md` i nagłówki plików. W v1 w stopce: link do ascii.rest i informacja o licencjach (podziękowanie to dobra praktyka, nie wymóg).
- Czcionki: OFL-1.1 (npm `@fontsource/*`); dołączyć ich notki do `THIRD_PARTY_NOTICES.md`.
- Nie jestem prawnikiem; to opis tego, co wynika z treści licencji.

---

## 8. Otwarte pytania

1. **Czcionka a wcześniejsza decyzja.** Użytkownik nie chce pliku czcionki w repozytorium (decyzja z modułu scen), ale zgodził się na webfont z npm. To nie jest sprzeczne dosłownie (zależność, nie plik w repo), lecz wynik eksportu PNG zależy wtedy od tej czcionki i jej pokrycia znaków. Do potwierdzenia po teście pokrycia (krok 2).
2. Pytania z 05, sekcja 12 (lista dolna strony głównej, hover kafelka, Ulubione, Lights w v1, JPG, język interfejsu, kto pisze treści): odpowiedzi nie są zapisane w plikach; zapytać użytkownika przed krokiem, którego dotyczą.
3. Kontrast: zakres i neutralna wartość to nasza definicja (−100…100, 0 = bez zmiany), bo dane oryginału są sprzeczne (01, sekcja 10).
4. Przypisanie faz 23 efektom (sekcja 3).

---

## 9. Materiał na wersję 2 (skrót)

- Prototyp: 30 scen startowych, `ScenePlayer`, renderer (kanwa i bufor RGBA), eksport PNG, tekst, MP4 (Node, ffmpeg), GIF (`gifenc`). Testy w `reports/`.
- Kluczowe ograniczenia: 7 z 30 scen jest sekwencyjnych (zawsze przez `ScenePlayer`, kolejno, bez równoległości); GIF max 10 s; `speed` niezaimplementowane; MP4 w przeglądarce `BRAK` (plan: WebCodecs, sprawdzić `VideoEncoder.isConfigSupported`); przeciek pamięci przy odczycie pikseli dotyczy Node, w przeglądarce niemierzony. Szczegóły w 03 i 04.
