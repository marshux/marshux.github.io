const WORKER_URL = "https://marshux-cms-oauth.marshalx08.workers.dev";
const GITHUB_REPO = "marshux/marshux.github.io";
const PHOTOS_PATH = "data/photos.json";
const TOKEN_KEY = "marshux_admin_gh_token";

const loginView = document.getElementById("login-view");
const managerView = document.getElementById("manager-view");
const loginBtn = document.getElementById("login-btn");
const loginStatus = document.getElementById("login-status");
const logoutBtn = document.getElementById("logout-btn");
const publishBtn = document.getElementById("publish-btn");
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("file-input");
const statusLog = document.getElementById("status-log");
const photoGrid = document.getElementById("photo-grid");

let token = sessionStorage.getItem(TOKEN_KEY) || null;
let photos = [];
let fileSha = null;
let dirty = false;

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

function markDirty() {
  dirty = true;
  publishBtn.disabled = false;
}

function render() {
  photoGrid.innerHTML = photos
    .map(
      (p, i) => `
    <div class="admin-photo-card">
      <img src="${escapeHtml(p.image)}" alt="" loading="lazy" />
      <div class="card-body">
        <input type="text" value="${escapeHtml(p.alt || "")}" placeholder="Caption" data-index="${i}" class="caption-input" />
        <button class="delete-btn" data-index="${i}" title="Delete">&times;</button>
      </div>
    </div>`
    )
    .join("");

  photoGrid.querySelectorAll(".caption-input").forEach((input) => {
    input.addEventListener("input", (e) => {
      photos[Number(e.target.dataset.index)].alt = e.target.value;
      markDirty();
    });
  });

  photoGrid.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      photos.splice(Number(e.target.dataset.index), 1);
      markDirty();
      render();
    });
  });
}

function loginWithGithub() {
  return new Promise((resolve, reject) => {
    const popup = window.open(`${WORKER_URL}/auth`, "github-oauth", "width=600,height=700");
    if (!popup) {
      reject(new Error("Popup was blocked. Allow popups for this site and try again."));
      return;
    }

    function handleMessage(e) {
      if (e.data === "authorizing:github") {
        popup.postMessage("authorizing:github", "*");
        return;
      }
      if (typeof e.data !== "string") return;
      if (e.data.startsWith("authorization:github:success:")) {
        window.removeEventListener("message", handleMessage);
        const payload = JSON.parse(e.data.replace("authorization:github:success:", ""));
        resolve(payload.token);
      } else if (e.data.startsWith("authorization:github:error:")) {
        window.removeEventListener("message", handleMessage);
        reject(new Error("GitHub authorization failed."));
      }
    }
    window.addEventListener("message", handleMessage);
  });
}

async function hasPushAccess() {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}`, {
    headers: githubHeaders(),
  });
  if (!res.ok) return false;
  const data = await res.json();
  return Boolean(data.permissions && data.permissions.push);
}

async function loadPhotos() {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${PHOTOS_PATH}`,
    { headers: githubHeaders() }
  );
  if (!res.ok) throw new Error(`Couldn't load ${PHOTOS_PATH} (${res.status})`);
  const data = await res.json();
  fileSha = data.sha;
  const parsed = JSON.parse(b64DecodeUnicode(data.content.replace(/\n/g, "")));
  photos = Array.isArray(parsed.photos) ? parsed.photos : [];
  render();
}

async function enterManager() {
  loginView.hidden = true;
  managerView.hidden = false;
  setStatus("Loading photos…");
  try {
    await loadPhotos();
    setStatus("");
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
}

async function init() {
  if (!token) return;
  setStatus("");
  loginStatus.textContent = "Checking access…";
  const authorized = await hasPushAccess();
  if (!authorized) {
    loginStatus.textContent = "That GitHub account doesn't have push access to this repo.";
    sessionStorage.removeItem(TOKEN_KEY);
    token = null;
    return;
  }
  await enterManager();
}

loginBtn.addEventListener("click", async () => {
  loginStatus.textContent = "";
  try {
    token = await loginWithGithub();
    sessionStorage.setItem(TOKEN_KEY, token);
    await init();
  } catch (err) {
    loginStatus.textContent = err.message;
  }
});

logoutBtn.addEventListener("click", () => {
  sessionStorage.removeItem(TOKEN_KEY);
  token = null;
  photos = [];
  fileSha = null;
  dirty = false;
  managerView.hidden = true;
  loginView.hidden = false;
});

async function uploadOne(file) {
  const signRes = await fetch(`${WORKER_URL}/sign-upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!signRes.ok) throw new Error("Not authorized to upload.");
  const { signature, timestamp, api_key, cloud_name } = await signRes.json();

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", api_key);
  form.append("timestamp", timestamp);
  form.append("signature", signature);

  const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`, {
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

  await Promise.all(
    files.map(async (file, i) => {
      try {
        const url = await uploadOne(file);
        photos.unshift({ image: url, alt: "" });
        markDirty();
      } catch (err) {
        placeholders[i].textContent = `${file.name}: ${err.message}`;
        return;
      } finally {
        placeholders[i].remove();
      }
      render();
    })
  );
  render();
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

publishBtn.addEventListener("click", async () => {
  publishBtn.disabled = true;
  setStatus("Publishing…");
  try {
    const content = b64EncodeUnicode(JSON.stringify({ photos }, null, 2));
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${PHOTOS_PATH}`,
      {
        method: "PUT",
        headers: githubHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          message: "Update photos via admin panel",
          content,
          sha: fileSha,
          branch: "main",
        }),
      }
    );
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.message || `GitHub responded ${res.status}`);
    }
    const data = await res.json();
    fileSha = data.content.sha;
    dirty = false;
    setStatus("Published. The live site will update after GitHub Pages rebuilds (usually under a minute).");
  } catch (err) {
    setStatus(`Publish failed: ${err.message}`);
    publishBtn.disabled = false;
  }
});

init();
