(() => {
  "use strict";

  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const MAX_IMAGE_PIXELS = 16_000_000;
  const MAX_SELECTION_PIXELS = 8_000_000;
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
    keepShadow: document.querySelector("#shadow-control"),
    padding: document.querySelector("#padding-control"),
    paddingValue: document.querySelector("#padding-value"),
    extractButton: document.querySelector("#extract-button"),
    downloadButton: document.querySelector("#download-button"),
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

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

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
    sourceName = file.name.replace(/\.[^.]+$/, "") || "ui-asset";
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
        showStatus("This image is too large. Use an image under 16 megapixels.", 4200);
        if (onComplete) onComplete();
        return;
      }
      sourceImage = image;
      manualBackground = null;
      pickingBackground = false;
      renderBackgroundControl();
      elements.sourceCanvas.width = image.naturalWidth;
      elements.sourceCanvas.height = image.naturalHeight;

      const insetX = Math.round(image.naturalWidth * 0.08);
      const insetY = Math.round(image.naturalHeight * 0.08);
      selection = suggestedSelection || {
        x: insetX,
        y: insetY,
        width: image.naturalWidth - insetX * 2,
        height: image.naturalHeight - insetY * 2,
      };

      clearResult();
      drawSource();
      elements.uploadView.hidden = true;
      elements.editorView.hidden = false;
      elements.editorView.scrollIntoView({ behavior: "smooth", block: "start" });
      elements.sourceCanvas.focus({ preventScroll: true });
      showStatus("Image ready — drag around one UI component.");
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
    const insetX = Math.round(sourceImage.naturalWidth * 0.08);
    const insetY = Math.round(sourceImage.naturalHeight * 0.08);
    selection = {
      x: insetX,
      y: insetY,
      width: sourceImage.naturalWidth - insetX * 2,
      height: sourceImage.naturalHeight - insetY * 2,
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
    elements.copyButton.disabled = true;
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

  function buildMask(imageData, strength, preserveSoftEdges, backgroundOverride = null) {
    const { width, height, data } = imageData;
    const backgroundColor = backgroundOverride || estimateDominantBorder(imageData);
    const status = new Uint8Array(width * height);
    const queue = new Int32Array(width * height);
    let queueStart = 0;
    let queueEnd = 0;

    const visit = (pixelIndex) => {
      if (status[pixelIndex] !== 0) return;
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);
      const dataIndex = pixelIndex * 4;
      if (colorDistance(data, dataIndex, backgroundColor) <= strength) {
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
      if (!preserveSoftEdges) {
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

  function trimAndPad(imageData, padding) {
    const { width, height, data } = imageData;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (data[(y * width + x) * 4 + 3] > 2) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (maxX < minX || maxY < minY) return null;

    const cropWidth = maxX - minX + 1;
    const cropHeight = maxY - minY + 1;
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = width;
    tempCanvas.height = height;
    tempCanvas.getContext("2d").putImageData(imageData, 0, 0);

    const output = document.createElement("canvas");
    output.width = cropWidth + padding * 2;
    output.height = cropHeight + padding * 2;
    const outputContext = output.getContext("2d");
    outputContext.imageSmoothingEnabled = false;
    outputContext.drawImage(
      tempCanvas,
      minX,
      minY,
      cropWidth,
      cropHeight,
      padding,
      padding,
      cropWidth,
      cropHeight,
    );
    return output;
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
      const masked = buildMask(
        pixels,
        Number(elements.strength.value),
        elements.keepShadow.checked,
        manualBackground,
      );
      const output = trimAndPad(masked, Number(elements.padding.value));

      if (!output) {
        clearResult();
        showStatus("No foreground found. Lower the removal strength and try again.");
        return null;
      }

      elements.resultCanvas.width = output.width;
      elements.resultCanvas.height = output.height;
      resultContext.imageSmoothingEnabled = false;
      resultContext.clearRect(0, 0, output.width, output.height);
      resultContext.drawImage(output, 0, 0);
      elements.resultCanvas.style.display = "block";
      elements.emptyResult.hidden = true;
      elements.resultSize.textContent = `${output.width} × ${output.height} px`;

      latestBlob = await new Promise((resolve) => elements.resultCanvas.toBlob(resolve, "image/png"));
      elements.downloadButton.disabled = !latestBlob;
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
            keepSoftShadows: { type: "boolean" },
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
          if (typeof input.keepSoftShadows === "boolean") elements.keepShadow.checked = input.keepSoftShadows;
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
