import { FFmpeg } from "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js";
import { fetchFile, toBlobURL } from "https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/esm/index.js";

const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

const IMAGE_ACCEPT = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
]);

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|mkv)$/i;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|bmp)$/i;

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const fileInput = $("#file-input");
const dropzone = $("#dropzone");
const btnChoose = $("#btn-choose");
const btnClear = $("#btn-clear");
const btnConvert = $("#btn-convert");
const btnCompress = $("#btn-compress");
const btnZip = $("#btn-zip");
const workspace = $("#workspace");
const fileList = $("#file-list");
const optsImage = $("#opts-image");
const optsVideo = $("#opts-video");
const optFormat = $("#opt-format");
const optQuality = $("#opt-quality");
const qualityVal = $("#quality-val");
const qualityWrap = $("#opt-quality-wrap");
const optMaxEdge = $("#opt-maxedge");
const optCrf = $("#opt-crf");
const optScale = $("#opt-scale");
const progress = $("#progress");
const progressLabel = $("#progress-label");
const progressStars = $$("#progress-stars span");
const results = $("#results");
const resultList = $("#result-list");
const optAvif = $("#opt-avif");

const heroEyebrow = $("#hero-eyebrow");
const heroTitle = $("#hero-title");
const heroDesc = $("#hero-desc");
const heroHint = $("#hero-hint");
const dropzoneTitle = $("#dropzone-title");

/** @type {"image" | "video"} */
let mode = "image";
/** @type {{ id: string, file: File, url: string }[]} */
let queue = [];
/** @type {{ name: string, blob: Blob, url: string, kind: "image" | "video", before?: number }[]} */
let converted = [];

/** @type {FFmpeg | null} */
let ffmpeg = null;
let ffmpegLoading = null;

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
    "video/mp4": "mp4",
  };
  return map[mime] || "bin";
}

