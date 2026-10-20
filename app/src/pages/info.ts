// Strony informacyjne (krok 8): /how-to, /licenses i stopka stron (05, sekcje 5 i 7; brief 00, sekcja 7).
// Treść /how-to napisał Claude Code (proj), do akceptacji użytkownika.

const steps: [string, string][] = [
  ['Wczytaj zdjęcie', `Na dole płótna kliknij <b>Wczytaj</b> albo przeciągnij plik na płótno. Możesz też zostać przy zdjęciu roboczym z listy obok.
    Zdjęcie nie opuszcza Twojego komputera: wszystko liczy się w przeglądarce. Większe niż 3000 px po dłuższym boku zmniejszamy do 3000 px.`],
  ['Wybierz styl', `Style są w lewym panelu, pogrupowane w kategorie; pole nad listą szuka po nazwie. Wszystkie efekty, także te „wkrótce”,
    są na stronie <a href="/effects">Efekty</a>. Na wąskim ekranie (telefon) lewego panelu nie ma: styl wybierasz listą w zakładce <b>Styl</b>.`],
  ['Ustaw parametry', `Prawy panel, zakładka <b>Styl</b>. Na wierzchu są najważniejsze suwaki, w części <b>Więcej</b> ustawienia dokładne.
    Styl z losowością ma <b>Seed</b>: ten sam seed daje ten sam wynik, a przycisk <b>Losuj</b> na dole płótna wybiera nowy.`],
  ['Dopracuj', `Zakładki w pionowym pasku po prawej (na telefonie: w rzędzie pod płótnem):
    <ul>
      <li><b>Lights</b>: do 4 świateł, które rozjaśniają lub barwią obraz przed stylem (gęstsze znaki, większe kropki).</li>
      <li><b>Color</b>: presety, filtr zdjęcia, nasycenie, odcień, mapa gradientu, Levels i Curves na gotowym obrazie.</li>
      <li><b>Post FX</b>: 16 efektów nakładanych w stałej kolejności (od góry listy do dołu), m.in. bloom, scan lines, halftone.</li>
      <li><b>Tekst</b>: do 4 napisów na wierzchu. Przeciągnij napis na płótnie, żeby go przesunąć.</li>
      <li><b>Kadr</b>: proporcje (1:1, 4:5, 16:9…) albo dowolny prostokąt.</li>
    </ul>`],
  ['Pobierz', `Przycisk <b>Eksport</b>: PNG (z przezroczystością, jeśli tło stylu jest ustawione na „None”) albo JPG, w rozmiarze @1x lub @2x.
    Eksport to ten sam obraz co podgląd, tylko w pełnej rozdzielczości.`],
];
const keys: [string, string][] = [
  ['Ctrl+Z / Ctrl+Shift+Z', 'cofnij / ponów (na Macu Cmd)'],
  ['Ctrl + kółko myszy', 'powiększenie płótna; powiększony obraz przesuwasz przeciągając'],
  ['Strzałki (Shift: ×5)', 'przesuwają zaznaczone światło, napis lub kadr'],
  ['Delete', 'usuwa zaznaczone światło lub napis'],
];

export const howToHtml = () => `
  <p class="label">/jak-używać</p>
  <h1 tabindex="-1">Jak używać</h1>
  <div class="prose">
    <p>Edytor zamienia zdjęcie w grafikę ASCII, siatkę kształtów, druk albo piksele. Pięć kroków:</p>
    ${steps.map(([h, body], i) => `<section class="howto-step"><h2><span class="label">/krok ${i + 1}</span> ${h}</h2><p>${body}</p></section>`).join('')}
    <section class="howto-step"><h2><span class="label">/skróty</span> Klawiatura</h2>
      <dl class="howto-keys">${keys.map(([k, d]) => `<dt><kbd>${k}</kbd></dt><dd>${d}</dd>`).join('')}</dl></section>
    <p><a class="btn-outline" href="/editor">Otwórz edytor</a></p>
  </div>`;

