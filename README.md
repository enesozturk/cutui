# CutUI POC

A fast, client-side proof of concept for extracting pixel-faithful UI assets from screenshots.

## Run locally

```bash
python3 -m http.server 4173 --directory dist
```

Then open <http://localhost:4173>.

## How it works

1. Drop or paste a UI screenshot.
2. Drag a rectangle around one component, leaving a little surrounding background.
3. CutUI estimates a simple bilinear background from the selection corners.
4. A border-connected flood fill removes only matching outside pixels.
5. Only border-connected background pixels receive a smooth alpha; interior text, icons, and fills keep their original RGB values byte-for-byte.

Everything runs with Canvas APIs in the browser. There is no backend, model inference, upload, or API cost.

## POC limits

- Best on flat or softly graded backgrounds.
- Complex images, noise, glassmorphism, and backdrop blur are intentionally out of scope.
- The output is a transparent PNG, not an editable Figma component.
