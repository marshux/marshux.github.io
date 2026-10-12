const GITHUB_USER = "marshux";
// Repos to hide from the Projects grid (profile config repos, this site itself, etc.)
const HIDDEN_REPOS = new Set([GITHUB_USER, `${GITHUB_USER}.github.io`]);

document.addEventListener("includes:loaded", () => {
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
  highlightActiveNavLink();
  initThemeToggle();
});

function highlightActiveNavLink() {
  let current = location.pathname.split("/").pop() || "index.html";
  if (location.pathname.startsWith("/admin")) {
    current = "admin";
  }
  document.querySelectorAll(".nav-links a[data-page]").forEach((link) => {
    link.classList.toggle("active", link.getAttribute("data-page") === current);
  });
}

const THEME_KEY = "marshux-theme";

function currentTheme() {
  const explicit = document.documentElement.getAttribute("data-theme");
  if (explicit) return explicit;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function initThemeToggle() {
  const toggle = document.getElementById("theme-toggle");
  if (!toggle) return;
  toggle.addEventListener("click", () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    const apply = () => {
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem(THEME_KEY, next);
    };
    // View Transitions crossfade two rasterized snapshots (each computed
    // once) instead of live-animating colors, so it doesn't force the
    // sticky nav/player's backdrop-filter blur to recompute every frame
    // the way the old CSS transition did.
    if (document.startViewTransition) {
      document.startViewTransition(apply);
    } else {
      apply();
    }
  });
}

// Decap CMS stores the full Cloudinary delivery URL it gets back from the
// media library widget. Inject auto format/quality, and cap the delivered
// size to roughly what the grid cell can actually show — the originals are
// full-resolution camera shots, and serving those into a 140px cell was the
// main cause of slow loads and a sluggish theme-toggle animation on this page.
const GRID_WIDTH_BY_SIZE = { big: 700, wide: 700, tall: 400 };

function withAutoOptimize(cloudinaryUrl, size) {
  const w = GRID_WIDTH_BY_SIZE[size] || 300;
  return cloudinaryUrl.replace("/image/upload/", `/image/upload/f_auto,q_auto,c_limit,w_${w}/`);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Per-repo display overrides (image/TLDR/tags) — see PROJECTS.md for the
// schema and how to add an entry for a repo.
async function loadProjectOverrides() {
  try {
    const res = await fetch("data/project-overrides.json");
    if (!res.ok) throw new Error("no overrides");
    const data = await res.json();
    return data && typeof data === "object" ? data : {};
  } catch (err) {
    return {};
  }
}

async function loadProjects() {
  const grid = document.getElementById("projects-grid");
  if (!grid) return;

  try {
    const [res, overrides] = await Promise.all([
      fetch(`https://api.github.com/users/${GITHUB_USER}/repos?sort=updated&per_page=100`),
      loadProjectOverrides(),
    ]);
    if (!res.ok) throw new Error(`GitHub API responded ${res.status}`);
    const repos = await res.json();
    const visible = repos.filter((r) => !r.fork && !HIDDEN_REPOS.has(r.name));

    if (visible.length === 0) {
      grid.innerHTML = `<p class="empty-state">No public projects yet &mdash; check back soon.</p>`;
      return;
    }

    grid.innerHTML = visible
      .map((r) => {
        const o = overrides[r.name] || {};
        const tldr = o.tldr || r.description || "No description yet.";
        const tags = Array.isArray(o.tags) && o.tags.length ? o.tags : r.language ? [r.language] : [];
        const imageHtml = o.image
          ? `<div class="project-row-image"><img src="${withAutoOptimize(o.image)}" alt="" loading="lazy" decoding="async" /></div>`
          : "";
        const tagsHtml = tags.length
          ? `<div class="project-tags">${tags.map((t) => `<span class="project-tag">${escapeHtml(t)}</span>`).join("")}</div>`
          : "";
        return `
      <article class="project-row">
        ${imageHtml}
        <div class="project-row-body">
          <h3><a href="${r.html_url}" target="_blank" rel="noopener">${escapeHtml(r.name)}</a></h3>
          <p class="project-desc">${escapeHtml(tldr)}</p>
          ${tagsHtml}
          <div class="project-meta">
            ${r.language ? `<span><span class="lang-dot"></span>${escapeHtml(r.language)}</span>` : ""}
            <span>&#9733; ${r.stargazers_count}</span>
          </div>
        </div>
      </article>`;
      })
      .join("");
    startTyping(grid.children);
  } catch (err) {
    grid.innerHTML = `<p class="empty-state">Couldn't load projects right now. See them directly on <a href="https://github.com/${GITHUB_USER}?tab=repositories" target="_blank" rel="noopener">GitHub</a>.</p>`;
  }
}

async function loadPhotos() {
  const grid = document.getElementById("photo-grid");
  if (!grid) return;

  try {
    const res = await fetch("data/photos.json");
    if (!res.ok) throw new Error("no manifest");
    const data = await res.json();
    const photos = Array.isArray(data.photos) ? data.photos : [];

    if (photos.length === 0) {
      grid.innerHTML = `<p class="empty-state">Photography board coming soon.</p>`;
      return;
    }

    grid.innerHTML = photos
      .map((p) => {
        const sizeClass = p.size && p.size !== "small" ? `size-${p.size}` : "";
        return `<div class="photo-tile ${sizeClass}"><img class="photo-img" src="${withAutoOptimize(p.image, p.size)}" alt="${escapeHtml(p.alt || "")}" loading="lazy" decoding="async" /></div>`;
      })
      .join("");

    grid.querySelectorAll(".photo-img").forEach((img) => {
      const markLoaded = () => img.classList.add("is-loaded");
      if (img.complete && img.naturalWidth > 0) markLoaded();
      else {
        img.addEventListener("load", markLoaded, { once: true });
        img.addEventListener("error", markLoaded, { once: true });
      }
    });
  } catch (err) {
    grid.innerHTML = `<p class="empty-state">Photography board coming soon.</p>`;
  }
}

// ---- Typewriter motion (styles: "Typewriter treatment" in css/style.css) ----
//
// Everything types at once: each [data-type] / [data-reveal] element in
// <main>, and each list row as its data loads, starts typing as soon as it
// exists, and every piece of text inside it (title, description, each tag)
// is typed in parallel at the same steady pace. Long text simply finishes
// later than short text, rather than anything being sped up to keep time.

const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
const BODY_CHARS_PER_SEC = 70;
let typeRun = 0;

// Typing waits for the two things that would otherwise move text around
// underneath it: the nav partial (pushes <main> down when it arrives) and
// the webfonts (re-wrap every line when they swap in). <main> is hidden
// until then -- see html:not(.is-ready) in css/style.css.
const pageReady = Promise.all([
  new Promise((resolve) => document.addEventListener("includes:loaded", resolve, { once: true })),
  Promise.race([
    Promise.all(['1em "Special Elite"', '1em "Courier Prime"', '700 1em "Courier Prime"'].map((f) => document.fonts.load(f))),
    sleep(1500),
  ]).catch(() => {}),
]).then(() => document.documentElement.classList.add("is-ready"));

// Types one text node. It is split into a visible .typed span and a
// transparent .untyped one, so the full text stays in the DOM throughout:
// layout never shifts and assistive tech / copy-paste still see all of it.
async function typeNode(node, slow, run) {
  const text = node.nodeValue;
  const wrap = document.createElement("span");
  const typed = document.createElement("span");
  typed.className = "typed";
  const untyped = document.createElement("span");
  untyped.className = "untyped";
  untyped.textContent = text;
  wrap.append(typed, untyped);
  node.replaceWith(wrap);
  const show = (n) => {
    typed.textContent = text.slice(0, n);
    untyped.textContent = text.slice(n);
  };

  if (slow) {
    // headings: uneven, human keystrokes with a longer beat after a space
    for (let i = 1; i <= text.length; i++) {
      await sleep(text[i - 2] === " " ? 100 : 30 + Math.random() * 45);
      if (run !== typeRun || !wrap.isConnected) return;
      show(i);
    }
  } else {
    const start = performance.now();
    let n = 0;
    while (n < text.length) {
      const now = await nextFrame();
      if (run !== typeRun || !wrap.isConnected) return;
      n = Math.min(text.length, Math.floor(((now - start) / 1000) * BODY_CHARS_PER_SEC));
      show(n);
    }
  }
  wrap.replaceWith(document.createTextNode(text));
}

// Starts typing every text node inside each of `els`, all at the same time.
async function startTyping(els) {
  if (REDUCED_MOTION.matches) return;
  const run = typeRun;
  await pageReady;
  if (run !== typeRun) return;
  for (const el of els) {
    const slow = el.hasAttribute("data-type");
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      if (walker.currentNode.nodeValue.trim()) nodes.push(walker.currentNode);
    }
    const done = Promise.all(nodes.map((node) => typeNode(node, slow, run)));
    if (slow) done.then(() => run === typeRun && el.classList.add("type-caret"));
  }
}

