(function () {
  const listEl = document.getElementById("works-list");
  const filtersEl = document.getElementById("filters");
  const player = document.getElementById("player");
  const playerMedia = document.getElementById("player-media");
  const playerVideo = document.getElementById("player-video");
  const playerLoading = document.getElementById("player-loading");
  const playerTitle = document.getElementById("player-title");
  const playerInfo = document.getElementById("player-info");
  const playerDetail = document.getElementById("player-detail");
  const playerClose = document.getElementById("player-close");
  const yearEl = document.getElementById("year");
  const canvas = document.getElementById("hero-canvas");

  yearEl.textContent = String(new Date().getFullYear());

  let activeFilter = "全部";
  let activeWork = null;
  let activeEpisodeIndex = 0;
  let visibleCount = 0;
  const PAGE_SIZE = 8;
  const accents = ["blue", "orange", "blue", "orange"];

  // Delivery speed only — same original files, no re-encode.
  // jsDelivr mirrors the GitHub repo and is usually faster than raw github.io in CN.
  const REPO = "zharuhang-blip/zhongan-content-portfolio";
  const USE_CDN = /\.github\.io$/i.test(location.hostname);
  const CDN_BASE = `https://cdn.jsdelivr.net/gh/${REPO}@main/`;

  function encodePath(path) {
    return String(path)
      .replace(/^\.\//, "")
      .split("/")
      .map((seg) => encodeURIComponent(seg))
      .join("/");
  }

  function assetUrl(path) {
    if (!path) return path;
    if (/^(https?:|data:|blob:)/i.test(path)) return path;
    const clean = path.replace(/^\.\//, "");
    if (!USE_CDN) return clean;
    return CDN_BASE + encodePath(clean);
  }

  function localUrl(path) {
    if (!path) return path;
    if (/^(https?:|data:|blob:)/i.test(path)) return path;
    return path.replace(/^\.\//, "");
  }

  function thumbPath(cover) {
    if (!cover || typeof cover !== "string") return "";
    if (cover.startsWith("covers/") && cover.endsWith(".jpg") && !cover.includes("/thumbs/")) {
      return cover.replace("covers/", "covers/thumbs/");
    }
    return "";
  }

  /** Limit parallel full-res upgrades so the connection stays responsive. */
  const upgradeQueue = [];
  let upgradeActive = 0;
  const UPGRADE_MAX = 3;

  function pumpUpgrade() {
    while (upgradeActive < UPGRADE_MAX && upgradeQueue.length) {
      const job = upgradeQueue.shift();
      upgradeActive += 1;
      job().finally(() => {
        upgradeActive -= 1;
        pumpUpgrade();
      });
    }
  }

  function enqueueUpgrade(fn) {
    upgradeQueue.push(fn);
    pumpUpgrade();
  }

  function bindMediaFallback(el, localPath) {
    if (!el || !localPath || !USE_CDN) return;
    el.addEventListener(
      "error",
      () => {
        const fallback = localUrl(localPath);
        if (el.src && !el.src.endsWith(fallback) && el.getAttribute("src") !== fallback) {
          if (el.tagName === "VIDEO") {
            el.src = fallback;
            el.load();
          } else {
            el.src = fallback;
          }
        }
      },
      { once: true }
    );
  }

  function upgradeCover(img) {
    const full = img.getAttribute("data-full");
    if (!full || img.dataset.upgraded === "1") return;
    img.dataset.upgraded = "1";
    enqueueUpgrade(
      () =>
        new Promise((resolve) => {
          const probe = new Image();
          probe.decoding = "async";
          probe.onload = () => {
            img.src = probe.src;
            img.classList.remove("is-thumb");
            img.classList.add("is-full");
            resolve();
          };
          probe.onerror = () => {
            const local = img.getAttribute("data-local");
            if (local) img.src = localUrl(local);
            img.classList.remove("is-thumb");
            resolve();
          };
          probe.src = assetUrl(full);
        })
    );
  }

  function observeCovers(root) {
    const imgs = root.querySelectorAll("img[data-full]");
    if (!imgs.length) return;
    if (!("IntersectionObserver" in window)) {
      imgs.forEach((img) => upgradeCover(img));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          io.unobserve(entry.target);
          upgradeCover(entry.target);
        });
      },
      { rootMargin: "200px 0px", threshold: 0.01 }
    );
    imgs.forEach((img) => io.observe(img));
  }

  function workEpisodes(work) {
    if (work.episodes && work.episodes.length) return work.episodes;
    if (work.video) {
      return [{ title: "成片", video: work.video, cover: work.cover }];
    }
    return [];
  }

  function hasPlayable(work) {
    return workEpisodes(work).some((ep) => Boolean(ep.video));
  }

  function categories() {
    const groupKeys =
      typeof CATEGORY_GROUPS !== "undefined" ? Object.keys(CATEGORY_GROUPS) : [];
    const buttons = ["全部", ...groupKeys];
    if (typeof CATEGORIES !== "undefined" && CATEGORIES.length) {
      return [...buttons, ...CATEGORIES];
    }
    const set = new Set(WORKS.map((w) => w.category || w.platform).filter(Boolean));
    return [...buttons, ...set];
  }

  function groupMark(p) {
    if (p === "品牌投放") return "AD";
    if (p === "栏目成片") return "EP";
    if (p === "策划运营") return "OPS";
    return "";
  }

  function renderFilters() {
    const groupKeys =
      typeof CATEGORY_GROUPS !== "undefined" ? Object.keys(CATEGORY_GROUPS) : [];
    filtersEl.innerHTML = categories()
      .map((p) => {
        const isGroup = groupKeys.includes(p);
        const mark = groupMark(p);
        const label = isGroup
          ? `<span class="filter-group-mark" aria-hidden="true">${mark}</span><span>${p}</span>`
          : p;
        return `<button class="filter-btn${isGroup ? " filter-group" : ""}${
          p === "策划运营" ? " filter-group-personal" : ""
        }${p === activeFilter ? " active" : ""}" type="button" data-filter="${p}">${label}</button>`;
      })
      .join("");
  }

  function visibleWorks() {
    if (activeFilter === "全部") return WORKS;
    if (typeof CATEGORY_GROUPS !== "undefined" && CATEGORY_GROUPS[activeFilter]) {
      const set = new Set(CATEGORY_GROUPS[activeFilter]);
      return WORKS.filter((w) => set.has(w.category));
    }
    return WORKS.filter((w) => (w.category || w.platform) === activeFilter);
  }

  function mediaMarkup(work, index) {
    const playable = hasPlayable(work);
    const eager = index < 3;
    const full = work.cover || "";
    const thumb = thumbPath(full);
    // Instant paint with tiny placeholder, then swap to full-quality original.
    const preview = thumb || full;
    const cover = full
      ? `<img class="work-cover${thumb ? " is-thumb" : ""}" src="${assetUrl(preview)}" data-full="${full}" data-local="${full}" alt="${work.title} 封面" loading="${eager ? "eager" : "lazy"}" decoding="async"${eager ? ' fetchpriority="high"' : ""} width="360" height="450" />`
      : "";
    const badge =
      work.episodes && work.episodes.length > 1
        ? `<span class="work-badge">${work.episodes.length} 集</span>`
        : "";
    return `${cover}${badge}<div class="work-play"><span>${playable ? "▶" : "详"}</span></div>`;
  }

  function workGroupTitleFor(work, groupLookup) {
    for (const g of groupLookup) {
      if (g.set.has(work.category)) return g.title;
    }
    return "";
  }

  function buildGroupLookup() {
    const groupLookup = [];
    if (typeof CATEGORY_GROUPS !== "undefined") {
      Object.keys(CATEGORY_GROUPS).forEach((key) => {
        const title =
          typeof GROUP_TITLES !== "undefined" && GROUP_TITLES[key]
            ? GROUP_TITLES[key]
            : key;
        groupLookup.push({
          title,
          set: new Set(CATEGORY_GROUPS[key] || []),
        });
      });
    }
    return groupLookup;
  }

  function workCardHtml(work, index, groupLookup, lastGroupRef) {
    const group = workGroupTitleFor(work, groupLookup);
    let prefix = "";
    if (activeFilter === "全部" && group && group !== lastGroupRef.value) {
      prefix = `<h3 class="works-group-title">${group}</h3>`;
      lastGroupRef.value = group;
    }
    const accent = accents[index % accents.length];
    const num = String(index + 1).padStart(2, "0");
    return `${prefix}
        <article class="work-item" data-id="${work.id}" data-accent="${accent}" style="animation-delay: ${Math.min(index, 8) * 40}ms" tabindex="0" role="button" aria-label="查看 ${work.title}">
          <div class="work-media">
            ${mediaMarkup(work, index)}
          </div>
          <div class="work-body">
            <div class="work-meta">
              <span class="index-dot">${num}</span>
              <span>${work.category || work.platform || "内容"}</span>
              <span>·</span>
              <span>${work.platform || ""}</span>
              <span>·</span>
              <span>${work.year || ""}</span>
            </div>
            <h3 class="work-title">${work.title}</h3>
            <p class="work-desc"><span class="work-problem-label">问题</span>${work.problem || work.desc || ""}</p>
          </div>
        </article>`;
  }

  function renderWorks(reset) {
    const items = visibleWorks();
    if (reset !== false) visibleCount = Math.min(PAGE_SIZE, items.length);

    if (!items.length) {
      listEl.innerHTML = `<p class="work-empty">这个分类下还没有作品，去 works.js 里加一条吧。</p>`;
      return;
    }

    const groupLookup = buildGroupLookup();
    const lastGroupRef = { value: "" };
    const slice = items.slice(0, visibleCount);
    let html = slice
      .map((work, index) => workCardHtml(work, index, groupLookup, lastGroupRef))
      .join("");

    if (visibleCount < items.length) {
      html += `<button class="works-more" type="button" id="works-more">加载更多作品（还剩 ${items.length - visibleCount}）</button>`;
    }

    listEl.innerHTML = html;
    observeCovers(listEl);

    const more = document.getElementById("works-more");
    if (more) {
      more.addEventListener("click", () => {
        visibleCount = Math.min(visibleCount + PAGE_SIZE, items.length);
        renderWorks(false);
      });
    }
  }

  function galleryMarkup(work) {
    if (!work.gallery || !work.gallery.length) return "";
    return `<div class="detail-gallery${work.gallery.length > 4 ? " detail-gallery--wide" : ""}">${work.gallery
      .map((src, i) => {
        const url = assetUrl(src);
        return `<figure class="detail-shot${i === 0 ? " detail-shot--hero" : ""}"><img src="${url}" data-local="${src}" alt="${work.title} 样例 ${i + 1}" loading="${i < 2 ? "eager" : "lazy"}" decoding="async" /></figure>`;
      })
      .join("")}</div>`;
  }

  function linksMarkup(work) {
    if (!work.links || !work.links.length) return "";
    const items = work.links
      .map(
        (item) =>
          `<li><a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.label || item.url}</a>${
            item.note ? `<span class="link-note">${item.note}</span>` : ""
          }</li>`
      )
      .join("");
    return `<div class="detail-row detail-row--links"><span>相关链接</span><ul class="detail-links">${items}</ul></div>`;
  }

  function detailMarkup(work) {
    const rows = [
      ["发现的问题", work.problem],
      ["怎么解决", work.solve],
      ["路径", work.method],
      ["结果", work.outputs],
    ].filter(([, v]) => v);

    return `${galleryMarkup(work)}${rows
      .map(
        ([label, value], i) =>
          `<div class="detail-row${i === 0 ? " detail-row--problem" : ""}"><span>${label}</span><p>${value}</p></div>`
      )
      .join("")}${linksMarkup(work)}`;
  }

  function episodesMarkup(work) {
    const eps = workEpisodes(work);
    if (eps.length <= 1) return "";
    return `<div class="episode-list" role="tablist" aria-label="分集切换">${eps
      .map(
        (ep, i) =>
          `<button class="episode-btn${i === activeEpisodeIndex ? " active" : ""}" type="button" data-ep="${i}" role="tab" aria-selected="${i === activeEpisodeIndex}">${ep.title}</button>`
      )
      .join("")}</div>`;
  }

  function setPlayerLoading(on) {
    if (!playerLoading) return;
    playerLoading.hidden = !on;
  }

  function playEpisode(work, index) {
    const eps = workEpisodes(work);
    const ep = eps[index];
    if (!ep || !ep.video) {
      setPlayerLoading(false);
      playerVideo.pause();
      playerVideo.removeAttribute("src");
      playerVideo.removeAttribute("poster");
      playerVideo.load();
      playerMedia.hidden = true;
      return;
    }
    activeEpisodeIndex = index;
    playerMedia.hidden = false;
    playerVideo.hidden = false;
    const poster = ep.cover || work.cover || "";
    if (poster) playerVideo.poster = assetUrl(poster);
    else playerVideo.removeAttribute("poster");
    setPlayerLoading(true);
    playerVideo.preload = "metadata";
    // Stream original file via CDN when available; browser uses HTTP range.
    playerVideo.src = assetUrl(ep.video);
    bindMediaFallback(playerVideo, ep.video);
    playerVideo.load();
    let started = false;
    const tryPlay = () => {
      if (started) return;
      started = true;
      setPlayerLoading(false);
      playerVideo.play().catch(() => {});
    };
    playerVideo.addEventListener("canplay", tryPlay, { once: true });
    playerVideo.addEventListener(
      "error",
      () => {
        // bindMediaFallback may swap to origin; give it a beat, then clear spinner.
        setTimeout(() => {
          if (playerVideo.readyState < 2) {
            started = true;
            setPlayerLoading(false);
          }
        }, 400);
      },
      { once: true }
    );
    const onProgress = () => {
      if (playerVideo.readyState >= 3) {
        playerVideo.removeEventListener("progress", onProgress);
        tryPlay();
      }
    };
    playerVideo.addEventListener("progress", onProgress);
    playerTitle.textContent =
      eps.length > 1 ? `${work.title.replace(/ · 合集$/, "")} · ${ep.title}` : work.title;
    const list = playerDetail.querySelector(".episode-list");
    if (list) {
      list.querySelectorAll(".episode-btn").forEach((btn, i) => {
        const on = i === index;
        btn.classList.toggle("active", on);
        btn.setAttribute("aria-selected", on ? "true" : "false");
      });
    }
  }

  function clearPlayerHero() {
    const img = playerMedia.querySelector(".player-hero-img");
    if (img) img.remove();
  }

  function showPlayerHero(src, alt) {
    playerVideo.hidden = true;
    playerVideo.pause();
    playerVideo.removeAttribute("src");
    playerVideo.load();
    clearPlayerHero();
    const img = document.createElement("img");
    img.className = "player-hero-img";
    img.src = assetUrl(src);
    img.alt = alt || "";
    bindMediaFallback(img, src);
    playerMedia.appendChild(img);
    playerMedia.hidden = false;
  }

  function openCase(work) {
    activeWork = work;
    activeEpisodeIndex = 0;
    const isDeck = Boolean(work.gallery && work.gallery.length && !work.video);
    player.hidden = false;
    player.classList.toggle("player--deck", isDeck);
    playerTitle.textContent = work.title;
    playerInfo.textContent = [work.category, work.platform, work.role, work.year]
      .filter(Boolean)
      .join(" · ");
    playerDetail.innerHTML = `${episodesMarkup(work)}${detailMarkup(work)}`;
    playerDetail.querySelectorAll("img[data-local]").forEach((img) => {
      bindMediaFallback(img, img.getAttribute("data-local"));
    });
    document.body.style.overflow = "hidden";

    const eps = workEpisodes(work);
    if (eps.some((ep) => ep.video)) {
      clearPlayerHero();
      playerVideo.hidden = false;
      playEpisode(work, 0);
    } else if (isDeck) {
      // 策划案以画廊为主视觉，避免与首图重复
      clearPlayerHero();
      playerVideo.hidden = true;
      playerMedia.hidden = true;
    } else {
      const hero = work.cover || "";
      if (hero) {
        showPlayerHero(hero, work.title);
      } else {
        clearPlayerHero();
        playerVideo.hidden = false;
        playerMedia.hidden = true;
      }
    }
  }

  function closePlayer() {
    activeWork = null;
    activeEpisodeIndex = 0;
    player.hidden = true;
    player.classList.remove("player--deck");
    setPlayerLoading(false);
    playerVideo.pause();
    playerVideo.removeAttribute("src");
    playerVideo.removeAttribute("poster");
    playerVideo.load();
    playerVideo.hidden = false;
    clearPlayerHero();
    playerMedia.hidden = false;
    document.body.style.overflow = "";
  }

  filtersEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-filter]");
    if (!btn) return;
    activeFilter = btn.dataset.filter;
    renderFilters();
    renderWorks(true);
  });

  listEl.addEventListener("click", (e) => {
    const item = e.target.closest(".work-item");
    if (!item) return;
    const work = WORKS.find((w) => w.id === item.dataset.id);
    if (work) openCase(work);
  });

  listEl.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const item = e.target.closest(".work-item");
    if (!item) return;
    e.preventDefault();
    const work = WORKS.find((w) => w.id === item.dataset.id);
    if (work) openCase(work);
  });

  playerClose.addEventListener("click", closePlayer);
  player.addEventListener("click", (e) => {
    if (e.target === player) closePlayer();
  });
  playerDetail.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-ep]");
    if (!btn || !activeWork) return;
    playEpisode(activeWork, Number(btn.dataset.ep));
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !player.hidden) closePlayer();
  });

  function initHeroField() {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let nodes = [];
    let raf = 0;
    let w = 0;
    let h = 0;
    const pointer = { x: 0, y: 0, active: false };

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }

    function leftSafeX() {
      const content = document.querySelector(".hero-content");
      if (!content) return w * 0.48;
      const heroRect = canvas.getBoundingClientRect();
      const cRect = content.getBoundingClientRect();
      // keep a clear gap to the right of the postcard
      return Math.min(w * 0.72, Math.max(w * 0.5, cRect.right - heroRect.left + 36));
    }

    function inField(x, y) {
      if (x < leftSafeX()) return false;
      // compact ellipse on the right side only
      const cx = w * 0.8;
      const cy = h * 0.46;
      const rx = Math.min(w * 0.26, 260);
      const ry = Math.min(h * 0.36, 280);
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      return nx * nx + ny * ny <= 1;
    }

    function seed() {
      const count = Math.floor((w * h) / 5200);
      nodes = [];
      for (let i = 0; i < count; i += 1) {
        let x = 0;
        let y = 0;
        let tries = 0;
        do {
          x = Math.random() * w;
          y = Math.random() * h;
          tries += 1;
        } while (!inField(x, y) && tries < 60);
        if (!inField(x, y)) continue;

        const filled = Math.random() > 0.5;
        nodes.push({
          ox: x,
          oy: y,
          x,
          y,
          vx: 0,
          vy: 0,
          r: filled ? 4 + Math.random() * 6 : 2.5 + Math.random() * 4,
          n: String(Math.floor(Math.random() * 10)),
          filled,
          phase: Math.random() * Math.PI * 2,
          speed: 0.5 + Math.random() * 1.1,
          accent: Math.random() > 0.88,
          mass: 0.55 + Math.random() * 0.7,
        });
      }
    }

    function updatePointer(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      pointer.x = clientX - rect.left;
      pointer.y = clientY - rect.top;
      pointer.active =
        pointer.x >= -40 &&
        pointer.y >= -40 &&
        pointer.x <= rect.width + 40 &&
        pointer.y <= rect.height + 40;
    }

    function onMove(e) {
      if (e.touches && e.touches[0]) {
        updatePointer(e.touches[0].clientX, e.touches[0].clientY);
      } else {
        updatePointer(e.clientX, e.clientY);
      }
    }

    function onLeave() {
      pointer.active = false;
    }

    function draw(t) {
      ctx.clearRect(0, 0, w, h);
      const safeX = leftSafeX();

      const grad = ctx.createRadialGradient(
        w * 0.8,
        h * 0.42,
        16,
        w * 0.8,
        h * 0.42,
        Math.max(w, h) * 0.34
      );
      grad.addColorStop(0, "rgba(255,255,255,0.45)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // visible cursor influence
      if (pointer.active && pointer.x >= safeX) {
        const g = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, 100);
        g.addColorStop(0, "rgba(36,80,255,0.14)");
        g.addColorStop(1, "rgba(36,80,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(pointer.x, pointer.y, 100, 0, Math.PI * 2);
        ctx.fill();
      }

      const radius = Math.max(110, Math.min(w, h) * 0.26);
      const radiusSq = radius * radius;

      for (let i = 0; i < nodes.length; i += 1) {
        const node = nodes[i];
        const driftX = reduceMotion ? 0 : Math.cos(t * 0.0008 * node.speed + node.phase) * 2;
        const driftY = reduceMotion ? 0 : Math.sin(t * 0.0011 * node.speed + node.phase) * 2.8;
        const homeX = Math.max(safeX + 8, node.ox + driftX);
        const homeY = node.oy + driftY;

        node.vx += (homeX - node.x) * 0.06;
        node.vy += (homeY - node.y) * 0.06;

        if (pointer.active && pointer.x >= safeX) {
          const dx = node.x - pointer.x;
          const dy = node.y - pointer.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < radiusSq && distSq > 0.25) {
            const dist = Math.sqrt(distSq);
            const force = Math.pow((radius - dist) / radius, 1.15) * (16 / node.mass);
            node.vx += (dx / dist) * force * 0.16;
            node.vy += (dy / dist) * force * 0.16;
          }
        }

        node.vx *= 0.82;
        node.vy *= 0.82;
        node.x += node.vx;
        node.y += node.vy;
        if (node.x < safeX + 6) {
          node.x = safeX + 6;
          node.vx = Math.abs(node.vx) * 0.3;
        }

        const color = node.accent ? "#2450ff" : "#0d0d0d";
        if (node.filled) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.font = `${Math.max(7, node.r)}px "IBM Plex Mono", monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(node.n, node.x, node.y + 0.5);
        } else {
          ctx.fillStyle = color;
          ctx.font = `${Math.max(8, node.r + 1.5)}px "IBM Plex Mono", monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(node.n, node.x, node.y);
        }
      }

      raf = requestAnimationFrame(draw);
    }

    resize();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(draw);

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("touchstart", onMove, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onLeave, { passive: true });
    window.addEventListener("blur", onLeave);
    document.addEventListener("mouseleave", onLeave);

    window.addEventListener("resize", () => {
      resize();
    });
  }

  renderFilters();
  renderWorks(true);

  const startHero = () => initHeroField();
  if ("requestIdleCallback" in window) {
    requestIdleCallback(startHero, { timeout: 1200 });
  } else {
    setTimeout(startHero, 200);
  }

  if ("serviceWorker" in navigator && (USE_CDN || location.protocol === "https:")) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }
})();
