# Warstwa tekstu: projekt do akceptacji

Stan na 15 X 2026. Decyzja użytkownika: Claude Code opisuje projekt **przed** implementacją, tak jak przy Lights (plik 07). Tu nie ma jeszcze kodu.

Oznaczenia: `docs` = z plików 01, 02 i 05, `proj` = moja propozycja, `?` = pytanie do użytkownika.

## 1. Co wiemy (`docs`)

- **Kolejność:** warstwa tekstu jest rysowana **na końcu**, po post FX i po Color, Levels i Curves. **Grading jej nie dotyczy** (plik 01, sekcje 1, 8 i 8.10).
- **Pozycja i rozmiar to ułamki ramki, a nie piksele**, więc napis trafia w to samo miejsce przy eksporcie w każdej skali (plik 01; plik 02: „pozycja w ułamkach kadru”).
- **Interfejs:** przycisk `T` w pasku górnym, między „porównaj” a „cofnij” (plik 05, sekcja 8.1).
- Brak opisu parametrów: czcionki, koloru, liczby napisów i wyglądu panelu.

## 2. Jak to widzę (`proj`)

**Model jednego napisu:**

| Pole | Zakres | Domyślnie | Uwagi |
|---|---|---|---|
| `text` | do 200 znaków, wiele linii | „Tekst” | polskie znaki tak; emoji nie (brak czcionki) |
| `font` | Geist, Geist Mono | Geist Mono | obie są już w projekcie (OFL-1.1); pytanie 2 |
| `weight` | 400, 700 | 700 | |
| `size` | 1–50 | 8 | **% wysokości ramki**, więc rośnie z eksportem |
| `x`, `y` | 0–1 | 0,5; 0,85 | punkt zaczepienia względem ramki **po kadrze** |
| `align` | lewo, środek, prawo | środek | zaczepienie w poziomie; w pionie środek bloku tekstu |
| `color` | kolor | biały | |
| `opacity` | 0–100 | 100 | |
| `letterSpacing` | −10…50 | 0 | % rozmiaru czcionki |
| `lineHeight` | 80–200 | 120 | % rozmiaru czcionki |

**Rysowanie:** tak samo w podglądzie, eksporcie @1x/@2x i w Node (testy):
- silnik dostaje dostawcę tekstu (jak `GlyphProvider` dla znaków), który rysuje napis kanwą 2D na przezroczystej warstwie w rozmiarze klatki;
- warstwa jest nakładana na wynik po Color;
- przy braku napisów obraz jest bajt w bajt taki jak dziś;
- czcionka ładowana w Workerze przez `FontFace` przed renderem, jak Geist Mono dla znaków.

**Czego warstwa nie robi:**
- nie przechodzi przez styl (napis nie zamienia się w ASCII);
- nie trafia do eksportu tekstowego Characters, Block i Braille (tam jest tylko siatka znaków).

## 3. Interfejs (`proj`)

- **Przycisk `T` w pasku górnym** dodaje napis na środku dolnej części i otwiera zakładkę **Tekst** w szynie ikon.
- **Zakładka Tekst:**
  - lista napisów (zaznaczony podświetlony, kosz);
  - pod listą pola zaznaczonego napisu: pole tekstowe, czcionka, grubość, rozmiar, wyrównanie, kolor, krycie oraz pozycja X i Y w %;
  - w części zaawansowanej odstęp liter i wysokość linii.
- **Na płótnie:**
  - zaznaczony napis ma przerywaną ramkę, przeciągnięcie przesuwa napis (pytanie 3);
  - klawiatura na zaznaczonym napisie: strzałki 1%, Shift 5%, Delete usuwa.
- Zmiany idą do historii cofnij/ponów, zmiana zdjęcia **nie** usuwa napisów.
- „Porównaj z oryginałem” pokazuje zdjęcie bez napisów.

## 4. Testy, które napiszę (własności)

- **Brak napisów i pusty tekst:** obraz bajt w bajt taki jak bez warstwy.
- **Grading nie działa na napis:** zmiana Color (np. B&W, hue 180, Curves) nie zmienia pikseli napisu. Białe litery zostają białe.
- **Skala:** prostokąt pokrycia napisu w ułamkach ramki taki sam przy skali 1 i 2 (±1 px w skali 1).
- **Pozycja i rozmiar:**
  - środek napisu wyrównanego do środka leży w (x, y);
  - wysokość napisu rośnie liniowo z `size`;
  - lewe wyrównanie zaczyna się w x.
- **Krycie 0 i tekst z samych spacji:** nic nie rysują.
- **Kadr:** napis liczy się względem kadru (to samo położenie w ułamkach przy różnych kadrach).
- **Edytor:**
  - `T` dodaje napis;
  - pole tekstowe zmienia obraz;
  - przeciąganie przesuwa napis, cofnij przywraca;
  - eksport @1x = render.

Przeglądarka i Node będą rasteryzować tekst inaczej, więc porównanie hashy Node z przeglądarką nie obejmie napisów, tak jak dziś nie obejmuje Characters.

## 5. Pytania do użytkownika (`?`)

1. **Ile napisów:** jeden czy kilka? Proponuję do 4, jak światła.
2. **Czcionki:**
   - wystarczą Geist i Geist Mono, które już są w projekcie;
   - czy dodać 2–3 inne na licencji OFL, np. szeryfową i „plakatową”? Każda to ok. 20–60 kB na grubość, pobierane dopiero przy wyborze.
3. **Przeciąganie napisu po płótnie:** tak czy tylko pola X/Y w panelu? Rekomenduję tak, bo to naturalne, a w Lights przeciąganie na płótnie zostało na później.
4. **Dodatki:** czy w v1 potrzebny jest **obrys**, **cień** albo **pasek tła pod napisem**? Pomagają czytelności na gęstym ASCII. Rekomenduję obrys i cień jako dwa proste suwaki, bez paska.
5. **Obrót napisu:** tak czy nie? Rekomenduję nie w v1.
