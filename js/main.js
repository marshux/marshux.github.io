const GITHUB_USER = "marshux";
// Repos to hide from the Projects grid (profile config repos, this site itself, etc.)
const HIDDEN_REPOS = new Set([GITHUB_USER, `${GITHUB_USER}.github.io`]);

// TODO: set this to your Cloudinary cloud name after signing up at https://cloudinary.com
// (Dashboard -> shows "Cloud name" near the top). See PHOTOS.md for the full setup.
const CLOUDINARY_CLOUD_NAME = "your-cloud-name";

document.addEventListener("includes:loaded", () => {
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
  highlightActiveNavLink();
});

function highlightActiveNavLink() {
  const current = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-links a[data-page]").forEach((link) => {
    if (link.getAttribute("data-page") === current) {
      link.classList.add("active");
    }
  });
}

function cloudinaryUrl(publicId, transform = "f_auto,q_auto,w_900") {
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${transform}/${publicId}`;
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
    const photos = await res.json();

    if (!Array.isArray(photos) || photos.length === 0) {
      grid.innerHTML = `<p class="empty-state">Photography board coming soon.</p>`;
      return;
    }

    grid.innerHTML = photos
      .map(
        (p) =>
          `<img src="${cloudinaryUrl(p.publicId)}" alt="${escapeHtml(p.alt || "")}" loading="lazy" />`
      )
      .join("");
  } catch (err) {
    grid.innerHTML = `<p class="empty-state">Photography board coming soon.</p>`;
  }
}

loadProjects();
loadPhotos();
