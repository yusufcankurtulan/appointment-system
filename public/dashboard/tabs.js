function initTabs() {
  const tabs = document.querySelectorAll(".tab");
  const panels = {
    sites: document.getElementById("tab-sites"),
    settings: document.getElementById("tab-settings"),
  };

  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.dataset.tab;
      tabs.forEach((t) => t.classList.toggle("active", t === btn));
      Object.entries(panels).forEach(([key, panel]) => {
        if (!panel) return;
        const show = key === name;
        panel.hidden = !show;
        panel.classList.toggle("active", show);
      });
      if (name === "settings" && window.loadSettings) window.loadSettings();
    });
  });
}

initTabs();
