const WORKER_URL = MarshuxAuth.WORKER_URL;
const GITHUB_REPO = MarshuxAuth.GITHUB_REPO;
const PHOTOS_PATH = "data/photos.json";
const PLAYLIST_PATH = "data/playlist.json";

const loginView = document.getElementById("login-view");
const managerView = document.getElementById("manager-view");
const loginBtn = document.getElementById("login-btn");
const loginStatus = document.getElementById("login-status");
const logoutBtn = document.getElementById("logout-btn");
const publishBtn = document.getElementById("publish-btn");
const statusLog = document.getElementById("status-log");

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("file-input");
const photoGrid = document.getElementById("admin-photo-grid");

const musicDropzone = document.getElementById("music-dropzone");
const musicFileInput = document.getElementById("music-file-input");
const trackList = document.getElementById("admin-track-list");

const sectionSelect = document.getElementById("section-select");
sectionSelect.addEventListener("change", () => {
  document.querySelectorAll(".admin-tab-panel").forEach((panel) => {
    panel.hidden = panel.id !== sectionSelect.value;
  });
});

let token = MarshuxAuth.getToken();
let photos = [];
let tracks = [];
let photosSha = null;
let playlistSha = null;
let photosDirty = false;
let tracksDirty = false;

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function setStatus(msg) {
  statusLog.textContent = msg;
}

function b64EncodeUnicode(str) {
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
  );
}

function b64DecodeUnicode(str) {
  return decodeURIComponent(
    atob(str)
      .split("")
      .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
      .join("")
  );
}

function githubHeaders(extra = {}) {
  return {
    Authorization: `Bearer ${token}`,
    "User-Agent": "marshux-admin-page",
    Accept: "application/vnd.github+json",
    ...extra,
  };
}

function markPhotosDirty() {
  photosDirty = true;
  publishBtn.disabled = false;
}

function markTracksDirty() {
  tracksDirty = true;
  publishBtn.disabled = false;
}

let keyCounter = 0;
function keyFor(item) {
  if (!item.__key) {
    Object.defineProperty(item, "__key", { value: `k${keyCounter++}`, enumerable: false });
  }
  return item.__key;
}

// ---- Generic drag-reorder + FLIP helpers, shared by the photo grid and track list ----

// Animates items currently in `container` from their pre-mutation positions
// to their post-mutation positions (FLIP technique), without touching any
// DOM node that doesn't need to move — so dragging/resizing stays smooth
// (no flicker, no lost native-drag state on the moved node).
function withFlip(container, itemSelector, mutateFn) {
  const items = Array.from(container.querySelectorAll(itemSelector));
  const firstRects = new Map();
  items.forEach((item) => firstRects.set(item, item.getBoundingClientRect()));

  mutateFn();

  container.querySelectorAll(itemSelector).forEach((item) => {
    const first = firstRects.get(item);
    if (!first) return;
    const last = item.getBoundingClientRect();
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    if (!dx && !dy) return;
    item.style.transition = "none";
    item.style.transform = `translate(${dx}px, ${dy}px)`;
    requestAnimationFrame(() => {
      item.style.transition = "transform 0.2s ease";
      item.style.transform = "";
    });
  });
}

// Re-renders via renderFn (rebuilding innerHTML), matching items across the
// rebuild by their stable data-key so the FLIP animation still works for
// structural changes (add/remove) that withFlip can't handle in place.
function renderWithFlip(container, keyedSelector, renderFn) {
  const firstRects = new Map();
  container.querySelectorAll(keyedSelector).forEach((item) => {
    firstRects.set(item.dataset.key, item.getBoundingClientRect());
  });

  renderFn();

  container.querySelectorAll(keyedSelector).forEach((item) => {
    const first = firstRects.get(item.dataset.key);
    if (!first) return;
    const last = item.getBoundingClientRect();
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    if (!dx && !dy) return;
    item.style.transition = "none";
    item.style.transform = `translate(${dx}px, ${dy}px)`;
    requestAnimationFrame(() => {
      item.style.transition = "transform 0.2s ease";
      item.style.transform = "";
    });
  });
}

function closestIndexToPoint(container, itemSelector, x, y) {
  let closest = null;
  let closestDist = Infinity;
  container.querySelectorAll(itemSelector).forEach((item) => {
    const rect = item.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dist = (x - cx) ** 2 + (y - cy) ** 2;
    if (dist < closestDist) {
      closestDist = dist;
      closest = Number(item.dataset.index);
    }
  });
  return closest;
}

