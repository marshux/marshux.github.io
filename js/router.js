// Client-side navigation between the public pages. GitHub Pages has no
// server-side routing, so this intercepts clicks on internal links and
// swaps <main> via fetch instead of doing a full page load — the nav,
// footer, and (critically) the music player's <audio> element live outside
// <main> and are never touched, so playback survives navigation instead of
// restarting from a fresh document every click.
(function () {
  const SWAPPABLE_PATHS = new Set(["/", "/index.html", "/projects.html", "/photography.html"]);

  let navToken = 0;

  async function swapTo(url, { pushHistory = true, scrollToTop = true } = {}) {
    const main = document.querySelector("main");
    if (!main) {
      window.location.href = url;
      return;
    }

    const token = ++navToken;
    let html;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`status ${res.status}`);
      html = await res.text();
    } catch (err) {
      window.location.href = url;
      return;
    }
    if (token !== navToken) return; // a newer navigation superseded this one

    const doc = new DOMParser().parseFromString(html, "text/html");
    const newMain = doc.querySelector("main");
    if (!newMain) {
      window.location.href = url;
      return;
    }

    if (pushHistory) {
      history.replaceState({ scrollY: window.scrollY }, "", window.location.href);
      history.pushState({ scrollY: 0 }, "", url);
    }

    main.innerHTML = newMain.innerHTML;

    if (doc.title) document.title = doc.title;
    const newDesc = doc.querySelector('meta[name="description"]');
    if (newDesc) {
      const curDesc = document.querySelector('meta[name="description"]');
      if (curDesc) {
        curDesc.setAttribute("content", newDesc.getAttribute("content") || "");
      } else {
        document.head.appendChild(newDesc.cloneNode(true));
      }
    }

    if (typeof highlightActiveNavLink === "function") highlightActiveNavLink();
    if (typeof loadProjects === "function") loadProjects();
    if (typeof loadPhotos === "function") loadPhotos();

    if (scrollToTop) window.scrollTo(0, 0);
  }

  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    const link = e.target.closest("a[href]");
    if (!link) return;
    if (link.target && link.target !== "_self") return;
    if (link.hasAttribute("download")) return;

    let url;
    try {
      url = new URL(link.href, window.location.href);
    } catch (err) {
      return;
    }
    if (url.origin !== window.location.origin) return;
    if (!SWAPPABLE_PATHS.has(url.pathname)) return;

    if (url.pathname === window.location.pathname && url.search === window.location.search) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    e.preventDefault();
    swapTo(url.pathname + url.search);
  });

  window.addEventListener("popstate", async (e) => {
    await swapTo(window.location.pathname + window.location.search, { pushHistory: false, scrollToTop: false });
    const y = e.state && typeof e.state.scrollY === "number" ? e.state.scrollY : 0;
    window.scrollTo(0, y);
  });

  history.replaceState({ scrollY: window.scrollY }, "", window.location.href);
})();
