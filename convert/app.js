(() => {
  "use strict";

  const MAX_BYTES = 50 * 1024 * 1024;
  const ACCEPT = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/bmp",
  ]);

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const fileInput = $("#file-input");
  const dropzone = $("#dropzone");
  const btnChoose = $("#btn-choose");
  const btnClear = $("#btn-clear");
  const btnConvert = $("#btn-convert");
  const btnZip = $("#btn-zip");
  const workspace = $("#workspace");
  const fileList = $("#file-list");
  const optFormat = $("#opt-format");
  const optQuality = $("#opt-quality");
  const qualityVal = $("#quality-val");
  const qualityWrap = $("#opt-quality-wrap");
  const optMaxEdge = $("#opt-maxedge");
  const progress = $("#progress");
  const progressLabel = $("#progress-label");
  const progressStars = $$("#progress-stars span");
  const results = $("#results");
  const resultList = $("#result-list");
  const optAvif = $("#opt-avif");

  /** @type {{ id: string, file: File, url: string }[]} */
  let queue = [];
  /** @type {{ name: string, blob: Blob, url: string }[]} */
  let converted = [];

  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  function formatBytes(n) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  }

  function extForMime(mime) {
    const map = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/avif": "avif",
    };
    return map[mime] || "bin";
  }

  function rename(fileName, mime) {
    const base = fileName.replace(/\.[^.]+$/, "") || "image";
    return `${base}.${extForMime(mime)}`;
  }

  function uid() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  async function detectAvifSupport() {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const blob = await new Promise((resolve) => {
        canvas.toBlob(resolve, "image/avif", 0.5);
      });
      if (blob && blob.type === "image/avif") {
        optAvif.hidden = false;
      }
    } catch {
      /* ignore */
    }
  }

  function updateQualityVisibility() {
    const mime = optFormat.value;
    const lossy = mime === "image/jpeg" || mime === "image/webp" || mime === "image/avif";
    qualityWrap.style.visibility = lossy ? "visible" : "hidden";
  }

  function openPicker() {
    fileInput.click();
  }

  function addFiles(fileListLike) {
    const incoming = [...fileListLike];
    let rejected = 0;

    for (const file of incoming) {
      const typeOk =
        ACCEPT.has(file.type) ||
        /\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name);
      if (!typeOk || file.size > MAX_BYTES) {
        rejected += 1;
        continue;
      }
      const exists = queue.some(
        (q) => q.file.name === file.name && q.file.size === file.size
      );
      if (exists) continue;
      queue.push({ id: uid(), file, url: URL.createObjectURL(file) });
    }

    if (rejected) {
      console.warn(`${rejected} file(s) skipped (type or size).`);
    }

    renderQueue();
    if (queue.length) {
      workspace.hidden = false;
      results.hidden = true;
      converted.forEach((c) => URL.revokeObjectURL(c.url));
      converted = [];
      btnZip.hidden = true;
    }
  }

  function removeFile(id) {
    const idx = queue.findIndex((q) => q.id === id);
    if (idx < 0) return;
    URL.revokeObjectURL(queue[idx].url);
    queue.splice(idx, 1);
    renderQueue();
    if (!queue.length) workspace.hidden = true;
  }

  function clearAll() {
    queue.forEach((q) => URL.revokeObjectURL(q.url));
    converted.forEach((c) => URL.revokeObjectURL(c.url));
    queue = [];
    converted = [];
    fileList.innerHTML = "";
    resultList.innerHTML = "";
    workspace.hidden = true;
    results.hidden = true;
    progress.hidden = true;
    btnZip.hidden = true;
    fileInput.value = "";
  }

  function renderQueue() {
    fileList.innerHTML = "";
    for (const item of queue) {
      const li = document.createElement("li");
      li.className = "file-item";
      li.innerHTML = `
        <img class="file-item__thumb" src="${item.url}" alt="" />
        <div class="file-item__meta">
          <p class="file-item__name"></p>
          <p class="file-item__info"></p>
        </div>
        <button type="button" class="file-item__remove" aria-label="Remove">×</button>
      `;
      $(".file-item__name", li).textContent = item.file.name;
      $(".file-item__info", li).textContent = formatBytes(item.file.size);
      $(".file-item__remove", li).addEventListener("click", () => removeFile(item.id));
      fileList.appendChild(li);
    }
  }

  function setStarProgress(ratio) {
    const n = progressStars.length;
    const lit = Math.round(ratio * n);
    progressStars.forEach((star, i) => {
      star.classList.toggle("is-on", i < lit);
    });
  }

  /**
   * @param {File} file
   * @param {string} mime
   * @param {number} quality
   * @param {number} maxEdge
   */
  async function convertOne(file, mime, quality, maxEdge) {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;

    if (maxEdge > 0 && Math.max(width, height) > maxEdge) {
      const scale = maxEdge / Math.max(width, height);
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    if (mime === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
    }

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Encode failed"))),
        mime,
        quality
      );
    });

    if (blob.type && blob.type !== mime && mime === "image/avif") {
      throw new Error("AVIF not supported in this browser");
    }

    return blob;
  }

  async function runConvert() {
    if (!queue.length) return;

    const mime = optFormat.value;
    const quality = Number(optQuality.value);
    const maxEdge = Number(optMaxEdge.value) || 0;

    btnConvert.disabled = true;
    progress.hidden = false;
    results.hidden = true;
    converted.forEach((c) => URL.revokeObjectURL(c.url));
    converted = [];
    setStarProgress(0);
    progressLabel.textContent = "Converting…";

    try {
      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        progressLabel.textContent = `Converting ${i + 1} / ${queue.length}…`;
        const blob = await convertOne(item.file, mime, quality, maxEdge);
        const name = rename(item.file.name, mime);
        converted.push({
          name,
          blob,
          url: URL.createObjectURL(blob),
        });
        setStarProgress((i + 1) / queue.length);
      }

      progressLabel.textContent = "Done";
      renderResults();
      results.hidden = false;
      btnZip.hidden = converted.length < 2;
    } catch (err) {
      console.error(err);
      progressLabel.textContent = err?.message || "Conversion failed";
      setStarProgress(0);
    } finally {
      btnConvert.disabled = false;
    }
  }

  function renderResults() {
    resultList.innerHTML = "";
    for (const item of converted) {
      const li = document.createElement("li");
      li.className = "result-item";
      li.innerHTML = `
        <img class="result-item__thumb" alt="" />
        <div class="result-item__meta">
          <p class="result-item__name"></p>
          <p class="result-item__info"></p>
        </div>
        <a class="btn btn-sm" download></a>
      `;
      const img = $(".result-item__thumb", li);
      img.src = item.url;
      $(".result-item__name", li).textContent = item.name;
      $(".result-item__info", li).textContent = formatBytes(item.blob.size);
      const a = $("a", li);
      a.href = item.url;
      a.download = item.name;
      a.textContent = "Download";
      resultList.appendChild(li);
    }
  }

  async function downloadZip() {
    if (!converted.length || typeof JSZip === "undefined") return;
    const zip = new JSZip();
    for (const item of converted) {
      zip.file(item.name, item.blob);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "converted-images.zip";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /* —— Events —— */
  btnChoose.addEventListener("click", openPicker);
  dropzone.addEventListener("click", openPicker);
  dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openPicker();
    }
  });

  fileInput.addEventListener("change", () => {
    if (fileInput.files?.length) addFiles(fileInput.files);
    fileInput.value = "";
  });

  ["dragenter", "dragover"].forEach((ev) => {
    dropzone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropzone.classList.add("is-dragover");
    });
  });

  ["dragleave", "drop"].forEach((ev) => {
    dropzone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropzone.classList.remove("is-dragover");
    });
  });

  dropzone.addEventListener("drop", (e) => {
    const files = e.dataTransfer?.files;
    if (files?.length) addFiles(files);
  });

  btnClear.addEventListener("click", clearAll);
  btnConvert.addEventListener("click", runConvert);
  btnZip.addEventListener("click", downloadZip);

  optQuality.addEventListener("input", () => {
    qualityVal.textContent = Number(optQuality.value).toFixed(2);
  });
  optFormat.addEventListener("change", updateQualityVisibility);

  detectAvifSupport();
  updateQualityVisibility();
})();
