# ASCII Art Effects

Narzędzie w przeglądarce do nakładania efektów ASCII i pikselowych na zdjęcia (v1: eksport PNG). Działa bez serwera.

## Układ repozytorium

| Katalog | Zawartość |
|---|---|
| `docs/` | Specyfikacja. Zacznij od `00-brief-dla-claude-code.md`. `docs/v2/`: moduł scen (wersja 2). `docs/archive/`: nieaktualne wersje. |
| `engine/` | Silnik efektów: czysty TypeScript na buforach RGBA, bez DOM. Osobny pakiet z testami w Node (opis: `docs/06-silnik-efektow.md`). |
| `app/` | Strona (Vite + TypeScript, bez frameworka UI). Importuje silnik wprost z `../engine/src` i uruchamia go w Web Workerze (`app/src/engine/`). |
| `LICENSES/`, `THIRD_PARTY_NOTICES.md` | Licencje zależności dołączanych do buildu (czcionki). |

## Polecenia

Wymaga Node 22 (uruchamia pliki `.ts` bezpośrednio).

```sh
# silnik
cd engine && npm install
node scripts/check-engine.ts        # testy silnika (raport: reports/engine-check.txt)

# strona
cd app && npm install
npm run dev                         # http://localhost:5173
npm run build                       # sprawdzenie typów + build do app/dist
npm run check:tokens                # kontrast tokenów kolorów (WCAG)
npm run smoke                       # test w Chromium (Playwright) na zbudowanej wersji; najpierw npm run build
npm run test:engine                 # silnik w przeglądarce (/dev/engine): zgodność z Node, pokrycie znaków, czasy, pamięć
npm run test:ui                     # hero (suwak, chipy, skala podglądu) i panel parametrów w edytorze
npm run fixtures                    # odśwież oczekiwane skróty z Node po zmianie silnika
```

Stronę `/dev/engine` można też otworzyć ręcznie w dowolnej przeglądarce (np. Safari na iPhonie), żeby sprawdzić silnik na danym urządzeniu.

## Zdjęcie robocze

Jedno zdjęcie zasila hero, edytor (i później miniatury): `app/public/sample/photo.jpg`, opis w `app/src/config/sample.ts`. **Teraz jest tam obraz syntetyczny** (placeholder z `npm run sample:placeholder`). Podmiana: wgraj własne zdjęcie lub CC0 pod tą samą nazwą (ok. 1600 px szerokości, < 500 KB), popraw `alt` i ustaw `placeholder: false`.

## Deploy (Vercel)

`vercel.json` w katalogu głównym ustawia wszystko: instalację i build w `app/`, katalog wyjściowy `app/dist`, przekierowanie wszystkich tras na `index.html` (routing po stronie klienta) i długi cache dla `/assets/*`. W Vercelu: **Add New → Project → Import** tego repozytorium, bez zmiany ustawień (Root Directory zostaje pusty). Po wdrożeniu test silnika na danym urządzeniu: `/dev/engine`.
