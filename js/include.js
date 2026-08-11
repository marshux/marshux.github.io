async function loadIncludes() {
  const nodes = document.querySelectorAll("[data-include]");
  await Promise.all(
    Array.from(nodes).map(async (el) => {
      const url = el.getAttribute("data-include");
      try {
        const res = await fetch(url);
        el.innerHTML = await res.text();
      } catch (err) {
        // leave the placeholder empty if a partial fails to load
      }
    })
  );
  document.dispatchEvent(new Event("includes:loaded"));
}

loadIncludes();
