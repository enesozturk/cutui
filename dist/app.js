(() => {
  "use strict";

  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const MAX_IMAGE_PIXELS = 8_000_000;
  const MAX_SELECTION_PIXELS = MAX_IMAGE_PIXELS;
  const MIN_SELECTION = 12;

  const elements = {
    uploadView: document.querySelector("#upload-view"),
    editorView: document.querySelector("#editor-view"),
    dropZone: document.querySelector("#drop-zone"),
    fileInput: document.querySelector("#file-input"),
    chooseButton: document.querySelector("#choose-button"),
    sampleButton: document.querySelector("#sample-button"),
    newImageButton: document.querySelector("#new-image-button"),
    resetSelectionButton: document.querySelector("#reset-selection-button"),
    sourceCanvas: document.querySelector("#source-canvas"),
    selectionStatus: document.querySelector("#selection-status"),
    resultCanvas: document.querySelector("#result-canvas"),
    emptyResult: document.querySelector("#empty-result"),
    resultSize: document.querySelector("#result-size"),
    pickBackgroundButton: document.querySelector("#pick-background-button"),
    autoBackgroundButton: document.querySelector("#auto-background-button"),
    backgroundSwatch: document.querySelector("#background-swatch"),
    backgroundValue: document.querySelector("#background-value"),
    strength: document.querySelector("#strength-control"),
    strengthValue: document.querySelector("#strength-value"),
    removeShadows: document.querySelector("#shadow-control"),
    padding: document.querySelector("#padding-control"),
    paddingValue: document.querySelector("#padding-value"),
    extractButton: document.querySelector("#extract-button"),
    downloadButton: document.querySelector("#download-button"),
    downloadZipButton: document.querySelector("#download-zip-button"),
    copyButton: document.querySelector("#copy-button"),
    status: document.querySelector("#status"),
  };

  const sourceContext = elements.sourceCanvas.getContext("2d", { willReadFrequently: true });
  const resultContext = elements.resultCanvas.getContext("2d");

  let sourceImage = null;
  let sourceName = "ui-asset";
  let selection = null;
  let dragStart = null;
  let latestBlob = null;
  let toastTimer = null;
  let loadVersion = 0;
  let manualBackground = null;
  let pickingBackground = false;
  let detectedElements = [];
  let latestOriginalCanvas = null;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function safeBaseName(name) {
    return name
      .replace(/\.[^.]+$/, "")
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80) || "ui-asset";
  }

  function showStatus(message, duration = 2800) {
    window.clearTimeout(toastTimer);
    elements.status.textContent = message;
    elements.status.hidden = false;
    toastTimer = window.setTimeout(() => {
      elements.status.hidden = true;
    }, duration);
  }

  function openPicker() {
    elements.fileInput.click();
  }

  function validateAndLoadFile(file) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      showStatus("Choose a PNG, JPG, or WebP image.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      showStatus("This image is over 10 MB. Choose a smaller file.");
      return;
    }

    const url = URL.createObjectURL(file);
    sourceName = safeBaseName(file.name);
    loadImage(url, () => URL.revokeObjectURL(url));
  }

  function loadImage(url, onComplete, suggestedSelection = null) {
    const currentLoad = ++loadVersion;
    const image = new Image();
    image.onload = () => {
      if (currentLoad !== loadVersion) {
        if (onComplete) onComplete();
        return;
      }
      if (image.naturalWidth * image.naturalHeight > MAX_IMAGE_PIXELS) {
        showStatus("This image is too large. Use an image under 8 megapixels.", 4200);
        if (onComplete) onComplete();
        return;
      }
      sourceImage = image;
      manualBackground = null;
      pickingBackground = false;
      renderBackgroundControl();
      elements.sourceCanvas.width = image.naturalWidth;
      elements.sourceCanvas.height = image.naturalHeight;

      selection = suggestedSelection || {
        x: 0,
        y: 0,
        width: image.naturalWidth,
        height: image.naturalHeight,
      };

      clearResult();
      drawSource();
      elements.uploadView.hidden = true;
      elements.editorView.hidden = false;
      elements.editorView.scrollIntoView({ behavior: "smooth", block: "start" });
      elements.sourceCanvas.focus({ preventScroll: true });
      showStatus("Image ready — the full screenshot is selected.");
      if (onComplete) onComplete();
    };
    image.onerror = () => {
      if (currentLoad !== loadVersion) {
        if (onComplete) onComplete();
        return;
      }
      showStatus("That image could not be opened.");
      if (onComplete) onComplete();
    };
    image.src = url;
  }

  function loadSample() {
    sourceName = "cutui-sample-card";
    const sample = `
      <svg xmlns="http://www.w3.org/2000/svg" width="1400" height="900" viewBox="0 0 1400 900">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#e7eeff"/>
            <stop offset="1" stop-color="#dff8ef"/>
          </linearGradient>
          <filter id="shadow" x="-30%" y="-30%" width="160%" height="180%">
            <feDropShadow dx="0" dy="30" stdDeviation="32" flood-color="#284239" flood-opacity=".20"/>
          </filter>
        </defs>
        <rect width="1400" height="900" fill="url(#bg)"/>
        <circle cx="170" cy="130" r="92" fill="#d8e4ff" opacity=".75"/>
        <circle cx="1240" cy="760" r="170" fill="#cef1e4" opacity=".8"/>
        <g filter="url(#shadow)">
          <rect x="330" y="175" width="740" height="550" rx="38" fill="#ffffff"/>
        </g>
        <rect x="382" y="227" width="58" height="58" rx="17" fill="#121515"/>
        <path d="M400 256h22m-11-11v22" stroke="#b9ff66" stroke-width="4" stroke-linecap="round"/>
        <text x="382" y="338" font-family="Arial, sans-serif" font-size="46" font-weight="700" fill="#151918">Launch your next idea</text>
        <text x="382" y="385" font-family="Arial, sans-serif" font-size="22" fill="#69726f">A sample product card made for clean extraction.</text>
        <rect x="382" y="438" width="636" height="76" rx="18" fill="#f3f6f4" stroke="#dde3e0"/>
        <text x="410" y="484" font-family="Arial, sans-serif" font-size="20" fill="#8a928f">name@company.com</text>
        <rect x="382" y="550" width="226" height="74" rx="18" fill="#b9ff66"/>
        <text x="425" y="596" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#172014">Create workspace</text>
        <text x="382" y="674" font-family="Arial, sans-serif" font-size="16" fill="#929996">No credit card required</text>
      </svg>`;
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sample)}`;
    loadImage(url, null, { x: 265, y: 105, width: 870, height: 690 });
  }

  function drawSource() {
    if (!sourceImage) return;
    const canvas = elements.sourceCanvas;
    sourceContext.clearRect(0, 0, canvas.width, canvas.height);
    sourceContext.drawImage(sourceImage, 0, 0);

    if (!selection) return;
    const { x, y, width, height } = selection;
    sourceContext.save();
    sourceContext.fillStyle = "rgba(13, 18, 16, 0.48)";
    sourceContext.beginPath();
    sourceContext.rect(0, 0, canvas.width, canvas.height);
    sourceContext.rect(x, y, width, height);
    sourceContext.fill("evenodd");

    const scale = canvas.width / Math.max(canvas.getBoundingClientRect().width, 1);
    sourceContext.strokeStyle = "#b9ff66";
    sourceContext.lineWidth = Math.max(2, 2 * scale);
    sourceContext.setLineDash([8 * scale, 5 * scale]);
    sourceContext.strokeRect(x, y, width, height);
    sourceContext.setLineDash([]);

    const handleSize = 8 * scale;
    sourceContext.fillStyle = "#b9ff66";
    [[x, y], [x + width, y], [x, y + height], [x + width, y + height]].forEach(([hx, hy]) => {
      sourceContext.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
    });
    sourceContext.restore();
    elements.selectionStatus.textContent = `Selection: ${Math.round(width)} by ${Math.round(height)} pixels, starting at ${Math.round(x)}, ${Math.round(y)}.`;
  }

  function pointFromEvent(event) {
    const rect = elements.sourceCanvas.getBoundingClientRect();
    return {
      x: clamp((event.clientX - rect.left) * (elements.sourceCanvas.width / rect.width), 0, elements.sourceCanvas.width),
      y: clamp((event.clientY - rect.top) * (elements.sourceCanvas.height / rect.height), 0, elements.sourceCanvas.height),
    };
  }

  function normalizedSelection(start, end) {
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    return {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(Math.abs(end.x - start.x)),
      height: Math.round(Math.abs(end.y - start.y)),
    };
  }

  function resetSelection() {
    if (!sourceImage) return;
    selection = {
      x: 0,
      y: 0,
      width: sourceImage.naturalWidth,
      height: sourceImage.naturalHeight,
    };
    clearResult();
    drawSource();
  }

  function clearResult() {
    latestBlob = null;
    elements.resultCanvas.width = 1;
    elements.resultCanvas.height = 1;
    elements.resultCanvas.style.display = "none";
    elements.emptyResult.hidden = false;
    elements.resultSize.textContent = "Waiting for extraction";
    elements.downloadButton.disabled = true;
    elements.downloadZipButton.disabled = true;
    elements.downloadZipButton.textContent = "Download ZIP";
    elements.copyButton.disabled = true;
    detectedElements = [];
    latestOriginalCanvas = null;
  }

  function estimateDominantBorder(imageData) {
    const { width, height, data } = imageData;
    const strip = clamp(Math.floor(Math.min(width, height) * 0.025), 2, 12);
    const counts = new Uint32Array(4096);
    const red = new Float64Array(4096);
    const green = new Float64Array(4096);
    const blue = new Float64Array(4096);

    const forEachBorderPixel = (callback) => {
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          if (x >= strip && x < width - strip && y >= strip && y < height - strip) {
            x = width - strip - 1;
            continue;
          }
          const index = (y * width + x) * 4;
          callback(data[index], data[index + 1], data[index + 2]);
        }
      }
    };

    forEachBorderPixel((r, g, b) => {
      const bin = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      counts[bin] += 1;
      red[bin] += r;
      green[bin] += g;
      blue[bin] += b;
    });

    let dominant = 0;
    for (let bin = 1; bin < counts.length; bin += 1) {
      if (counts[bin] > counts[dominant]) dominant = bin;
    }

    const count = Math.max(1, counts[dominant]);
    const firstPass = [red[dominant] / count, green[dominant] / count, blue[dominant] / count];
    const refined = [0, 0, 0];
    let refinedCount = 0;
    forEachBorderPixel((r, g, b) => {
      const dr = r - firstPass[0];
      const dg = g - firstPass[1];
      const db = b - firstPass[2];
      if (Math.sqrt(dr * dr + dg * dg + db * db) > 26) return;
      refined[0] += r;
      refined[1] += g;
      refined[2] += b;
      refinedCount += 1;
    });

    if (refinedCount === 0) return firstPass;
    return refined.map((channel) => channel / refinedCount);
  }

  function colorDistance(data, index, background) {
    const r = data[index] - background[0];
    const g = data[index + 1] - background[1];
    const b = data[index + 2] - background[2];
    return Math.sqrt(r * r + g * g + b * b);
  }

  function buildMask(imageData, strength, removeShadows, backgroundOverride = null) {
    const { width, height, data } = imageData;
    const backgroundColor = backgroundOverride || estimateDominantBorder(imageData);
    // Shadows are background-connected, so a modest extra margin removes the
    // soft outer falloff without letting the flood fill cross strong component
    // edges into pale UI surfaces.
    const floodThreshold = removeShadows ? Math.min(120, strength + 16) : strength;
    const status = new Uint8Array(width * height);
    const queue = new Int32Array(width * height);
    let queueStart = 0;
    let queueEnd = 0;

    const visit = (pixelIndex) => {
      if (status[pixelIndex] !== 0) return;
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);
      const dataIndex = pixelIndex * 4;
      if (colorDistance(data, dataIndex, backgroundColor) <= floodThreshold) {
        status[pixelIndex] = 2;
        queue[queueEnd] = pixelIndex;
        queueEnd += 1;
      } else {
        status[pixelIndex] = 1;
      }
    };

    for (let x = 0; x < width; x += 1) {
      visit(x);
      visit((height - 1) * width + x);
    }
    for (let y = 1; y < height - 1; y += 1) {
      visit(y * width);
      visit(y * width + width - 1);
    }

    while (queueStart < queueEnd) {
      const pixelIndex = queue[queueStart];
      queueStart += 1;
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);
      if (x > 0) visit(pixelIndex - 1);
      if (x < width - 1) visit(pixelIndex + 1);
      if (y > 0) visit(pixelIndex - width);
      if (y < height - 1) visit(pixelIndex + width);
    }

    // Only pixels reached from the crop's outer border may become transparent.
    // All enclosed UI pixels keep their original RGB values byte-for-byte.
    // This avoids the bright/dark speckling that color decontamination creates
    // around antialiased type and fine icons.
    const noiseFloor = Math.max(2.5, strength * 0.12);
    for (let pixelIndex = 0; pixelIndex < status.length; pixelIndex += 1) {
      if (status[pixelIndex] !== 2) continue;
      const dataIndex = pixelIndex * 4;
      if (removeShadows) {
        data[dataIndex + 3] = 0;
        continue;
      }
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);
      const distance = colorDistance(data, dataIndex, backgroundColor);
      if (distance <= noiseFloor) {
        data[dataIndex + 3] = 0;
        continue;
      }

      const position = clamp((distance - noiseFloor) / Math.max(1, strength - noiseFloor), 0, 1);
      const smoothAlpha = position * position * (3 - 2 * position);
      data[dataIndex + 3] = Math.round(smoothAlpha * 255);
    }

    return imageData;
  }

  function frameAndPad(imageData, padding) {
    const { width, height, data } = imageData;
    let hasForeground = false;
    for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex += 1) {
      if (data[pixelIndex * 4 + 3] <= 2) continue;
      hasForeground = true;
      break;
    }
    if (!hasForeground) return null;

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = width;
    tempCanvas.height = height;
    tempCanvas.getContext("2d").putImageData(imageData, 0, 0);

    const output = document.createElement("canvas");
    output.width = width + padding * 2;
    output.height = height + padding * 2;
    const outputContext = output.getContext("2d");
    outputContext.imageSmoothingEnabled = false;
    outputContext.drawImage(tempCanvas, padding, padding);
    return {
      canvas: output,
      sourceX: 0,
      sourceY: 0,
      sourceWidth: width,
      sourceHeight: height,
      padding,
    };
  }

  function detectLowContrastContainers(canvas, backgroundColor, strength) {
    if (!canvas || !backgroundColor) return [];
    const scale = Math.min(1, 1400 / Math.max(canvas.width, canvas.height));
    const width = Math.max(1, Math.round(canvas.width * scale));
    const height = Math.max(1, Math.round(canvas.height * scale));
    const analysisCanvas = document.createElement("canvas");
    analysisCanvas.width = width;
    analysisCanvas.height = height;
    const context = analysisCanvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(canvas, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height).data;
    const binary = new Uint8Array(width * height);
    const horizontal = new Uint8Array(width * height);
    const dilated = new Uint8Array(width * height);
    const threshold = Math.max(4, Math.min(12, strength * 0.34));
    const radius = 2;

    for (let pixelIndex = 0; pixelIndex < binary.length; pixelIndex += 1) {
      if (pixels[pixelIndex * 4 + 3] === 0) continue;
      if (colorDistance(pixels, pixelIndex * 4, backgroundColor) > threshold) binary[pixelIndex] = 1;
    }

    for (let y = 0; y < height; y += 1) {
      let count = 0;
      for (let x = 0; x < width; x += 1) {
        if (x + radius < width) count += binary[y * width + x + radius];
        if (x - radius - 1 >= 0) count -= binary[y * width + x - radius - 1];
        if (count > 0) horizontal[y * width + x] = 1;
      }
    }
    for (let x = 0; x < width; x += 1) {
      let count = 0;
      for (let y = 0; y < height; y += 1) {
        if (y + radius < height) count += horizontal[(y + radius) * width + x];
        if (y - radius - 1 >= 0) count -= horizontal[(y - radius - 1) * width + x];
        if (count > 0) dilated[y * width + x] = 1;
      }
    }

    const visited = new Uint8Array(width * height);
    const queue = new Int32Array(width * height);
    const containers = [];
    for (let start = 0; start < visited.length; start += 1) {
      if (visited[start] || !dilated[start]) continue;
      let queueStart = 0;
      let queueEnd = 0;
      let minX = width;
      let minY = height;
      let maxX = -1;
      let maxY = -1;
      visited[start] = 1;
      queue[queueEnd++] = start;

      while (queueStart < queueEnd) {
        const pixelIndex = queue[queueStart++];
        const x = pixelIndex % width;
        const y = Math.floor(pixelIndex / width);
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        if (x > 0 && !visited[pixelIndex - 1] && dilated[pixelIndex - 1]) {
          visited[pixelIndex - 1] = 1;
          queue[queueEnd++] = pixelIndex - 1;
        }
        if (x < width - 1 && !visited[pixelIndex + 1] && dilated[pixelIndex + 1]) {
          visited[pixelIndex + 1] = 1;
          queue[queueEnd++] = pixelIndex + 1;
        }
        if (y > 0 && !visited[pixelIndex - width] && dilated[pixelIndex - width]) {
          visited[pixelIndex - width] = 1;
          queue[queueEnd++] = pixelIndex - width;
        }
        if (y < height - 1 && !visited[pixelIndex + width] && dilated[pixelIndex + width]) {
          visited[pixelIndex + width] = 1;
          queue[queueEnd++] = pixelIndex + width;
        }
      }

      const boxWidth = maxX - minX + 1;
      const boxHeight = maxY - minY + 1;
      const aspect = boxWidth / Math.max(1, boxHeight);
      if (
        boxWidth < width * 0.38
        || boxHeight < Math.max(22, height * 0.022)
        || boxHeight > height * 0.2
        || aspect < 4
      ) continue;

      let backgroundPixels = 0;
      let sampledPixels = 0;
      const sampleStep = 3;
      const interiorX = Math.round(boxWidth * 0.06);
      const interiorY = Math.round(boxHeight * 0.14);
      for (let y = minY + interiorY; y <= maxY - interiorY; y += sampleStep) {
        for (let x = minX + interiorX; x <= maxX - interiorX; x += sampleStep) {
          const pixelIndex = y * width + x;
          if (pixels[pixelIndex * 4 + 3] === 0) continue;
          sampledPixels += 1;
          if (colorDistance(pixels, pixelIndex * 4, backgroundColor) <= Math.max(18, strength)) {
            backgroundPixels += 1;
          }
        }
      }
      if (sampledPixels === 0 || backgroundPixels / sampledPixels < 0.58) continue;

      const rawX = clamp(Math.round((minX + radius) / scale), 0, canvas.width - 1);
      const rawY = clamp(Math.round((minY + radius) / scale), 0, canvas.height - 1);
      const rawRight = clamp(Math.round((maxX - radius + 1) / scale), rawX + 1, canvas.width);
      const rawBottom = clamp(Math.round((maxY - radius + 1) / scale), rawY + 1, canvas.height);
      const padding = clamp(Math.round((rawBottom - rawY) * 0.08), 5, 12);
      const x = Math.max(0, rawX - padding);
      const y = Math.max(0, rawY - padding);
      const right = Math.min(canvas.width, rawRight + padding);
      const bottom = Math.min(canvas.height, rawBottom + padding);
      containers.push({
        x,
        y,
        width: right - x,
        height: bottom - y,
        kind: "container",
      });
    }
    return containers;
  }

  function detectUiElements(canvas, originalCanvas = null, backgroundColor = null, strength = 24) {
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const { width, height } = canvas;
    const pixels = context.getImageData(0, 0, width, height).data;
    const visited = new Uint8Array(width * height);
    const queue = new Int32Array(width * height);
    const components = [];
    const alphaThreshold = 10;

    for (let start = 0; start < visited.length; start += 1) {
      if (visited[start] || pixels[start * 4 + 3] <= alphaThreshold) continue;

      let queueStart = 0;
      let queueEnd = 0;
      let minX = width;
      let minY = height;
      let maxX = -1;
      let maxY = -1;
      let pixelCount = 0;
      visited[start] = 1;
      queue[queueEnd++] = start;

      while (queueStart < queueEnd) {
        const pixelIndex = queue[queueStart++];
        const x = pixelIndex % width;
        const y = Math.floor(pixelIndex / width);
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        pixelCount += 1;

        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (dx === 0 && dy === 0) continue;
            const nextX = x + dx;
            const nextY = y + dy;
            if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
            const next = nextY * width + nextX;
            if (visited[next] || pixels[next * 4 + 3] <= alphaThreshold) continue;
            visited[next] = 1;
            queue[queueEnd++] = next;
          }
        }
      }

      if (pixelCount < 3) continue;
      components.push({
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
        pixelCount,
      });
    }

    const totalArea = width * height;
    const large = [];
    const small = [];
    components.forEach((component) => {
      const boxArea = component.width * component.height;
      const isSurface = boxArea > totalArea * 0.0015
        || (component.width > width * 0.12 && component.height > height * 0.055);
      (isSurface ? large : small).push(component);
    });

    // Merge glyphs and small icons that sit on the same visual line. Large
    // connected surfaces remain separate, so adjacent cards never collapse
    // into one ZIP entry.
    const parents = small.map((_, index) => index);
    const find = (index) => {
      let current = index;
      while (parents[current] !== current) {
        parents[current] = parents[parents[current]];
        current = parents[current];
      }
      return current;
    };
    const unite = (a, b) => {
      const rootA = find(a);
      const rootB = find(b);
      if (rootA !== rootB) parents[rootB] = rootA;
    };

    for (let a = 0; a < small.length; a += 1) {
      const first = small[a];
      const firstRight = first.x + first.width;
      const firstBottom = first.y + first.height;
      for (let b = a + 1; b < small.length; b += 1) {
        const second = small[b];
        const secondRight = second.x + second.width;
        const secondBottom = second.y + second.height;
        const overlapY = Math.max(0, Math.min(firstBottom, secondBottom) - Math.max(first.y, second.y));
        const overlapRatio = overlapY / Math.max(1, Math.min(first.height, second.height));
        const centerDifference = Math.abs(
          (first.y + first.height / 2) - (second.y + second.height / 2),
        );
        const sameLine = overlapRatio >= 0.42
          || centerDifference <= Math.max(first.height, second.height) * 0.34;
        if (!sameLine) continue;

        const horizontalGap = Math.max(0, Math.max(first.x, second.x) - Math.min(firstRight, secondRight));
        const allowedGap = Math.max(12, Math.min(42, Math.max(first.height, second.height) * 0.95));
        if (horizontalGap <= allowedGap) unite(a, b);
      }
    }

    const textGroups = new Map();
    small.forEach((component, index) => {
      const root = find(index);
      const existing = textGroups.get(root);
      if (!existing) {
        textGroups.set(root, { ...component });
        return;
      }
      const right = Math.max(existing.x + existing.width, component.x + component.width);
      const bottom = Math.max(existing.y + existing.height, component.y + component.height);
      existing.x = Math.min(existing.x, component.x);
      existing.y = Math.min(existing.y, component.y);
      existing.width = right - existing.x;
      existing.height = bottom - existing.y;
      existing.pixelCount += component.pixelCount;
    });

    const result = [...large, ...textGroups.values()]
      .filter((component) => component.width >= 2 && component.height >= 2)
      .map((component) => {
        const padding = clamp(Math.round(Math.min(component.width, component.height) * 0.08), 4, 12);
        const x = Math.max(0, component.x - padding);
        const y = Math.max(0, component.y - padding);
        const right = Math.min(width, component.x + component.width + padding);
        const bottom = Math.min(height, component.y + component.height + padding);
        return { x, y, width: right - x, height: bottom - y, kind: "masked" };
      });

    const recoveredContainers = detectLowContrastContainers(originalCanvas, backgroundColor, strength);
    const outsideContainers = result.filter((element) => !recoveredContainers.some((container) => {
      const centerX = element.x + element.width / 2;
      const centerY = element.y + element.height / 2;
      if (
        centerX >= container.x
        && centerX <= container.x + container.width
        && centerY >= container.y
        && centerY <= container.y + container.height
      ) return true;
      const overlapWidth = Math.max(0, Math.min(element.x + element.width, container.x + container.width) - Math.max(element.x, container.x));
      const overlapHeight = Math.max(0, Math.min(element.y + element.height, container.y + container.height) - Math.max(element.y, container.y));
      return (overlapWidth * overlapHeight) / Math.max(1, element.width * element.height) > 0.4;
    }));

    result.length = 0;
    result.push(...recoveredContainers, ...outsideContainers);

    result.sort((a, b) => {
      const rowTolerance = Math.max(12, Math.min(a.height, b.height) * 0.35);
      if (Math.abs(a.y - b.y) > rowTolerance) return a.y - b.y;
      return a.x - b.x;
    });
    return result.slice(0, 100);
  }

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let index = 0; index < bytes.length; index += 1) {
      crc ^= bytes[index];
      for (let bit = 0; bit < 8; bit += 1) {
        crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function writeUint16(view, offset, value) {
    view.setUint16(offset, value, true);
  }

  function writeUint32(view, offset, value) {
    view.setUint32(offset, value >>> 0, true);
  }

  function zipTimestamp(date = new Date()) {
    const year = Math.max(1980, date.getFullYear());
    return {
      time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
      date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    };
  }

  function buildStoredZip(files) {
    const encoder = new TextEncoder();
    const localChunks = [];
    const centralChunks = [];
    const stamp = zipTimestamp();
    let localOffset = 0;

    files.forEach((file) => {
      const name = encoder.encode(file.name);
      const bytes = file.bytes;
      const checksum = crc32(bytes);
      const local = new Uint8Array(30 + name.length);
      const localView = new DataView(local.buffer);
      writeUint32(localView, 0, 0x04034b50);
      writeUint16(localView, 4, 20);
      writeUint16(localView, 6, 0x0800);
      writeUint16(localView, 8, 0);
      writeUint16(localView, 10, stamp.time);
      writeUint16(localView, 12, stamp.date);
      writeUint32(localView, 14, checksum);
      writeUint32(localView, 18, bytes.length);
      writeUint32(localView, 22, bytes.length);
      writeUint16(localView, 26, name.length);
      writeUint16(localView, 28, 0);
      local.set(name, 30);
      localChunks.push(local, bytes);

      const central = new Uint8Array(46 + name.length);
      const centralView = new DataView(central.buffer);
      writeUint32(centralView, 0, 0x02014b50);
      writeUint16(centralView, 4, 20);
      writeUint16(centralView, 6, 20);
      writeUint16(centralView, 8, 0x0800);
      writeUint16(centralView, 10, 0);
      writeUint16(centralView, 12, stamp.time);
      writeUint16(centralView, 14, stamp.date);
      writeUint32(centralView, 16, checksum);
      writeUint32(centralView, 20, bytes.length);
      writeUint32(centralView, 24, bytes.length);
      writeUint16(centralView, 28, name.length);
      writeUint16(centralView, 30, 0);
      writeUint16(centralView, 32, 0);
      writeUint16(centralView, 34, 0);
      writeUint16(centralView, 36, 0);
      writeUint32(centralView, 38, 0);
      writeUint32(centralView, 42, localOffset);
      central.set(name, 46);
      centralChunks.push(central);
      localOffset += local.length + bytes.length;
    });

    const centralSize = centralChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);
    writeUint32(endView, 0, 0x06054b50);
    writeUint16(endView, 4, 0);
    writeUint16(endView, 6, 0);
    writeUint16(endView, 8, files.length);
    writeUint16(endView, 10, files.length);
    writeUint32(endView, 12, centralSize);
    writeUint32(endView, 16, localOffset);
    writeUint16(endView, 20, 0);
    return new Blob([...localChunks, ...centralChunks, end], { type: "application/zip" });
  }

  function canvasToPngBytes(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(async (blob) => {
        if (!blob) {
          reject(new Error("PNG encoding failed"));
          return;
        }
        resolve(new Uint8Array(await blob.arrayBuffer()));
      }, "image/png");
    });
  }

  function restoreClosedContainerInterior(canvas, originalCanvas, element) {
    if (!originalCanvas || element.kind !== "container") return;
    const width = canvas.width;
    const height = canvas.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const result = context.getImageData(0, 0, width, height);
    const originalContext = originalCanvas.getContext("2d", { willReadFrequently: true });
    const original = originalContext.getImageData(element.x, element.y, width, height);
    const barrier = new Uint8Array(width * height);
    const sealed = new Uint8Array(width * height);
    const exterior = new Uint8Array(width * height);
    const queue = new Int32Array(width * height);

    for (let pixelIndex = 0; pixelIndex < barrier.length; pixelIndex += 1) {
      if (result.data[pixelIndex * 4 + 3] > 3) barrier[pixelIndex] = 1;
    }

    // Close one-pixel gaps in faint borders so the flood fill cannot leak
    // into a white banner/input whose fill matches the page background.
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const pixelIndex = y * width + x;
        if (barrier[pixelIndex]) {
          sealed[pixelIndex] = 1;
          continue;
        }
        for (let dy = -1; dy <= 1 && !sealed[pixelIndex]; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const nextX = x + dx;
            const nextY = y + dy;
            if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
            if (barrier[nextY * width + nextX]) {
              sealed[pixelIndex] = 1;
              break;
            }
          }
        }
      }
    }

    let queueStart = 0;
    let queueEnd = 0;
    const visit = (pixelIndex) => {
      if (exterior[pixelIndex] || sealed[pixelIndex]) return;
      exterior[pixelIndex] = 1;
      queue[queueEnd++] = pixelIndex;
    };
    for (let x = 0; x < width; x += 1) {
      visit(x);
      visit((height - 1) * width + x);
    }
    for (let y = 1; y < height - 1; y += 1) {
      visit(y * width);
      visit(y * width + width - 1);
    }
    while (queueStart < queueEnd) {
      const pixelIndex = queue[queueStart++];
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);
      if (x > 0) visit(pixelIndex - 1);
      if (x < width - 1) visit(pixelIndex + 1);
      if (y > 0) visit(pixelIndex - width);
      if (y < height - 1) visit(pixelIndex + width);
    }

    let restoredPixels = 0;
    for (let pixelIndex = 0; pixelIndex < exterior.length; pixelIndex += 1) {
      if (exterior[pixelIndex] || original.data[pixelIndex * 4 + 3] === 0) continue;
      const offset = pixelIndex * 4;
      result.data[offset] = original.data[offset];
      result.data[offset + 1] = original.data[offset + 1];
      result.data[offset + 2] = original.data[offset + 2];
      result.data[offset + 3] = original.data[offset + 3];
      restoredPixels += 1;
    }

    // If the source border was too faint to close, fall back to a conservative
    // rounded container mask instead of returning disconnected text fragments.
    if (restoredPixels < width * height * 0.08) {
      const inset = clamp(Math.round(height * 0.055), 4, 12);
      const left = inset;
      const top = inset;
      const right = width - inset;
      const bottom = height - inset;
      const radius = Math.min((bottom - top) / 2, Math.max(12, (bottom - top) * 0.3));
      for (let y = top; y < bottom; y += 1) {
        for (let x = left; x < right; x += 1) {
          const nearestX = clamp(x, left + radius, right - radius);
          const nearestY = clamp(y, top + radius, bottom - radius);
          const dx = x - nearestX;
          const dy = y - nearestY;
          if (dx * dx + dy * dy > radius * radius) continue;
          const offset = (y * width + x) * 4;
          if (original.data[offset + 3] === 0) continue;
          result.data[offset] = original.data[offset];
          result.data[offset + 1] = original.data[offset + 1];
          result.data[offset + 2] = original.data[offset + 2];
          result.data[offset + 3] = original.data[offset + 3];
        }
      }
    }
    context.putImageData(result, 0, 0);
  }

  function restoreDetectedContainersInComposite(canvas, originalCanvas, elementsToRestore) {
    if (!originalCanvas) return;
    const context = canvas.getContext("2d");
    elementsToRestore
      .filter((element) => element.kind === "container")
      .forEach((element) => {
        const restored = document.createElement("canvas");
        restored.width = element.width;
        restored.height = element.height;
        const restoredContext = restored.getContext("2d");
        restoredContext.imageSmoothingEnabled = false;
        restoredContext.drawImage(
          canvas,
          element.x,
          element.y,
          element.width,
          element.height,
          0,
          0,
          element.width,
          element.height,
        );
        restoreClosedContainerInterior(restored, originalCanvas, element);
        context.clearRect(element.x, element.y, element.width, element.height);
        context.drawImage(restored, element.x, element.y);
      });
  }

  async function downloadElementsZip() {
    if (!latestBlob || detectedElements.length === 0) return;
    const originalLabel = elements.downloadZipButton.textContent;
    elements.downloadZipButton.disabled = true;
    elements.downloadZipButton.textContent = "Building ZIP…";

    try {
      const files = [];
      for (let index = 0; index < detectedElements.length; index += 1) {
        const element = detectedElements[index];
        const canvas = document.createElement("canvas");
        canvas.width = element.width;
        canvas.height = element.height;
        const context = canvas.getContext("2d");
        context.imageSmoothingEnabled = false;
        context.drawImage(
          elements.resultCanvas,
          element.x,
          element.y,
          element.width,
          element.height,
          0,
          0,
          element.width,
          element.height,
        );
        restoreClosedContainerInterior(canvas, latestOriginalCanvas, element);
        const number = String(index + 1).padStart(2, "0");
        files.push({ name: `${sourceName}-element-${number}.png`, bytes: await canvasToPngBytes(canvas) });
      }

      const zip = buildStoredZip(files);
      const url = URL.createObjectURL(zip);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${sourceName}-cutui-elements.zip`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      showStatus(`${files.length} separated elements downloaded.`);
    } catch (error) {
      console.error(error);
      showStatus("ZIP creation failed. Try a smaller selection.");
    } finally {
      elements.downloadZipButton.disabled = false;
      elements.downloadZipButton.textContent = originalLabel;
    }
  }

  async function extractAsset() {
    if (!sourceImage || !selection || selection.width < MIN_SELECTION || selection.height < MIN_SELECTION) {
      showStatus("Drag a larger selection around the component first.");
      return null;
    }

    elements.extractButton.disabled = true;
    elements.extractButton.textContent = "Extracting…";
    await new Promise((resolve) => requestAnimationFrame(resolve));

    try {
      const x = clamp(Math.round(selection.x), 0, elements.sourceCanvas.width - 1);
      const y = clamp(Math.round(selection.y), 0, elements.sourceCanvas.height - 1);
      const width = clamp(Math.round(selection.width), 1, elements.sourceCanvas.width - x);
      const height = clamp(Math.round(selection.height), 1, elements.sourceCanvas.height - y);
      if (width * height > MAX_SELECTION_PIXELS) {
        showStatus("That selection is too large for a fast extraction. Select an area under 8 megapixels.", 4200);
        return null;
      }

      const cropCanvas = document.createElement("canvas");
      cropCanvas.width = width;
      cropCanvas.height = height;
      const cropContext = cropCanvas.getContext("2d", { willReadFrequently: true });
      cropContext.imageSmoothingEnabled = false;
      cropContext.drawImage(sourceImage, x, y, width, height, 0, 0, width, height);
      const pixels = cropContext.getImageData(0, 0, width, height);
      const backgroundColor = manualBackground || estimateDominantBorder(pixels);
      const masked = buildMask(
        pixels,
        Number(elements.strength.value),
        elements.removeShadows.checked,
        backgroundColor,
      );
      // Preserve the exact selection frame. Tight alpha-bound trimming can
      // silently discard UI touching the left/right edges and changes the
      // relative positioning expected from a combined screenshot export.
      const framed = frameAndPad(masked, Number(elements.padding.value));

      if (!framed) {
        clearResult();
        showStatus("No foreground found. Lower the removal strength and try again.");
        return null;
      }

      const output = framed.canvas;
      latestOriginalCanvas = document.createElement("canvas");
      latestOriginalCanvas.width = output.width;
      latestOriginalCanvas.height = output.height;
      const originalContext = latestOriginalCanvas.getContext("2d");
      originalContext.imageSmoothingEnabled = false;
      originalContext.drawImage(
        cropCanvas,
        framed.sourceX,
        framed.sourceY,
        framed.sourceWidth,
        framed.sourceHeight,
        framed.padding,
        framed.padding,
        framed.sourceWidth,
        framed.sourceHeight,
      );

      elements.resultCanvas.width = output.width;
      elements.resultCanvas.height = output.height;
      resultContext.imageSmoothingEnabled = false;
      resultContext.clearRect(0, 0, output.width, output.height);
      resultContext.drawImage(output, 0, 0);
      elements.resultCanvas.style.display = "block";
      elements.emptyResult.hidden = true;
      elements.resultSize.textContent = `${output.width} × ${output.height} px`;

      detectedElements = detectUiElements(
        elements.resultCanvas,
        latestOriginalCanvas,
        backgroundColor,
        Number(elements.strength.value),
      );
      // Container recovery used to run only while building the ZIP. Apply it
      // to the combined canvas too, so the single PNG keeps pale banners and
      // inputs as complete pixel-faithful surfaces.
      restoreDetectedContainersInComposite(
        elements.resultCanvas,
        latestOriginalCanvas,
        detectedElements,
      );
      latestBlob = await new Promise((resolve) => elements.resultCanvas.toBlob(resolve, "image/png"));
      elements.downloadButton.disabled = !latestBlob;
      elements.downloadZipButton.disabled = !latestBlob || detectedElements.length === 0;
      elements.downloadZipButton.textContent = detectedElements.length > 0
        ? `Download ZIP (${detectedElements.length} elements)`
        : "Download ZIP";
      elements.copyButton.disabled = !latestBlob;
      showStatus("Asset extracted successfully.");
      return { width: output.width, height: output.height };
    } catch (error) {
      console.error(error);
      showStatus("Extraction failed. Try a smaller selection.");
      return null;
    } finally {
      elements.extractButton.disabled = false;
      elements.extractButton.textContent = "Extract asset";
    }
  }

  function downloadAsset() {
    if (!latestBlob) return;
    const url = URL.createObjectURL(latestBlob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${sourceName}-cutui.png`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function copyAsset() {
    if (!latestBlob) return;
    try {
      if (!navigator.clipboard || typeof ClipboardItem === "undefined") throw new Error("Clipboard unavailable");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": latestBlob })]);
      showStatus("PNG copied to clipboard.");
    } catch (error) {
      showStatus("Copy is unavailable here. Download the PNG instead.");
    }
  }

  function startOver() {
    loadVersion += 1;
    sourceImage = null;
    selection = null;
    manualBackground = null;
    pickingBackground = false;
    renderBackgroundControl();
    elements.fileInput.value = "";
    elements.editorView.hidden = true;
    elements.uploadView.hidden = false;
    clearResult();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  elements.chooseButton.addEventListener("click", (event) => {
    event.stopPropagation();
    openPicker();
  });
  elements.sampleButton.addEventListener("click", (event) => {
    event.stopPropagation();
    loadSample();
  });
  elements.dropZone.addEventListener("click", (event) => {
    if (event.target.closest("button")) return;
    openPicker();
  });
  elements.dropZone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPicker();
    }
  });
  elements.fileInput.addEventListener("change", () => validateAndLoadFile(elements.fileInput.files[0]));

  ["dragenter", "dragover"].forEach((type) => {
    elements.dropZone.addEventListener(type, (event) => {
      event.preventDefault();
      elements.dropZone.classList.add("dragging");
    });
  });
  ["dragleave", "drop"].forEach((type) => {
    elements.dropZone.addEventListener(type, (event) => {
      event.preventDefault();
      elements.dropZone.classList.remove("dragging");
    });
  });
  elements.dropZone.addEventListener("drop", (event) => validateAndLoadFile(event.dataTransfer.files[0]));

  window.addEventListener("paste", (event) => {
    const imageItem = [...(event.clipboardData?.items || [])].find((item) => item.type.startsWith("image/"));
    if (imageItem) validateAndLoadFile(imageItem.getAsFile());
  });

  elements.sourceCanvas.addEventListener("pointerdown", (event) => {
    if (!sourceImage) return;
    if (pickingBackground) {
      const point = pointFromEvent(event);
      const sampleCanvas = document.createElement("canvas");
      sampleCanvas.width = 1;
      sampleCanvas.height = 1;
      const sampleContext = sampleCanvas.getContext("2d", { willReadFrequently: true });
      sampleContext.drawImage(sourceImage, Math.floor(point.x), Math.floor(point.y), 1, 1, 0, 0, 1, 1);
      manualBackground = [...sampleContext.getImageData(0, 0, 1, 1).data.slice(0, 3)];
      pickingBackground = false;
      renderBackgroundControl();
      clearResult();
      showStatus("Background sampled. Extract again to apply it.");
      return;
    }
    dragStart = pointFromEvent(event);
    selection = { x: dragStart.x, y: dragStart.y, width: 0, height: 0 };
    elements.sourceCanvas.setPointerCapture(event.pointerId);
    clearResult();
    drawSource();
  });
  elements.sourceCanvas.addEventListener("pointermove", (event) => {
    if (!dragStart || !elements.sourceCanvas.hasPointerCapture(event.pointerId)) return;
    selection = normalizedSelection(dragStart, pointFromEvent(event));
    drawSource();
  });
  elements.sourceCanvas.addEventListener("pointerup", (event) => {
    if (!dragStart) return;
    selection = normalizedSelection(dragStart, pointFromEvent(event));
    dragStart = null;
    if (selection.width < MIN_SELECTION || selection.height < MIN_SELECTION) {
      showStatus("Drag a box around the component, including a little background.");
    }
    drawSource();
  });
  const cancelSelectionDrag = () => {
    dragStart = null;
    drawSource();
  };
  elements.sourceCanvas.addEventListener("pointercancel", cancelSelectionDrag);
  elements.sourceCanvas.addEventListener("lostpointercapture", cancelSelectionDrag);

  elements.sourceCanvas.addEventListener("keydown", (event) => {
    if (!selection || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const step = event.altKey ? 10 : 1;
    const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
    const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
    if (event.shiftKey) {
      selection.width = clamp(selection.width + dx, MIN_SELECTION, elements.sourceCanvas.width - selection.x);
      selection.height = clamp(selection.height + dy, MIN_SELECTION, elements.sourceCanvas.height - selection.y);
    } else {
      selection.x = clamp(selection.x + dx, 0, elements.sourceCanvas.width - selection.width);
      selection.y = clamp(selection.y + dy, 0, elements.sourceCanvas.height - selection.height);
    }
    clearResult();
    drawSource();
  });

  elements.strength.addEventListener("input", () => {
    elements.strengthValue.value = elements.strength.value;
  });
  elements.padding.addEventListener("input", () => {
    elements.paddingValue.value = `${elements.padding.value} px`;
  });
  function renderBackgroundControl() {
    elements.pickBackgroundButton.classList.toggle("active", pickingBackground);
    elements.sourceCanvas.classList.toggle("picking-background", pickingBackground);
    elements.autoBackgroundButton.disabled = !manualBackground;
    if (manualBackground) {
      const [r, g, b] = manualBackground.map(Math.round);
      elements.backgroundSwatch.style.background = `rgb(${r}, ${g}, ${b})`;
      elements.backgroundValue.value = `rgb(${r}, ${g}, ${b})`;
    } else {
      elements.backgroundSwatch.style.background = "linear-gradient(135deg, #fff 50%, #d9dfdc 50%)";
      elements.backgroundValue.value = pickingBackground ? "Pick on canvas" : "Auto";
    }
  }
  elements.pickBackgroundButton.addEventListener("click", () => {
    if (!sourceImage) return;
    pickingBackground = !pickingBackground;
    renderBackgroundControl();
    if (pickingBackground) showStatus("Click a clean background area in the screenshot.");
  });
  elements.autoBackgroundButton.addEventListener("click", () => {
    manualBackground = null;
    pickingBackground = false;
    renderBackgroundControl();
    clearResult();
    showStatus("Automatic background detection restored.");
  });
  elements.newImageButton.addEventListener("click", startOver);
  elements.resetSelectionButton.addEventListener("click", resetSelection);
  elements.extractButton.addEventListener("click", extractAsset);
  elements.downloadButton.addEventListener("click", downloadAsset);
  elements.downloadZipButton.addEventListener("click", downloadElementsZip);
  elements.copyButton.addEventListener("click", copyAsset);

  function registerWebMcpTools() {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();

    try {
      void Promise.resolve(context.registerTool({
        name: "load_sample_screenshot",
        title: "Load sample screenshot",
        description: "Open CutUI's built-in UI screenshot and prepare its sample card selection.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        async execute() {
          loadSample();
          return { status: "sample_loaded" };
        },
      }, { signal: lifecycle.signal })).catch(() => {});

      void Promise.resolve(context.registerTool({
        name: "extract_selected_ui_asset",
        title: "Extract selected UI asset",
        description: "Apply CutUI's current controls to the visible screenshot selection and show the transparent result.",
        inputSchema: {
          type: "object",
          properties: {
            strength: { type: "integer", minimum: 8, maximum: 120 },
            padding: { type: "integer", minimum: 0, maximum: 48 },
            removeShadows: { type: "boolean" },
          },
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        async execute(input = {}) {
          if (Number.isInteger(input.strength)) {
            elements.strength.value = input.strength;
            elements.strengthValue.value = input.strength;
          }
          if (Number.isInteger(input.padding)) {
            elements.padding.value = input.padding;
            elements.paddingValue.value = `${input.padding} px`;
          }
          if (typeof input.removeShadows === "boolean") elements.removeShadows.checked = input.removeShadows;
          const result = await extractAsset();
          if (!result) throw new Error("No asset could be extracted from the current selection.");
          return { status: "extracted", ...result };
        },
      }, { signal: lifecycle.signal })).catch(() => {});
    } catch (error) {
      console.debug("WebMCP unavailable", error);
    }
  }

  registerWebMcpTools();
})();