// ---------- licencje ----------
const CODE: [string, string, string][] = [
  ['ascii.rest (bas3line), MIT', 'strona Logo: usuwanie tła, styl logo i shade, plik .ts z błyskiem i skanem; strona Wideo: trzy sceny przykładowe (alpine dawn, ocean sunset, misty forest)', 'ascii.rest-MIT.txt'],
  ['gifenc (Matt DesLauriers), MIT', 'eksport GIF', 'MIT-gifenc.txt'],
  ['Mediabunny (Vanilagy), MPL-2.0', 'eksport MP4 i odczyt filmów na stronie Wideo (biblioteka bez zmian, kod źródłowy: github.com/Vanilagy/mediabunny)', 'MPL-2.0-mediabunny.txt'],
];
const FONTS: [string, string, string][] = [
  ['Geist', 'interfejs, warstwa tekstu', 'OFL-1.1-Geist.txt'],
  ['Geist Mono', 'nagłówki, znaki stylu Characters, warstwa tekstu', 'OFL-1.1-Geist-Mono.txt'],
  ['Noto Sans Mono (greka)', 'znaki presetu Math', 'OFL-1.1-Noto-Sans-Mono.txt'],
  ['Noto Sans JP', 'znaki presetu Katakana', 'OFL-1.1-Noto-Sans-JP.txt'],
  ['Playfair Display', 'warstwa tekstu', 'OFL-1.1-Playfair-Display.txt'],
  ['Bebas Neue', 'warstwa tekstu', 'OFL-1.1-Bebas-Neue.txt'],
];
// Pełne teksty licencji z katalogu LICENSES/ repozytorium, ładowane dopiero po otwarciu (osobny plik w buildzie).
const TEXTS = import.meta.glob('../../../LICENSES/*.txt', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;

export const licensesHtml = () => `
  <p class="label">/licencje</p>
  <h1 tabindex="-1">Licencje</h1>
  <div class="prose">
    <p>Silnik efektów i aplikacja to kod własny projektu (poza bibliotekami z sekcji „Kod”); nie zawierają kodu ascii-magic.com.</p>
    <h2>Czcionki</h2>
    <p>Wszystkie czcionki są na licencji SIL Open Font License 1.1 i pochodzą z pakietów npm <code>@fontsource/*</code>.</p>
    ${FONTS.map(([name, use, file]) => `<details class="lic" data-lic="${file}"><summary><b>${name}</b> · ${use}</summary><pre class="lic__text">Ładowanie…</pre></details>`).join('')}
    <h2>Kod</h2>
    ${CODE.map(([name, use, file]) => `<details class="lic" data-lic="${file}"><summary><b>${name}</b> · ${use}</summary><pre class="lic__text">Ładowanie…</pre></details>`).join('')}
    <h2>Podziękowania</h2>
    <p>Strona <a href="/logo">Logo</a> i plik .ts korzystają z kodu projektu <a href="https://ascii.rest" rel="noopener">ascii.rest</a> (bas3line, licencja MIT), a przykłady na stronie <a href="/video">Wideo</a> to trzy sceny z tej biblioteki; błysk i skan efektów ASCII w edytorze to kod własny wzorowany na nim. Zdjęcia przykładowe: Magnific.</p>
  </div>`;
export function mountLicenses(main: HTMLElement) {
  main.addEventListener('toggle', async (e) => {
    const d = e.target as HTMLDetailsElement; if (!d.open || !d.dataset.lic || d.dataset.loaded) return;
    const load = Object.entries(TEXTS).find(([k]) => k.endsWith('/' + d.dataset.lic))?.[1];
    d.querySelector('pre')!.textContent = load ? await load() : 'Brak pliku licencji.'; d.dataset.loaded = '1';
  }, true);
}

export const footerHtml = () => `<footer class="foot">
  <p><span class="foot__brand">ASCII Art Effects</span> · obrazy liczone w przeglądarce, zdjęcia nie są wysyłane na serwer</p>
  <p><a href="/licenses">Licencje</a> · czcionki OFL-1.1 · zdjęcia przykładowe: Magnific · podziękowania: <a href="https://ascii.rest" rel="noopener">ascii.rest</a> (MIT)</p>
</footer>`;
