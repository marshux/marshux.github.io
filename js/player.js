const PLAYER_STATE_KEY = "marshux-player-state";
// Caps how loud the slider can go, as a fraction of each track's original
// volume — dragging the slider all the way up still only reaches a quarter
// of full volume, since louder settings were too loud in practice.
const MAX_VOLUME = 0.25;

function loadPlayerState() {
  try {
    return JSON.parse(sessionStorage.getItem(PLAYER_STATE_KEY)) || {};
  } catch (err) {
    return {};
  }
}

function savePlayerState(state) {
  sessionStorage.setItem(PLAYER_STATE_KEY, JSON.stringify(state));
}

function escapePlayerHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function initPlayer() {
  const bar = document.getElementById("player-bar");
  const audio = document.getElementById("player-audio");
  if (!bar || !audio) return;

  let tracks = [];
  try {
    const res = await fetch("/data/playlist.json");
    if (!res.ok) throw new Error("no playlist");
    const data = await res.json();
    tracks = Array.isArray(data.tracks) ? data.tracks : [];
  } catch (err) {
    tracks = [];
  }

  if (tracks.length === 0) {
    bar.hidden = true;
    return;
  }

  const titleEl = document.getElementById("player-title");
  const artistEl = document.getElementById("player-artist");
  const toggleBtn = document.getElementById("player-toggle");
  const prevBtn = document.getElementById("player-prev");
  const nextBtn = document.getElementById("player-next");
  const muteBtn = document.getElementById("player-mute");
  const volumeSlider = document.getElementById("player-volume-slider");
  const queueToggleBtn = document.getElementById("player-queue-toggle");
  const queueList = document.getElementById("player-queue");
  const seekSlider = document.getElementById("player-seek-slider");
  const currentTimeEl = document.getElementById("player-current-time");
  const durationEl = document.getElementById("player-duration");
  let isSeeking = false;

  const savedState = loadPlayerState();
  let index =
    Number.isInteger(savedState.trackIndex) && savedState.trackIndex >= 0 && savedState.trackIndex < tracks.length
      ? savedState.trackIndex
      : 0;
  const wantsPlaying = Boolean(savedState.playing);
  const resumeAt = typeof savedState.currentTime === "number" ? savedState.currentTime : 0;
  audio.muted = Boolean(savedState.muted);
  const savedSliderFraction = typeof savedState.volume === "number" ? savedState.volume : 0.5;
  audio.volume = savedSliderFraction * MAX_VOLUME;
  volumeSlider.value = String(Math.round(savedSliderFraction * 100));

  function updateTrackInfo() {
    const track = tracks[index];
    titleEl.textContent = track.title || "Untitled";
    artistEl.textContent = track.artist || "";
  }

  function updateToggleIcon() {
    toggleBtn.classList.toggle("is-playing", !audio.paused);
    toggleBtn.setAttribute("aria-label", audio.paused ? "Play" : "Pause");
  }

  function updateMuteIcon() {
    muteBtn.classList.toggle("is-muted", audio.muted);
    muteBtn.setAttribute("aria-label", audio.muted ? "Unmute" : "Mute");
  }

  function formatTime(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function updateSeekUI() {
    if (isSeeking) return;
    const duration = audio.duration || 0;
    seekSlider.value = duration ? String((audio.currentTime / duration) * 100) : "0";
    currentTimeEl.textContent = formatTime(audio.currentTime);
    durationEl.textContent = formatTime(duration);
  }

  function renderQueue() {
    queueList.innerHTML = tracks
      .map(
        (t, i) => `
      <li class="player-queue-item" data-index="${i}">
        <span class="player-queue-title">${escapePlayerHtml(t.title || "Untitled")}</span>
        <span class="player-queue-artist">${escapePlayerHtml(t.artist || "")}</span>
      </li>`
      )
      .join("");
    queueList.querySelectorAll(".player-queue-item").forEach((li) => {
      li.addEventListener("click", () => {
        loadTrack(Number(li.dataset.index), { autoplay: true });
      });
    });
    updateQueueActive();
  }

  function updateQueueActive() {
    queueList.querySelectorAll(".player-queue-item").forEach((li) => {
      li.classList.toggle("active", Number(li.dataset.index) === index);
    });
  }

  function persist() {
    savePlayerState({
      trackIndex: index,
      currentTime: audio.currentTime || 0,
      playing: !audio.paused,
      muted: audio.muted,
      volume: Number(volumeSlider.value) / 100,
    });
  }

  function loadTrack(i, { autoplay = false, startAt = 0 } = {}) {
    index = ((i % tracks.length) + tracks.length) % tracks.length;
    audio.src = tracks[index].url;
    audio.load(); // force the element to actually drop the old source and reload
    updateTrackInfo();
    updateQueueActive();
    updateSeekUI();
    if (startAt) {
      audio.addEventListener(
        "loadedmetadata",
        function onMeta() {
          audio.currentTime = startAt;
          audio.removeEventListener("loadedmetadata", onMeta);
        },
        { once: true }
      );
    }
    if (autoplay) {
      audio.play().catch(() => {
        persist();
        updateToggleIcon();
      });
    }
    persist();
  }

  toggleBtn.addEventListener("click", () => {
    if (audio.paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  });

  prevBtn.addEventListener("click", () => loadTrack(index - 1, { autoplay: !audio.paused }));
  nextBtn.addEventListener("click", () => loadTrack(index + 1, { autoplay: !audio.paused }));

  muteBtn.addEventListener("click", () => {
    audio.muted = !audio.muted;
    updateMuteIcon();
    persist();
  });

  volumeSlider.addEventListener("input", () => {
    audio.volume = (Number(volumeSlider.value) / 100) * MAX_VOLUME;
    persist();
  });

  queueToggleBtn.addEventListener("click", () => {
    queueList.hidden = !queueList.hidden;
  });

  seekSlider.addEventListener("input", () => {
    isSeeking = true;
    const duration = audio.duration || 0;
    currentTimeEl.textContent = formatTime((Number(seekSlider.value) / 100) * duration);
  });
  seekSlider.addEventListener("change", () => {
    const duration = audio.duration || 0;
    audio.currentTime = (Number(seekSlider.value) / 100) * duration;
    isSeeking = false;
    persist();
  });

  document.addEventListener("keydown", (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;

    const t = e.target;
    const isTyping =
      t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
    if (isTyping) return;

    if (e.code === "Space" || e.key === " ") {
      e.preventDefault(); // always suppress page scroll, even while the key auto-repeats
      if (!e.repeat) toggleBtn.click();
    } else if ((e.key === "m" || e.key === "M") && !e.repeat) {
      muteBtn.click();
    }
  });

  audio.addEventListener("play", () => {
    updateToggleIcon();
    persist();
  });
  audio.addEventListener("pause", () => {
    updateToggleIcon();
    persist();
  });
  audio.addEventListener("ended", () => loadTrack(index + 1, { autoplay: true }));
  audio.addEventListener("timeupdate", () => {
    persist();
    updateSeekUI();
  });
  audio.addEventListener("loadedmetadata", updateSeekUI);

  window.addEventListener("pagehide", persist);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") persist();
  });

  // Browsers block audio.play() on a fresh page load unless the user has
  // already earned this origin autoplay permission (e.g. Chrome's media
  // engagement heuristic after prior plays). When that initial play() above
  // gets rejected, fall back to resuming on the very next interaction
  // anywhere on the page, so a refresh mid-song picks back up on the first
  // click/keypress instead of silently staying paused.
  function resumeOnFirstInteraction() {
    const resume = () => {
      if (wantsPlaying && audio.paused) audio.play().catch(() => {});
    };
    document.addEventListener("pointerdown", resume, { once: true });
    document.addEventListener("keydown", resume, { once: true });
  }

  bar.hidden = false;
  updateMuteIcon();
  renderQueue();
  loadTrack(index, { autoplay: wantsPlaying, startAt: resumeAt });
  if (wantsPlaying) resumeOnFirstInteraction();
  updateToggleIcon();
}

document.addEventListener("includes:loaded", initPlayer);
