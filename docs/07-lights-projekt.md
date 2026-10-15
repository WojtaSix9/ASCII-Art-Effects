# Lights: projekt do akceptacji

Stan na 15 X 2026. Decyzja użytkownika: Claude Code projektuje Lights i opisuje projekt **przed** implementacją. Ten plik to ten opis; nic z niego nie jest jeszcze zaimplementowane.

Oznaczenia: `docs` = z pliku 01, `proj` = moja propozycja, `?` = pytanie do użytkownika.

## 1. Co wiemy z oryginału (`docs`, plik 01, sekcja 7)

- Przełącznik „Enable Lights”, pole 2D z siatką kropek: dotknięcie dodaje światło, przeciągnięcie przesuwa, kliknięcie zaznacza, **maksymalnie 4 światła**, kosz.
- Parametry: **Radius 30**, **Intensity 80** (zrzut był ucięty, więc mogło być ich więcej).
- **Dither nie ma zakładki Lights.**
- Brak opisu, jak światło działa na poszczególne style.

## 2. Jak to widzę (`proj`)

**Idea:** światło to miejscowe rozjaśnienie obrazu **przed** stylem. Efekt dostaje rozjaśniony obraz, więc reaguje na światło swoją strukturą: w Characters pojawiają się gęstsze znaki, w Dots większe kropki, w Halftone mniej tuszu, a w LEGO jaśniejsze klocki. Przypomina to oświetlenie sceny, a nie nałożoną na wierzch poświatę. Takie podejście działa jednakowo dla wszystkich efektów, bo wszystkie biorą ton z tego samego miejsca w silniku.

**Model jednego światła:**
- pozycja `x`, `y` (0–1 względem obrazu), więc eksport @2x wygląda tak samo jak podgląd;
- `radius` 0–100, domyślnie 30: zasięg jako procent przekątnej obrazu;
- `intensity` 0–100, domyślnie 80;
- `color`, domyślnie biały: barwi ton w zasięgu światła (np. ciepłe światło z jednej strony).

**Wpływ na piksel:** siła `L = intensity × zanik(odległość / radius)`, gdzie zanik jest gładki (1 w środku, 0 na krawędzi zasięgu, bez twardej krawędzi). Światła się sumują (najwyżej 1). Piksel przesuwa się w stronę koloru światła o `L`. Białe światło rozjaśnia, kolorowe rozjaśnia i barwi.

**Dodatkowo `Ambient` (0–100, domyślnie 100):** jasność obszarów poza zasięgiem świateł. Przy 100 światła tylko dodają jasność. Przy niższych wartościach reszta obrazu ciemnieje, co daje efekt reflektora. Tego nie ma w opisie oryginału, to mój dodatek.

**Gdzie działa:** wszystkie efekty poza Dither (tak jak w oryginale). Zakładka Lights jest nieaktywna przy Dither.

**Wydajność:** jedno przejście po pikselach. Szacuję kilka milisekund na podgląd, nie zmierzone.

## 3. Interfejs (`proj`)

- Zakładka Lights (ikona słońca w szynie) i przełącznik „Włącz światła”.
- **Pole 2D:** proporcje zdjęcia, przyciemniony podgląd zdjęcia i siatka kropek.
  - Kliknięcie w puste miejsce dodaje światło (najwyżej 4), kliknięcie w światło je zaznacza, przeciągnięcie przesuwa.
  - Zaznaczone światło ma przycisk kosza i klawisz Delete.
- **Pod polem, dla zaznaczonego światła:** Radius, Intensity i Color. Niżej Ambient, wspólny dla wszystkich świateł.
- **Klawiatura:** światła w polu są przyciskami, strzałki przesuwają o 1%, Shift + strzałka o 5%.
- Zmiany trafiają do historii cofnij/ponów jak inne parametry.
- Na później (`?`): przeciąganie świateł bezpośrednio na płótnie, a nie tylko w polu 2D.

## 4. Testy, które napiszę (własności)

- Wyłączone światła albo brak świateł dają obraz bajt w bajt taki jak bez Lights.
- Światło w środku rozjaśnia środek bardziej niż rogi. Większy radius rozjaśnia większy obszar. Intensity 0 nic nie zmienia.
- Eksport @2x pomniejszony do @1x jest podobny do @1x (PSNR jak w testach skali silnika).
- Najwyżej 4 światła; piąte kliknięcie nic nie dodaje.
- Ambient 100 nie przyciemnia niczego poza zasięgiem świateł.

## 5. Pytania do użytkownika (`?`)

1. Czy światło ma zmieniać **strukturę** efektu (gęstsze znaki, większe kropki), jak wyżej, czy tylko **kolor i jasność tuszu** (znaki te same, tylko jaśniejsze lub barwione)? Rekomenduję strukturę, bo daje wyraźniejszy efekt.
2. Kolorowe światła: tak, czy tylko białe?
3. Ambient (przyciemnianie reszty obrazu): tak, czy nie?
