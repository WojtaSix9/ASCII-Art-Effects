# ASCII Art Effects

Narzędzie w przeglądarce do nakładania efektów ASCII i pikselowych na zdjęcia (v1: eksport PNG). Działa bez serwera.

## Układ repozytorium

| Katalog | Zawartość |
|---|---|
| `docs/` | Specyfikacja. Zacznij od `00-brief-dla-claude-code.md`. `docs/v2/`: moduł scen (wersja 2). `docs/archive/`: nieaktualne wersje. |
| `engine/` | Silnik efektów: czysty TypeScript na buforach RGBA, bez DOM. Osobny pakiet z testami w Node (opis: `docs/06-silnik-efektow.md`). |
| `app/` | Strona (Vite + TypeScript, bez frameworka UI). Silnik będzie importowany wprost z `../engine/src` (krok 2). |
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
```
