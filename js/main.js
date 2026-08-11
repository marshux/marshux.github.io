document.getElementById("year").textContent = new Date().getFullYear();

const GITHUB_USER = "marshux";
// Repos to hide from the Projects grid (profile config repos, this site itself, etc.)
const HIDDEN_REPOS = new Set([GITHUB_USER, `${GITHUB_USER}.github.io`]);

async function loadProjects() {
  const grid = document.getElementById("projects-grid");
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
  try {
    const res = await fetch("photos/photos.json");
    if (!res.ok) throw new Error("no manifest");
    const photos = await res.json();

    if (!Array.isArray(photos) || photos.length === 0) {
      grid.innerHTML = `<p class="empty-state">Photography board coming soon.</p>`;
      return;
    }

    grid.innerHTML = photos
      .map(
        (p) => `<img src="photos/${escapeHtml(p.file)}" alt="${escapeHtml(p.alt || "")}" loading="lazy" />`
      )
      .join("");
  } catch (err) {
    grid.innerHTML = `<p class="empty-state">Photography board coming soon.</p>`;
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

loadProjects();
loadPhotos();