// Moves the dragged item's actual DOM node next to its new neighbor (instead
// of rebuilding the list/grid), then re-numbers data-index attributes.
function moveItemInDom(container, itemSelector, fromIndex, toIndex) {
  withFlip(container, itemSelector, () => {
    const items = Array.from(container.querySelectorAll(itemSelector));
    const draggedItem = items[fromIndex];
    const referenceItem = items[toIndex];
    if (fromIndex < toIndex) {
      container.insertBefore(draggedItem, referenceItem.nextSibling);
    } else {
      container.insertBefore(draggedItem, referenceItem);
    }
    container.querySelectorAll(itemSelector).forEach((item, i) => {
      item.dataset.index = i;
    });
  });
}

// Wires native HTML5 drag-and-drop reordering onto `container` for children
// matching `itemSelector`, using event delegation so it keeps working across
// re-renders without rebinding. `onReorder(fromIndex, toIndex)` should update
// the underlying data array; the DOM move + animation happen here.
function makeSortable(container, itemSelector, onReorder) {
  let draggedIndex = null;
  let dragoverPending = false;
  let lastDragoverEvent = null;

  container.addEventListener("dragstart", (e) => {
    const item = e.target.closest(itemSelector);
    if (!item) return;
    draggedIndex = Number(item.dataset.index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", item.dataset.index);
    requestAnimationFrame(() => item.classList.add("dragging"));
  });

  container.addEventListener("dragend", (e) => {
    const item = e.target.closest(itemSelector);
    if (item) item.classList.remove("dragging");
    draggedIndex = null;
  });

  container.addEventListener("dragover", (e) => {
    if (draggedIndex === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    lastDragoverEvent = e;
    if (dragoverPending) return;
    dragoverPending = true;
    requestAnimationFrame(() => {
      dragoverPending = false;
      if (draggedIndex === null) return;

      const targetItem = lastDragoverEvent.target.closest(itemSelector);
      const targetIndex = targetItem
        ? Number(targetItem.dataset.index)
        : closestIndexToPoint(container, itemSelector, lastDragoverEvent.clientX, lastDragoverEvent.clientY);

      if (targetIndex === null || targetIndex === draggedIndex) return;
      onReorder(draggedIndex, targetIndex);
      moveItemInDom(container, itemSelector, draggedIndex, targetIndex);
      draggedIndex = targetIndex;
    });
  });

  container.addEventListener("drop", (e) => e.preventDefault());
}

// ---- Photos ----

const SIZE_LABELS = { "": "Small", wide: "Wide", tall: "Tall", big: "Big" };

function renderPhotos() {
  photoGrid.innerHTML = photos
    .map((p, i) => {
      const size = p.size && p.size !== "small" ? p.size : "";
      const sizeClass = size ? `size-${size}` : "";
      const options = Object.entries(SIZE_LABELS)
        .map(([value, label]) => `<option value="${value}" ${value === size ? "selected" : ""}>${label}</option>`)
        .join("");
      return `
    <div class="admin-photo-card ${sizeClass}" draggable="true" data-index="${i}" data-key="${keyFor(p)}">
      <img src="${escapeHtml(p.image)}" alt="" loading="lazy" />
      <div class="card-body">
        <input type="text" value="${escapeHtml(p.alt || "")}" placeholder="Caption" data-index="${i}" class="caption-input" />
        <div class="card-body-row">
          <select class="size-select" data-index="${i}" title="Tile size">${options}</select>
          <button class="delete-btn" data-index="${i}" title="Delete">&times;</button>
        </div>
      </div>
    </div>`;
    })
    .join("");

  photoGrid.querySelectorAll(".caption-input").forEach((input) => {
    input.addEventListener("input", (e) => {
      photos[Number(e.target.dataset.index)].alt = e.target.value;
      markPhotosDirty();
    });
  });

  photoGrid.querySelectorAll(".size-select").forEach((select) => {
    select.addEventListener("change", (e) => {
      const idx = Number(e.target.dataset.index);
      const value = e.target.value;
      if (value) {
        photos[idx].size = value;
      } else {
        delete photos[idx].size;
      }
      markPhotosDirty();
      withFlip(photoGrid, ".admin-photo-card[data-index]", () => {
        const card = photoGrid.querySelector(`.admin-photo-card[data-index="${idx}"]`);
        card.classList.remove("size-wide", "size-tall", "size-big");
        if (value) card.classList.add(`size-${value}`);
      });
    });
  });

  photoGrid.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      photos.splice(Number(e.target.dataset.index), 1);
      markPhotosDirty();
      renderWithFlip(photoGrid, ".admin-photo-card[data-key]", renderPhotos);
    });
  });
}