// Runs on first load and after every router swap of <main>.
function initTypewriter() {
  const main = document.querySelector("main");
  if (!main) return;
  typeRun++;
  startTyping(main.querySelectorAll("[data-type], [data-reveal]"));
}

// data/experience.json schema and how to add an entry: see EXPERIENCE.md.
async function loadExperience() {
  const list = document.getElementById("experience-list");
  if (!list) return;

  try {
    const res = await fetch("data/experience.json");
    if (!res.ok) throw new Error("no manifest");
    const data = await res.json();
    const roles = Array.isArray(data.roles) ? data.roles : [];

    if (roles.length === 0) {
      list.innerHTML = `<p class="empty-state">Professional history coming soon.</p>`;
      return;
    }

    list.innerHTML = roles
      .map((r) => {
        const dateRange = [r.start, r.end].filter(Boolean).map(escapeHtml).join(" &ndash; ");
        const tags = Array.isArray(r.tags) ? r.tags : [];
        const tagsHtml = tags.length
          ? `<div class="experience-tags">${tags.map((t) => `<span class="experience-tag">${escapeHtml(t)}</span>`).join("")}</div>`
          : "";
        const subtitle = [r.company, r.location].filter(Boolean).map(escapeHtml).join(" &middot; ");
        return `
      <article class="experience-item">
        <div class="experience-dates">${dateRange}</div>
        <div class="experience-body">
          <h3>${escapeHtml(r.role || "Untitled role")}</h3>
          ${subtitle ? `<p class="experience-company">${subtitle}</p>` : ""}
          ${r.description ? `<p class="experience-desc">${escapeHtml(r.description)}</p>` : ""}
          ${tagsHtml}
        </div>
      </article>`;
      })
      .join("");
    startTyping(list.children);
  } catch (err) {
    list.innerHTML = `<p class="empty-state">Professional history coming soon.</p>`;
  }
}

initTypewriter();
loadProjects();
loadPhotos();
loadExperience();