function rename(fileName, mime) {
  const base = fileName.replace(/\.[^.]+$/, "") || (mode === "video" ? "video" : "image");
  const suffix = mode === "video" ? "-compressed" : "";
  return `${base}${suffix}.${extForMime(mime)}`;
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function isVideoFile(file) {
  return file.type.startsWith("video/") || VIDEO_EXT.test(file.name);
}

function isImageFile(file) {
  return IMAGE_ACCEPT.has(file.type) || IMAGE_EXT.test(file.name);
}

function maxBytes() {
  return mode === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
}

function updateAccept() {
  if (mode === "video") {
    fileInput.accept = "video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.webm,.mov,.m4v,.mkv";
  } else {
    fileInput.accept =
      "image/jpeg,image/png,image/webp,image/gif,image/bmp,.jpg,.jpeg,.png,.webp,.gif,.bmp";
  }
}

function setMode(next) {
  if (next === mode) return;
  clearAll();
  mode = next;

  $$(".mode-tab").forEach((tab) => {
    const on = tab.dataset.mode === mode;
    tab.classList.toggle("is-active", on);
    tab.setAttribute("aria-selected", on ? "true" : "false");
  });

  optsImage.hidden = mode !== "image";
  optsVideo.hidden = mode !== "video";
  updateAccept();

  if (mode === "video") {
    heroEyebrow.textContent = "Video · browser-only · FFmpeg.wasm";
    heroTitle.textContent = "Video Compressor";
    heroDesc.textContent =
      "Compress MP4, WebM, or MOV on your device. First run loads a ~30MB encoder from CDN.";
    heroHint.textContent = "MP4 · WebM · MOV · Max ~200MB · Slow on long clips";
    dropzoneTitle.textContent = "Drop any videos here";
    btnChoose.textContent = "Choose Videos";
  } else {
    heroEyebrow.textContent = "Image · browser-only";
    heroTitle.textContent = "File Converter";
    heroDesc.textContent =
      "Easily convert images from one format to another — entirely in your browser.";
    heroHint.textContent = "JPEG · PNG · WebP · GIF · BMP · Max ~50MB each";
    dropzoneTitle.textContent = "Drop any images here";
    btnChoose.textContent = "Choose Files";
  }
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
  const limit = maxBytes();

  for (const file of incoming) {
    const typeOk = mode === "video" ? isVideoFile(file) : isImageFile(file);
    if (!typeOk || file.size > limit) {
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
    const media =
      mode === "video"
        ? `<video class="file-item__thumb" src="${item.url}" muted playsinline></video>`
        : `<img class="file-item__thumb" src="${item.url}" alt="" />`;
    li.innerHTML = `
      ${media}
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
  const lit = Math.round(Math.min(1, Math.max(0, ratio)) * n);
  progressStars.forEach((star, i) => {
    star.classList.toggle("is-on", i < lit);
  });
}

async function convertImageOne(file, mime, quality, maxEdge) {
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

async function ensureFFmpeg() {
  if (ffmpeg?.loaded) return ffmpeg;
  if (ffmpegLoading) return ffmpegLoading;

  ffmpegLoading = (async () => {
    progressLabel.textContent = "Loading video engine (~30MB, once)…";
    setStarProgress(0.15);

    const instance = new FFmpeg();
    instance.on("progress", ({ progress: p }) => {
      if (typeof p === "number" && p >= 0 && p <= 1) {
        setStarProgress(0.2 + p * 0.75);
        progressLabel.textContent = `Compressing… ${Math.round(p * 100)}%`;
      }
    });

    const baseURL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm";
    const ffmpegURL = "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm";
    await instance.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
      classWorkerURL: await toBlobURL(`${ffmpegURL}/worker.js`, "text/javascript"),
    });

    ffmpeg = instance;
    return instance;
  })();

  try {
    return await ffmpegLoading;
  } finally {
    ffmpegLoading = null;
  }
}

function inputExt(file) {
  const m = file.name.match(/\.([^.]+)$/);
  if (m) return m[1].toLowerCase();
  if (file.type === "video/webm") return "webm";
  if (file.type === "video/quicktime") return "mov";
  return "mp4";
}

async function compressVideoOne(file, crf, scaleH) {
  const ff = await ensureFFmpeg();
  const inName = `input.${inputExt(file)}`;
  const outName = "output.mp4";

  await ff.writeFile(inName, await fetchFile(file));

  const args = ["-i", inName, "-c:v", "libx264", "-crf", String(crf), "-preset", "fast"];
  if (scaleH > 0) {
    args.push("-vf", `scale=-2:${scaleH}`);
  }
  args.push("-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", outName);

  await ff.exec(args);
  const data = await ff.readFile(outName);
  await ff.deleteFile(inName).catch(() => {});
  await ff.deleteFile(outName).catch(() => {});

  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  return new Blob([bytes], { type: "video/mp4" });
}

async function runImageConvert() {
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
      const blob = await convertImageOne(item.file, mime, quality, maxEdge);
      converted.push({
        name: rename(item.file.name, mime),
        blob,
        url: URL.createObjectURL(blob),
        kind: "image",
        before: item.file.size,
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

async function runVideoCompress() {
  if (!queue.length) return;

  const crf = Number(optCrf.value) || 28;
  const scaleH = Number(optScale.value) || 0;

  btnCompress.disabled = true;
  progress.hidden = false;
  results.hidden = true;
  converted.forEach((c) => URL.revokeObjectURL(c.url));
  converted = [];
  setStarProgress(0);
  progressLabel.textContent = "Preparing…";

  try {
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      progressLabel.textContent = `Compressing ${i + 1} / ${queue.length}…`;
      const blob = await compressVideoOne(item.file, crf, scaleH);
      converted.push({
        name: rename(item.file.name, "video/mp4"),
        blob,
        url: URL.createObjectURL(blob),
        kind: "video",
        before: item.file.size,
      });
      setStarProgress((i + 1) / queue.length);
    }

    progressLabel.textContent = "Done";
    renderResults();
    results.hidden = false;
    btnZip.hidden = converted.length < 2;
  } catch (err) {
    console.error(err);
    progressLabel.textContent = err?.message || "Compression failed";
    setStarProgress(0);
  } finally {
    btnCompress.disabled = false;
  }
}

function renderResults() {
  resultList.innerHTML = "";
  for (const item of converted) {
    const li = document.createElement("li");
    li.className = "result-item";
    const media =
      item.kind === "video"
        ? `<video class="result-item__thumb" src="${item.url}" muted playsinline controls></video>`
        : `<img class="result-item__thumb" src="${item.url}" alt="" />`;
    const saved =
      item.before && item.blob.size < item.before
        ? ` · saved ${formatBytes(item.before - item.blob.size)}`
        : item.before
          ? ` · was ${formatBytes(item.before)}`
          : "";
    li.innerHTML = `
      ${media}
      <div class="result-item__meta">
        <p class="result-item__name"></p>
        <p class="result-item__info"></p>
      </div>
      <a class="btn btn-sm" download></a>
    `;
    $(".result-item__name", li).textContent = item.name;
    $(".result-item__info", li).textContent = `${formatBytes(item.blob.size)}${saved}`;
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
  a.download = mode === "video" ? "compressed-videos.zip" : "converted-images.zip";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* —— Events —— */
$$(".mode-tab").forEach((tab) => {
  tab.addEventListener("click", () => setMode(tab.dataset.mode));
});

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
btnConvert.addEventListener("click", runImageConvert);
btnCompress.addEventListener("click", runVideoCompress);
btnZip.addEventListener("click", downloadZip);

optQuality.addEventListener("input", () => {
  qualityVal.textContent = Number(optQuality.value).toFixed(2);
});
optFormat.addEventListener("change", updateQualityVisibility);

updateAccept();
detectAvifSupport();
updateQualityVisibility();
