// vim-style shortcuts: H/L history, j/k scroll or move the song selection, gg/G top/bottom, gi search, J/K next/previous sidebar item
(function init() {
  const history = window.Spicetify?.Platform?.History;
  if (!history) return setTimeout(init, 300);

  const STEP = 120; // px per tap
  const SPEED = 1500; // px per second while held

  const mainView = () => document.querySelector(".main-view-container [data-overlayscrollbars-viewport]");

  // scroll at a steady speed while held, so key repeat doesn't restart the motion
  let dir = 0, held = false, moved = 0, pos = 0, lastT = 0, view = null;
  const tick = (t) => {
    if (!dir) return; // stopped by gg/G
    let d = (SPEED * Math.min(t - lastT, 50)) / 1000;
    if (!held) d = Math.min(d, Math.max(0, STEP - moved)); // a tap ends exactly one step away
    lastT = t;
    pos += dir * d;
    moved += d;
    view.scrollTop = pos;
    if (held || moved < STEP) requestAnimationFrame(tick);
    else dir = 0;
  };
  const scroll = (d) => {
    held = true;
    if (dir === d) return;
    view = mainView();
    if (!view) return;
    const idle = dir === 0;
    dir = d; moved = 0; pos = view.scrollTop;
    if (idle) { lastT = performance.now(); requestAnimationFrame(tick); }
  };

  const jump = (bottom) => {
    const v = mainView();
    if (!v) return;
    dir = 0;
    v.scrollTop = bottom ? v.scrollHeight : 0;
  };
  let lastG = 0; // time of a first g, waiting for the second
  const focusSearch = () => {
    if (history.location.pathname.startsWith("/playlist/")) {
      const page = document.querySelector("[data-testid='playlist-page']");
      const input = page?.querySelector("input[aria-label='Search in playlist']");
      if (input?.getAttribute("aria-hidden") === "false") input.focus();
      else page?.querySelector("button[aria-label='Search in playlist']")?.click();
    } else document.querySelector("input[data-top-bar-search]")?.focus();
  };

  // a clicked song keeps focus in its row; spotify moves the selection with the arrow keys
  const moveSong = (d) => {
    const el = document.activeElement;
    if (!el?.closest(".main-view-container [role=row][aria-selected=true]")) return false;
    const key = d > 0 ? "ArrowDown" : "ArrowUp";
    el.dispatchEvent(new KeyboardEvent("keydown", { key, code: key, keyCode: d > 0 ? 40 : 38, bubbles: true }));
    return true;
  };

  // sidebar rows are virtualized, so only rendered rows can be stepped through
  const rowUri = (r) => r.querySelector("[id^='listrow-title-']").id.slice(14);
  let last = null; // liked songs never gets aria-selected, so remember the last row opened
  const step = (d) => {
    const rows = [...document.querySelectorAll("#Desktop_LeftSidebar_Id [role=row]:has([id^='listrow-title-'])")]
      .filter((r) => !rowUri(r).includes(":folder:")) // folders have no page to open
      .sort((a, b) => a.ariaRowIndex - b.ariaRowIndex);
    if (!rows.length) return;
    let cur = rows.findIndex((r) => r.ariaSelected === "true");
    if (cur === -1) cur = rows.findIndex((r) => rowUri(r) === last);
    const next = rows[cur === -1 ? (d > 0 ? 0 : rows.length - 1) : cur + d];
    if (!next) return;
    last = rowUri(next);
    history.push(Spicetify.URI.fromString(last).toURLPath(true));
    next.scrollIntoView({ block: "nearest" });
  };

  const actions = {
    H: () => history.goBack(),
    L: () => history.goForward(),
    J: () => step(1),
    K: () => step(-1),
    j: () => moveSong(1) || scroll(1),
    k: () => moveSong(-1) || scroll(-1),
    g: () => {
      const now = performance.now();
      if (now - lastG < 500) { lastG = 0; jump(false); } else lastG = now;
    },
    i: focusSearch,
    G: () => jump(true),
  };
  const typing = (e) => e.target.closest?.("input, textarea, select, [contenteditable=''], [contenteditable=true]");

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !e.target.matches?.("input[data-top-bar-search]")) return;
    // Spotify handles Escape in search; move focus after its handler has run.
    setTimeout(() => {
      if (document.activeElement !== e.target) return;
      e.target.blur();
      mainView()?.focus();
    }, 0);
  }, true);

  document.addEventListener("keydown", (e) => {
    const act = actions[e.key];
    if (!act || e.metaKey || e.ctrlKey || e.altKey || typing(e)) return;
    if (e.key === "i" && (!lastG || performance.now() - lastG >= 500)) return;
    e.preventDefault();
    if (e.key !== "g") lastG = 0;
    if (e.repeat && /[HLJKGg]/.test(e.key)) return;
    act();
  });
  document.addEventListener("keyup", (e) => {
    if (e.key === "j" || e.key === "k") held = false;
  });
})();
