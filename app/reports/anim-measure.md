Pomiar eksportu animacji (2026-10-20): zdjęcie robocze 1 (photo-01-atrium, 1000×729), pętla 4 s × 24 fps = 96 klatek, 720 px, GIF bez ditheringu z zapisem różnicowym, MP4 na VP9 (headless Chromium). „GIF przed”: pełne klatki, reports/anim-measure-pelne-klatki.md. „Chromium = ffmpeg”: klatki 0, 1, 47, 95 po złożeniu identyczne w obu dekoderach.

| Efekt | Ruch | Wymiary | GIF przed | GIF | Teraz / przed | Czas GIF | MP4 (VP9) | Czas MP4 | Ruch widoczny | Chromium = ffmpeg |
|---|---|---|---|---|---|---|---|---|---|---|
| Characters | glint | 720×525 | 16.2 MB | 1.3 MB | 8% | 5.0 s | 0.9 MB | 3.7 s | tak | tak |
| Block | glint | 720×525 | 10 MB | 0.8 MB | 8% | 5.0 s | 0.7 MB | 3.4 s | tak | tak |
| Dots | glint | 720×525 | 17.6 MB | 1.3 MB | 7% | 6.6 s | 1.0 MB | 5.9 s | tak | tak |
| Mixed | glint | 720×525 | 17.8 MB | 1.2 MB | 7% | 5.9 s | 0.9 MB | 3.9 s | tak | tak |
| Braille | glint | 720×525 | 2.3 MB | 0.2 MB | 10% | 8.3 s | 0.6 MB | 6.3 s | tak | tak |
| Pixel Art | breathe | 720×525 | 5.4 MB | 0.7 MB | 13% | 3.7 s | 1.5 MB | 3.3 s | tak | tak |
| LED Matrix | pulse | 720×525 | 17.5 MB | 10.8 MB | 62% | 13.5 s | 1.6 MB | 11.3 s | tak | tak |
| Dither | flow | 720×525 | 3.2 MB | 0.9 MB | 29% | 7.1 s | 4.6 MB | 4.8 s | tak | tak |
| Risograph | drift | 720×525 | 41.1 MB | 27.8 MB ⚠ | 68% | 40.8 s | 2.9 MB | 35.7 s | tak | tak |
| Engraving | rotate | 720×525 | 21.3 MB | 21.3 MB ⚠ | 100% | 19.7 s | 2.8 MB | 16.9 s | tak | tak |
| Halftone | rotate | 720×525 | 18.9 MB | 18.9 MB | 100% | 15.0 s | 2.4 MB | 12.1 s | tak | tak |
| Cross | glint | 720×525 | 14.2 MB | 1.1 MB | 8% | 8.2 s | 0.9 MB | 7.0 s | tak | tak |
| Diamond | glint | 720×525 | 13.1 MB | 1.0 MB | 8% | 5.8 s | 0.9 MB | 4.0 s | tak | tak |
| Lines | glint | 720×525 | 7.8 MB | 0.7 MB | 9% | 5.5 s | 0.7 MB | 3.9 s | tak | tak |
| Diagonal | glint | 720×525 | 17.9 MB | 1.4 MB | 8% | 5.9 s | 1.1 MB | 5.1 s | tak | tak |
| Twirl | oscillate | 720×525 | 28 MB | 16.7 MB | 60% | 9.5 s | 1.5 MB | 6.0 s | tak | tak |
| ZigZag | flow | 720×525 | 27.1 MB | 23.1 MB ⚠ | 85% | 8.7 s | 1.8 MB | 5.3 s | tak | tak |
| Ripple | spread | 720×525 | 27.3 MB | 11.7 MB | 43% | 9.2 s | 1.5 MB | 6.3 s | tak | tak |
| CRT Screen | flicker | 720×525 | 25.7 MB | 1.6 MB | 6% | 14.1 s | 0.9 MB | 12.6 s | tak | tak |
| Digital Distortion | jitter | 720×525 | 21.3 MB | 1.1 MB | 5% | 14.4 s | 1.6 MB | 2.7 s | tak | tak |
| RGB Split | pulse | 720×525 | 26.8 MB | 11.9 MB | 44% | 23.7 s | 2.0 MB | 4.8 s | tak | tak |
| Scanline | roll | 720×525 | 27.1 MB | 14.6 MB | 54% | 5.6 s | 1.8 MB | 2.4 s | tak | tak |
| Disco | hue | 720×525 | 4.2 MB | 1.7 MB | 40% | 4.7 s | 1.2 MB | 2.7 s | tak | tak |
| Fluted Glass | slide | 720×525 | 26.1 MB | 21.7 MB ⚠ | 83% | 10.5 s | 1.6 MB | 7.0 s | tak | tak |
| Waves | flow | 720×525 | 28.2 MB | 24.3 MB ⚠ | 86% | 10.5 s | 1.7 MB | 6.7 s | tak | tak |

25 efektów; błędy strony: brak. ⚠ = ponad 20 MB (próg ostrzeżenia w oknie eksportu).
