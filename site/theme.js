// Run before the stylesheet so the system or saved theme never flashes light.
(() => {
  const preference = matchMedia("(prefers-color-scheme: dark)");
  const choices = ["system", "light", "dark"];
  // The explicit three-way preference replaces the old binary toggle setting.
  const storageKey = "website-theme-preference";
  let chosen = "system";
  try {
    const saved = localStorage.getItem(storageKey);
    if (choices.includes(saved)) chosen = saved;
  } catch {}
  function apply() {
    const dark = chosen === "system" ? preference.matches : chosen === "dark";
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.dataset.themePreference = chosen;
    document.querySelector('meta[name="theme-color"]').content = dark
      ? "#0b0b0f"
      : "#f4f4f0";
    const toggle = document.querySelector("#theme-toggle");
    if (toggle) {
      const next = choices[(choices.indexOf(chosen) + 1) % choices.length];
      toggle.setAttribute(
        "aria-label",
        `Website theme: ${chosen}. Switch to ${next}`,
      );
      toggle.title = "Website theme: System → Light → Dark";
      toggle.querySelector("[data-theme-label]").textContent =
        chosen[0].toUpperCase() + chosen.slice(1);
    }
  }
  apply();
  preference.addEventListener("change", () => {
    if (chosen === "system") apply();
  });
  document.addEventListener("DOMContentLoaded", () => {
    apply();
    document.querySelector("#theme-toggle").addEventListener("click", () => {
      chosen = choices[(choices.indexOf(chosen) + 1) % choices.length];
      try {
        localStorage.setItem(storageKey, chosen);
      } catch {}
      apply();
    });
  });
})();
