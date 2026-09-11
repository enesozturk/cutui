# CutUI POC

A fast, client-side proof of concept for extracting pixel-faithful UI assets from screenshots.

## Run locally

```bash
python3 -m http.server 4173 --directory dist
```

Then open <http://localhost:4173>.

## How it works

1. Drop, choose, or paste a UI screenshot.
2. CutUI selects the full screenshot and extracts it automatically; drag a rectangle only when you want a smaller area.
3. It estimates the canvas color from the selection border and removes only background-connected pixels.
4. Connected shadows are hard-cut while crisp 1–2 px UI borders are protected; foreground RGB values are never regenerated or compressed.
5. Element detection runs on a bounded analysis copy, then crops exports from the full-resolution result. Large screenshots stay fast without lowering asset quality.

Everything runs with Canvas APIs in the browser. There is no backend, model inference, upload, or API cost.

## Downloads

- **Single PNG:** the complete selected composition as one transparent image.
- **ZIP:** detected connected UI surfaces and grouped text/icon lines as separate transparent PNG files.

Low-contrast, wide containers such as white banners and pill inputs are recovered from their original border geometry so their fill remains intact in both the single PNG and ZIP exports. Incomplete elements that touch a screenshot edge remain visible in the single PNG but are omitted from the ZIP.

The full screenshot is selected by default, and single PNG output preserves the exact selection frame with no automatic trim or padding. This keeps edge elements and their relative positions intact.

## POC limits

- Best on flat or softly graded backgrounds.
- Complex images, noise, glassmorphism, and backdrop blur are intentionally out of scope.
- The output is a transparent PNG, not an editable Figma component.
