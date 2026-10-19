# Third-party notices

## Fonts

The web app (`app/`) bundles these fonts from npm into its build output (`app/dist/assets/*.woff2`, `*.woff`).
All are licensed under the SIL Open Font License 1.1.

| Font | npm package | Version | Used for | Copyright | Full text |
|---|---|---|---|---|---|
| Geist | `@fontsource/geist` | 5.3.0 | UI text, text layer | 2024 The Geist Project Authors (https://github.com/vercel/geist-font) | [`LICENSES/OFL-1.1-Geist.txt`](LICENSES/OFL-1.1-Geist.txt) |
| Geist Mono | `@fontsource/geist-mono` | 5.3.0 | UI headings, Characters glyphs, text layer | 2024 The Geist Project Authors (https://github.com/vercel/geist-font) | [`LICENSES/OFL-1.1-Geist-Mono.txt`](LICENSES/OFL-1.1-Geist-Mono.txt) |
| Noto Sans Mono (Greek subset) | `@fontsource/noto-sans-mono` | 5.3.0 | Characters glyphs: Greek (Math preset) | 2022 The Noto Project Authors (https://github.com/notofonts/latin-greek-cyrillic) | [`LICENSES/OFL-1.1-Noto-Sans-Mono.txt`](LICENSES/OFL-1.1-Noto-Sans-Mono.txt) |
| Noto Sans JP | `@fontsource/noto-sans-jp` | 5.3.1 | Characters glyphs: halfwidth katakana (Katakana preset) | Google Inc. | [`LICENSES/OFL-1.1-Noto-Sans-JP.txt`](LICENSES/OFL-1.1-Noto-Sans-JP.txt) |
| Playfair Display | `@fontsource/playfair-display` | 5.3.0 | Text layer | 2017 The Playfair Display Project Authors (https://github.com/clauseggers/Playfair-Display), Reserved Font Name "Playfair Display" | [`LICENSES/OFL-1.1-Playfair-Display.txt`](LICENSES/OFL-1.1-Playfair-Display.txt) |
| Bebas Neue | `@fontsource/bebas-neue` | 5.3.0 | Text layer | 2019 The Bebas Neue Project Authors (https://github.com/dharmatype/Bebas-Neue) | [`LICENSES/OFL-1.1-Bebas-Neue.txt`](LICENSES/OFL-1.1-Bebas-Neue.txt) |

## Code libraries

| Library | npm package | Version | Used for | Copyright | License |
|---|---|---|---|---|---|
| gifenc | `gifenc` | 1.0.3 | GIF export of animations (`app/src/engine/gif.ts`, runs in the Web Worker) | 2017 Matt DesLauriers | MIT, [`LICENSES/MIT-gifenc.txt`](LICENSES/MIT-gifenc.txt) |
| Mediabunny | `mediabunny` | 1.61.0 | MP4 export of animations (`app/src/engine/mp4.ts`, loaded on demand in the Web Worker; WebCodecs encoding and MP4 muxing) | Vanilagy and contributors | MPL-2.0, [`LICENSES/MPL-2.0-mediabunny.txt`](LICENSES/MPL-2.0-mediabunny.txt). Used unmodified from npm; source code: https://github.com/Vanilagy/mediabunny |

## Code adapted from other projects

| Project | Files in this repository | Used for | Copyright | License |
|---|---|---|---|---|
| ascii.rest (`github.com/bas3line/ascii`, commit `8fd792e`) | `engine/src/logo/logo.ts`, `engine/src/logo/logo-file.ts`, `engine/src/logo/piece-types.ts`, `app/src/logo/source.ts` (ported, header in each file); `engine/scripts/gen-logo-glyphs.ts` (method) | The /logo page: background removal, the "logo" style (character matched to the edge through each cell), the "shade" style, colours, and the library-format `.ts` file with its glint and scan. The glint and scan of the editor's ASCII effects and the SVG export are our own code following the same behaviour. | 2026 bas3line (https://github.com/bas3line) | MIT, [`LICENSES/ascii.rest-MIT.txt`](LICENSES/ascii.rest-MIT.txt) |

The character shapes for the "logo" style (`engine/src/logo/glyphs.json`) are measured from IBM Plex Mono (`@fontsource/ibm-plex-mono` 5.3.0, SIL Open Font License 1.1, Copyright 2017 IBM Corp.) by a build-time script using `opentype.js` 1.3.4 (MIT); the font itself is not bundled with the app. Both are development dependencies of `engine/`.
