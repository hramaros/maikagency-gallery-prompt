(() => {
  "use strict";

  const cfg = window.GALLERY_CONFIG || {};
  const F = cfg.fields || {};
  const gallery = document.getElementById("gallery");
  const stateEl = document.getElementById("state");
  const statsEl = document.getElementById("stats");
  const searchEl = document.getElementById("search");
  const filtersEl = document.getElementById("filters");
  const cardTpl = document.getElementById("card-tpl");

  const ALL = "__all__";
  let items = [];
  let activeCategory = ALL;

  // --- Helpers ---------------------------------------------------------------

  const get = (row, key, fallback = "") =>
    row[key] !== undefined && row[key] !== null ? row[key] : fallback;

  // Accept several response shapes: array, {data:[]}, {results:[]}, single object.
  function normalize(payload) {
    let rows = payload;
    if (Array.isArray(payload)) rows = payload;
    else if (payload && Array.isArray(payload.data)) rows = payload.data;
    else if (payload && Array.isArray(payload.results)) rows = payload.results;
    else if (payload && typeof payload === "object") rows = [payload];
    else rows = [];

    return rows
      .map((r) => ({
        id: get(r, F.id || "id", get(r, "id", "")),
        imageUrl: get(r, F.imageUrl || "imageUrl"),
        prompt: get(r, F.prompt || "prompt"),
        category: String(get(r, F.category || "category")).trim(),
        fileName: get(r, F.fileName || "fileName"),
        driveViewUrl: get(r, F.driveViewUrl || "driveViewUrl"),
        createdAt: get(r, F.createdAt || "createdAt"),
      }))
      .filter((r) => r.imageUrl);
  }

  function sortRows(rows) {
    if (!cfg.newestFirst) return rows;
    return rows.slice().sort((a, b) => {
      const da = Date.parse(a.createdAt) || 0;
      const db = Date.parse(b.createdAt) || 0;
      return db - da;
    });
  }

  function fmtDate(s) {
    const d = new Date(s);
    if (isNaN(d)) return "";
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  }

  // Fallback image: derive a Drive thumbnail from the file id if the direct link fails.
  function fallbackFromId(id) {
    return id ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1000` : "";
  }

  let toastTimer;
  function toast(msg) {
    let el = document.querySelector(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    requestAnimationFrame(() => el.classList.add("show"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast("Prompt copié ✓");
    } catch {
      toast("Copie impossible");
    }
  }

  // --- Rendering -------------------------------------------------------------

  function skeleton() {
    gallery.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "skeleton-grid";
    for (let i = 0; i < 10; i++) {
      const s = document.createElement("div");
      s.className = "skeleton";
      grid.appendChild(s);
    }
    gallery.appendChild(grid);
    stateEl.textContent = "";
  }

  function render(rows) {
    gallery.innerHTML = "";
    if (!rows.length) {
      stateEl.className = "state";
      stateEl.textContent = "Aucune image pour le moment. Déposez-en une dans le dossier Drive ✨";
      return;
    }
    stateEl.textContent = "";
    const frag = document.createDocumentFragment();

    rows.forEach((row, i) => {
      const node = cardTpl.content.cloneNode(true);
      const card = node.querySelector(".card");
      const img = node.querySelector("img");
      const promptEl = node.querySelector(".card-prompt");
      const copyBtn = node.querySelector(".card-copy");
      const catEl = node.querySelector(".card-cat");

      if (catEl && row.category) {
        catEl.textContent = row.category;
        catEl.hidden = false;
      }

      card.style.animationDelay = `${Math.min(i * 35, 600)}ms`;
      img.src = row.imageUrl;
      img.alt = row.prompt ? row.prompt.slice(0, 80) : row.fileName || "Image IA";
      img.dataset.triedFallback = "";
      img.addEventListener("error", () => {
        if (!img.dataset.triedFallback && row.id) {
          img.dataset.triedFallback = "1";
          img.src = fallbackFromId(row.id);
        }
      });
      promptEl.textContent = row.prompt || "(prompt indisponible)";

      node.querySelector(".card-media").addEventListener("click", (e) => {
        if (e.target === copyBtn) return;
        openLightbox(row);
      });
      copyBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        copyText(row.prompt || "");
      });

      frag.appendChild(node);
    });

    gallery.appendChild(frag);
  }

  function matchesCategory(r) {
    return activeCategory === ALL || (r.category || "") === activeCategory;
  }

  function applyFilter() {
    const q = searchEl.value.trim().toLowerCase();
    const filtered = items.filter((r) => {
      if (!matchesCategory(r)) return false;
      if (!q) return true;
      return (r.prompt || "").toLowerCase().includes(q) || (r.fileName || "").toLowerCase().includes(q);
    });
    render(filtered);
    updateStats(filtered.length);
  }

  // Build the category filter chips from the categories present in the data.
  function buildFilters() {
    const counts = new Map();
    items.forEach((r) => {
      const c = r.category;
      if (c) counts.set(c, (counts.get(c) || 0) + 1);
    });

    // No category data at all → hide the filter bar entirely.
    if (counts.size === 0) {
      filtersEl.hidden = true;
      filtersEl.innerHTML = "";
      return;
    }

    // "Autre" (fallback bucket) is always pushed to the end, the rest sorted A→Z.
    const cats = [...counts.keys()].sort((a, b) => {
      if (a === "Autre") return 1;
      if (b === "Autre") return -1;
      return a.localeCompare(b, "fr");
    });

    if (!cats.includes(activeCategory) && activeCategory !== ALL) activeCategory = ALL;

    const chips = [{ key: ALL, label: cfg.allCategoriesLabel || "Toutes", count: items.length }]
      .concat(cats.map((c) => ({ key: c, label: c, count: counts.get(c) })));

    filtersEl.innerHTML = "";
    chips.forEach(({ key, label, count }) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip" + (key === activeCategory ? " active" : "");
      btn.dataset.cat = key;
      btn.setAttribute("aria-pressed", key === activeCategory ? "true" : "false");
      btn.innerHTML = `${label}<span class="chip-count">${count}</span>`;
      btn.addEventListener("click", () => {
        activeCategory = key;
        buildFilters();
        applyFilter();
      });
      filtersEl.appendChild(btn);
    });
    filtersEl.hidden = false;
  }

  function updateStats(shown) {
    statsEl.hidden = false;
    statsEl.innerHTML = `<strong>${items.length}</strong> image(s)` +
      (shown !== items.length ? ` · <strong>${shown}</strong> affichée(s)` : "");
  }

  // --- Lightbox --------------------------------------------------------------

  const lightbox = document.getElementById("lightbox");
  const lbImg = document.getElementById("lb-img");
  const lbPrompt = document.getElementById("lb-prompt");
  const lbDate = document.getElementById("lb-date");
  const lbCat = document.getElementById("lb-cat");
  const lbCopy = document.getElementById("lb-copy");

  function openLightbox(row) {
    // Same fallback strategy as the cards: if the direct lh3 link fails, retry
    // with a Drive thumbnail derived from the file id.
    lbImg.dataset.triedFallback = "";
    lbImg.onerror = () => {
      if (!lbImg.dataset.triedFallback && row.id) {
        lbImg.dataset.triedFallback = "1";
        lbImg.src = fallbackFromId(row.id);
      }
    };
    lbImg.src = row.imageUrl;
    lbImg.alt = row.prompt || row.fileName || "";
    lbPrompt.textContent = row.prompt || "(prompt indisponible)";
    lbDate.textContent = fmtDate(row.createdAt);
    if (lbCat) {
      if (row.category) { lbCat.textContent = row.category; lbCat.hidden = false; }
      else lbCat.hidden = true;
    }
    lbCopy.onclick = () => copyText(row.prompt || "");
    lightbox.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeLightbox() {
    lightbox.hidden = true;
    lbImg.onerror = null;
    lbImg.removeAttribute("src");
    document.body.style.overflow = "";
  }
  const lbCloseBtn = lightbox.querySelector(".lightbox-close");
  if (lbCloseBtn) lbCloseBtn.addEventListener("click", (e) => { e.stopPropagation(); closeLightbox(); });
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox || e.target.closest(".lightbox-close")) closeLightbox();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !lightbox.hidden) closeLightbox(); });

  // --- Data ------------------------------------------------------------------

  async function load() {
    if (!cfg.apiUrl || cfg.apiUrl.includes("VOTRE")) {
      stateEl.className = "state error";
      stateEl.textContent = "Configurez d'abord apiUrl dans config.js";
      return;
    }
    skeleton();
    try {
      const res = await fetch(cfg.apiUrl, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      items = sortRows(normalize(data));
      buildFilters();
      applyFilter();
    } catch (err) {
      gallery.innerHTML = "";
      stateEl.className = "state error";
      stateEl.innerHTML = `Impossible de charger la galerie.<br><small>${String(err.message || err)}</small>` +
        `<br><small>Vérifiez l'URL de l'API et que le workflow n8n est actif.</small>`;
    }
  }

  // --- Wire up ---------------------------------------------------------------

  let debounce;
  searchEl.addEventListener("input", () => { clearTimeout(debounce); debounce = setTimeout(applyFilter, 120); });
  document.getElementById("refresh").addEventListener("click", load);

  const apiLink = document.getElementById("apiLink");
  if (apiLink && cfg.apiUrl) apiLink.href = cfg.apiUrl;

  load();
})();