makeSortable(photoGrid, ".admin-photo-card[data-index]", (from, to) => {
  const [moved] = photos.splice(from, 1);
  photos.splice(to, 0, moved);
  markPhotosDirty();
});

// ---- Music ----

function renderTracks() {
  trackList.innerHTML = tracks
    .map(
      (t, i) => `
    <div class="track-row" draggable="true" data-index="${i}" data-key="${keyFor(t)}">
      <span class="track-handle" aria-hidden="true">&#9776;</span>
      <input type="text" value="${escapeHtml(t.title || "")}" placeholder="Title" data-index="${i}" class="track-title-input" />
      <input type="text" value="${escapeHtml(t.artist || "")}" placeholder="Artist" data-index="${i}" class="track-artist-input" />
      <button class="delete-btn" data-index="${i}" title="Delete">&times;</button>
    </div>`
    )
    .join("");

  trackList.querySelectorAll(".track-title-input").forEach((input) => {
    input.addEventListener("input", (e) => {
      tracks[Number(e.target.dataset.index)].title = e.target.value;
      markTracksDirty();
    });
  });

  trackList.querySelectorAll(".track-artist-input").forEach((input) => {
    input.addEventListener("input", (e) => {
      tracks[Number(e.target.dataset.index)].artist = e.target.value;
      markTracksDirty();
    });
  });

  trackList.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      tracks.splice(Number(e.target.dataset.index), 1);
      markTracksDirty();
      renderWithFlip(trackList, ".track-row[data-key]", renderTracks);
    });
  });
}

makeSortable(trackList, ".track-row[data-index]", (from, to) => {
  const [moved] = tracks.splice(from, 1);
  tracks.splice(to, 0, moved);
  markTracksDirty();
});

// ---- Load / login / logout ----

async function loadJsonFile(path) {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`, {
    headers: githubHeaders(),
  });
  if (!res.ok) throw new Error(`Couldn't load ${path} (${res.status})`);
  const data = await res.json();
  const parsed = JSON.parse(b64DecodeUnicode(data.content.replace(/\n/g, "")));
  return { parsed, sha: data.sha };
}

async function loadPhotos() {
  const { parsed, sha } = await loadJsonFile(PHOTOS_PATH);
  photosSha = sha;
  photos = Array.isArray(parsed.photos) ? parsed.photos : [];
  renderPhotos();
}

async function loadTracks() {
  const { parsed, sha } = await loadJsonFile(PLAYLIST_PATH);
  playlistSha = sha;
  tracks = Array.isArray(parsed.tracks) ? parsed.tracks : [];
  renderTracks();
}

