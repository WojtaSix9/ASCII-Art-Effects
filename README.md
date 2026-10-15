# ASCII Art Effects

Narzędzie w przeglądarce do nakładania efektów ASCII i pikselowych na zdjęcia (v1: eksport PNG). Działa bez serwera.

## Układ repozytorium

| Katalog | Zawartość |
|---|---|
| `docs/` | Specyfikacja. Zacznij od `00-brief-dla-claude-code.md`. `07-lights-projekt.md`: projekt i stan Lights. `docs/v2/`: moduł scen (wersja 2). `docs/archive/`: nieaktualne wersje. |
| `engine/` | Silnik efektów: czysty TypeScript na buforach RGBA, bez DOM. Osobny pakiet z testami w Node (opis: `docs/06-silnik-efektow.md`). |
| `app/` | Strona (Vite + TypeScript, bez frameworka UI). Importuje silnik wprost z `../engine/src` i uruchamia go w Web Workerze (`app/src/engine/`). |
| `LICENSES/`, `THIRD_PARTY_NOTICES.md` | Licencje zależności dołączanych do buildu (czcionki). |

## Polecenia

Wymaga Node 22.18 lub nowszego (uruchamia pliki `.ts` bezpośrednio, bez flag). Testy przeglądarkowe potrzebują Chromium z Playwright: na nowej maszynie raz `cd app && npx playwright install chromium`.

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
npm run test:ui                     # hero, kafelki, miniatury, panel parametrów w edytorze
npm run test:editor                 # edytor: panel stylów, cofnij/ponów, Color, Post FX, zoom, eksport PNG/JPG, własne zdjęcie
npm run test:a11y                   # audyt dostępności (axe-core, WCAG 2.1 AA) stron i edytora
npm run thumbs                      # wygeneruj miniatury efektów do public/thumbs/ (po npm run build)
npm run fixtures                    # odśwież oczekiwane skróty z Node po zmianie silnika
```

Stronę `/dev/engine` można też otworzyć ręcznie w dowolnej przeglądarce (np. Safari na iPhonie), żeby sprawdzić silnik na danym urządzeniu.

## Zdjęcia robocze i miniatury

Dwa zdjęcia robocze, używane naprzemiennie: `app/public/sample/photo-1.jpg` i `photo-2.jpg`, konfiguracja (opis, punkt kadrowania) w `app/src/config/sample.ts`. Hero bierze zdjęcie 2, edytor ma przełącznik (`?sample=1|2`), miniatury efektów idą na zmianę.

Miniatury: `app/public/thumbs/<id>.webp` (960×668) i `manifest.json`. Po podmianie zdjęcia: `npm run build && npm run thumbs` (Chromium przez Playwright) albo ręcznie: otwórz `/dev/thumbs`, pobierz `thumbs.zip` i rozpakuj do `app/public/thumbs/`. `npm run test:ui` sprawdza, czy miniatury pasują do bieżących zdjęć.

## Deploy (Vercel)

`vercel.json` w katalogu głównym ustawia wszystko: instalację i build w `app/`, katalog wyjściowy `app/dist`, przekierowanie wszystkich tras na `index.html` (routing po stronie klienta) i długi cache dla `/assets/*`. W Vercelu: **Add New → Project → Import** tego repozytorium, bez zmiany ustawień (Root Directory zostaje pusty). Po wdrożeniu test silnika na danym urządzeniu: `/dev/engine`.

## Kontynuacja pracy na innej maszynie

Cały stan jest w repozytorium (gałąź robocza `claude/happy-bell-5qulv1`), nic nie zostaje tylko w sesji w chmurze.

```sh
git clone <adres repozytorium> && cd ASCII-Art-Effects
git checkout claude/happy-bell-5qulv1
(cd engine && npm ci && node scripts/check-engine.ts)
(cd app && npm ci && npx playwright install chromium && npm run build && npm run smoke)
```

Dziennik prac, decyzji i stanu: `docs/06-silnik-efektow.md` (sekcje 7–16 i dalsze). Lista efektów i ich status: `engine/src/data/effects.json` (`ready` / `soon`). Vercel buduje z GitHuba (`vercel.json`), niezależnie od miejsca pracy.

