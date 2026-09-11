# CutUI visual QA

Seven supplied screenshots were processed through the real browser app. Every board contains the input, the combined transparent PNG composited on the detected input background, and every ZIP item composited on that same background.

| Fixture | Background | ZIP items | Browser time | Result |
| --- | --- | ---: | ---: | --- |
| Dark cards | `rgb(10,10,10)` | 4 | 993 ms | Four complete cards preserved; the card clipped by the source screenshot is intentionally excluded from ZIP. |
| Dark design system | `rgb(10,10,10)` | 12 | 1,570 ms | Complete cards, controls, navigation groups, hero text and buttons separated; clipped bottom fragments and thin-rule false positives excluded. |
| Notes table | `rgb(255,255,255)` | 13 | 1,024 ms | Search/sort/view controls, tabs and three complete rows retained with pale borders. |
| Profile form | `rgb(255,255,255)` | 10 | 1,270 ms | Three large form panels plus sidebar navigation groups retained; low-contrast borders remain crisp. |
| Charts | `rgb(254,254,254)` | 2 | 1,112 ms | Both complete chart panels retained; the partial panel at the screenshot edge is excluded from ZIP. |
| Dashboard | `rgb(255,255,255)` | 19 | 1,026 ms | Header controls and all eleven complete metric cards separated cleanly. |
| Assistant | `rgb(255,255,255)` | 8 | 670 ms | Heading, bordered input, and six complete prompt chips retained; drop shadow removed. |

## Findings

- Combined PNG dimensions match the input dimensions in all seven cases. No alpha-bound trimming or added padding is used.
- Foreground pixels are copied from the input canvas without resampling. Element detection uses a bounded analysis copy only to find rectangles; ZIP crops come from the full-resolution result.
- The crisp-edge guard retains light one-pixel borders while background-connected shadow ramps are removed.
- The final grouping pass ignores clipped edge fragments, very small corner artifacts, and long separator rules instead of exporting them as standalone assets.
- This POC is deliberately optimized for flat UI screenshots. Photography, noisy textures, glassmorphism, and arbitrary gradients remain outside the guaranteed scope.
