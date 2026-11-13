// Run before the stylesheet so a saved dark theme never flashes light.
(() => {
  const preference = matchMedia("(prefers-color-scheme: dark)");
  let chosen;
  try {
    const saved = localStorage.getItem("website-theme");
    if (saved === "light" || saved === "dark") chosen = saved;
  } catch {}
  function apply() {
    const dark = (chosen ?? (preference.matches ? "dark" : "light")) === "dark";
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.querySelector('meta[name="theme-color"]').content = dark
      ? "#0b0b0f"
      : "#f4f4f0";
    const toggle = document.querySelector("#theme-toggle");
    if (toggle) {
      toggle.setAttribute(
        "aria-label",
        `Use ${dark ? "light" : "dark"} website theme`,
      );
      toggle.querySelector("[data-theme-label]").textContent = dark
        ? "Light"
        : "Dark";
    }
  }
  apply();
  preference.addEventListener("change", () => {
    if (!chosen) apply();
  });
  document.addEventListener("DOMContentLoaded", () => {
    apply();
    document.querySelector("#theme-toggle").addEventListener("click", () => {
      chosen =
        document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("website-theme", chosen);
      } catch {}
      apply();
    });
  });
})();
