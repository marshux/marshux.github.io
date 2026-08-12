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

async function loadProjects() {
  const grid = document.getElementById("projects-grid");
  if (!grid) return;

  try {
    const res = await fetch(
      `https://api.github.com/users/${GITHUB_USER}/repos?sort=updated&per_page=100`
    );
    if (!res.ok) throw new Error(`GitHub API responded ${res.status}`);
    const repos = await res.json();
    const visible = repos.filter((r) => !r.fork && !HIDDEN_REPOS.has(r.name));

    if (visible.length === 0) {
      grid.innerHTML = `<p class="empty-state">No public projects yet &mdash; check back soon.</p>`;
      return;
    }

    grid.innerHTML = visible
      .map(
        (r) => `
      <article class="project-card">
        <h3><a href="${r.html_url}" target="_blank" rel="noopener">${escapeHtml(r.name)}</a></h3>
        <p class="project-desc">${escapeHtml(r.description || "No description yet.")}</p>
        <div class="project-meta">
          ${r.language ? `<span><span class="lang-dot"></span>${escapeHtml(r.language)}</span>` : ""}
          <span>&#9733; ${r.stargazers_count}</span>
        </div>
      </article>`
      )
      .join("");
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

loadProjects();
loadPhotos();
