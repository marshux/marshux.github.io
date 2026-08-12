const PLAYER_STATE_KEY = "marshux-player-state";

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

  const savedState = loadPlayerState();
  let index =
    Number.isInteger(savedState.trackIndex) && savedState.trackIndex >= 0 && savedState.trackIndex < tracks.length
      ? savedState.trackIndex
      : 0;
  const wantsPlaying = Boolean(savedState.playing);
  const resumeAt = typeof savedState.currentTime === "number" ? savedState.currentTime : 0;
  audio.muted = Boolean(savedState.muted);
  audio.volume = typeof savedState.volume === "number" ? savedState.volume : 0.5;
  volumeSlider.value = String(Math.round(audio.volume * 100));

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

  function persist() {
    savePlayerState({
      trackIndex: index,
      currentTime: audio.currentTime || 0,
      playing: !audio.paused,
      muted: audio.muted,
      volume: audio.volume,
    });
  }

  function loadTrack(i, { autoplay = false, startAt = 0 } = {}) {
    index = ((i % tracks.length) + tracks.length) % tracks.length;
    audio.src = tracks[index].url;
    updateTrackInfo();
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
    audio.volume = Number(volumeSlider.value) / 100;
    persist();
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
  audio.addEventListener("timeupdate", persist);

  window.addEventListener("pagehide", persist);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") persist();
  });

  bar.hidden = false;
  updateMuteIcon();
  loadTrack(index, { autoplay: wantsPlaying, startAt: resumeAt });
  updateToggleIcon();
}

document.addEventListener("includes:loaded", initPlayer);