async function enterManager() {
  loginView.hidden = true;
  managerView.hidden = false;
  setStatus("Loading…");
  try {
    await Promise.all([loadPhotos(), loadTracks()]);
    setStatus("");
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
}

async function init() {
  if (!token) return;
  setStatus("");
  loginStatus.textContent = "Checking access…";
  const authorized = await MarshuxAuth.hasPushAccess(token);
  if (!authorized) {
    loginStatus.textContent = "That GitHub account doesn't have push access to this repo.";
    MarshuxAuth.clearToken();
    token = null;
    return;
  }
  await enterManager();
}

loginBtn.addEventListener("click", async () => {
  loginStatus.textContent = "";
  try {
    token = await MarshuxAuth.login();
    MarshuxAuth.setToken(token);
    await init();
  } catch (err) {
    loginStatus.textContent = err.message;
  } finally {
    if (window.MarshuxAuthNav) window.MarshuxAuthNav.refresh();
  }
});

logoutBtn.addEventListener("click", () => {
  MarshuxAuth.clearToken();
  token = null;
  photos = [];
  tracks = [];
  photosSha = null;
  playlistSha = null;
  photosDirty = false;
  tracksDirty = false;
  managerView.hidden = true;
  loginView.hidden = false;
  if (window.MarshuxAuthNav) window.MarshuxAuthNav.refresh();
});

// ---- Upload ----

async function signUpload() {
  const signRes = await fetch(`${WORKER_URL}/sign-upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!signRes.ok) throw new Error("Not authorized to upload.");
  return signRes.json();
}

async function uploadToCloudinary(file, resourceType) {
  const { signature, timestamp, api_key, cloud_name } = await signUpload();

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", api_key);
  form.append("timestamp", timestamp);
  form.append("signature", signature);

  const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloud_name}/${resourceType}/upload`, {
    method: "POST",
    body: form,
  });
  if (!uploadRes.ok) {
    const errBody = await uploadRes.json().catch(() => ({}));
    throw new Error(errBody.error?.message || "Cloudinary upload failed.");
  }
  const data = await uploadRes.json();
  return data.secure_url;
}

async function handleFiles(fileList) {
  const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
  if (files.length === 0) return;

  const placeholders = files.map((file) => {
    const el = document.createElement("div");
    el.className = "admin-photo-card uploading";
    el.textContent = `Uploading ${file.name}…`;
    photoGrid.prepend(el);
    return el;
  });

  const results = await Promise.allSettled(files.map((file) => uploadToCloudinary(file, "image")));

  const errors = [];
  results.forEach((result, i) => {
    placeholders[i].remove();
    if (result.status === "fulfilled") {
      photos.unshift({ image: result.value, alt: "" });
    } else {
      errors.push(`${files[i].name}: ${result.reason.message}`);
    }
  });

  if (results.some((r) => r.status === "fulfilled")) {
    markPhotosDirty();
  }
  renderWithFlip(photoGrid, ".admin-photo-card[data-key]", renderPhotos);
  setStatus(errors.length ? errors.join(" | ") : "");
}

function titleFromFilename(name) {
  return name.replace(/\.[^/.]+$/, "");
}

async function handleMusicFiles(fileList) {
  const files = Array.from(fileList).filter((f) => f.type.startsWith("audio/"));
  if (files.length === 0) return;

  const placeholders = files.map((file) => {
    const el = document.createElement("div");
    el.className = "track-row uploading";
    el.textContent = `Uploading ${file.name}…`;
    trackList.prepend(el);
    return el;
  });

  const results = await Promise.allSettled(files.map((file) => uploadToCloudinary(file, "video")));

  const errors = [];
  results.forEach((result, i) => {
    placeholders[i].remove();
    if (result.status === "fulfilled") {
      tracks.push({ title: titleFromFilename(files[i].name), artist: "", url: result.value });
    } else {
      errors.push(`${files[i].name}: ${result.reason.message}`);
    }
  });

  if (results.some((r) => r.status === "fulfilled")) {
    markTracksDirty();
  }
  renderWithFlip(trackList, ".track-row[data-key]", renderTracks);
  setStatus(errors.length ? errors.join(" | ") : "");
}

fileInput.addEventListener("change", (e) => handleFiles(e.target.files));

["dragenter", "dragover"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  })
);
["dragleave", "drop"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
  })
);
dropzone.addEventListener("drop", (e) => handleFiles(e.dataTransfer.files));

musicFileInput.addEventListener("change", (e) => handleMusicFiles(e.target.files));

["dragenter", "dragover"].forEach((evt) =>
  musicDropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    musicDropzone.classList.add("dragover");
  })
);
["dragleave", "drop"].forEach((evt) =>
  musicDropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    musicDropzone.classList.remove("dragover");
  })
);
musicDropzone.addEventListener("drop", (e) => handleMusicFiles(e.dataTransfer.files));

// ---- Publish ----

async function publishFile(path, sha, body) {
  const content = b64EncodeUnicode(JSON.stringify(body, null, 2));
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`, {
    method: "PUT",
    headers: githubHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      message: "Update via admin panel",
      content,
      sha,
      branch: "main",
    }),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.message || `GitHub responded ${res.status}`);
  }
  const data = await res.json();
  return data.content.sha;
}

publishBtn.addEventListener("click", async () => {
  publishBtn.disabled = true;
  setStatus("Publishing…");
  try {
    if (photosDirty) {
      photosSha = await publishFile(PHOTOS_PATH, photosSha, { photos });
      photosDirty = false;
    }
    if (tracksDirty) {
      playlistSha = await publishFile(PLAYLIST_PATH, playlistSha, { tracks });
      tracksDirty = false;
    }
    setStatus("Published! The live site will update shortly. Returning to the homepage…");
    setTimeout(() => {
      window.location.href = "../";
    }, 1500);
  } catch (err) {
    setStatus(`Publish failed: ${err.message}`);
    publishBtn.disabled = false;
  }
});

init();
