const gallery = document.querySelector("#gallery");
const viewer = document.querySelector("#viewer");
const category = document.querySelector("#category");
const systemTheme = matchMedia("(prefers-color-scheme: dark)");
const modes = ["light", "dark", "system", "dynamic"];
let mode = "dynamic";
try {
  const saved = localStorage.getItem("wallpaper-mode");
  if (modes.includes(saved)) mode = saved;
} catch {}
let phase = "light";
let timer;
let collection = [];
let filtered = [];
let currentId;
let opener;
let previewVersion = 0;

function setPhase(value) {
  phase = value;
  document.documentElement.style.setProperty(
    "--dark-opacity",
    value === "dark" ? "1" : "0",
  );
}
function restartCycle() {
  clearInterval(timer);
  if (mode === "dynamic" && !document.hidden)
    timer = setInterval(
      () => setPhase(phase === "light" ? "dark" : "light"),
      5000,
    );
}
function setMode(value) {
  mode = value;
  try {
    localStorage.setItem("wallpaper-mode", value);
  } catch {}
  setPhase(
    value === "system"
      ? systemTheme.matches
        ? "dark"
        : "light"
      : value === "dark"
        ? "dark"
        : "light",
  );
  document
    .querySelectorAll("[data-mode]")
    .forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.mode === value),
      ),
    );
  document.querySelector("#mode-description").textContent = {
    light: "The lighter side of the collection",
    dark: "The darker side of the collection",
    system: "Following your device’s appearance",
    dynamic: "Light ↔ Dark · every 5 seconds",
  }[value];
  restartCycle();
}
document
  .querySelectorAll("[data-mode]")
  .forEach((button) =>
    button.addEventListener("click", () => setMode(button.dataset.mode)),
  );
systemTheme.addEventListener("change", () => {
  if (mode === "system") setPhase(systemTheme.matches ? "dark" : "light");
});
document.addEventListener("visibilitychange", restartCycle);
setMode(mode);

function renderGallery() {
  filtered = collection.filter(
    (item) => !category.value || item.category === category.value,
  );
  document.querySelector("#count").textContent = String(
    filtered.length,
  ).padStart(2, "0");
  gallery.replaceChildren();
  filtered.forEach((item, index) => {
    const article = document.createElement("article");
    article.className = "wallpaper";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "open-wallpaper";
    button.setAttribute(
      "aria-label",
      `Preview ${item.title}${item.detail ? `, ${item.detail}` : ""}`,
    );
    const imagePair = document.createElement("div");
    imagePair.className = "image-pair";
    for (const appearance of ["light", "dark"]) {
      const image = document.createElement("img");
      image.src = item[appearance].thumbnail;
      image.alt = "";
      image.width = item[appearance].width;
      image.height = item[appearance].height;
      image.loading = index < 2 ? "eager" : "lazy";
      image.decoding = "async";
      if (appearance === "dark") image.className = "dark-layer";
      image.addEventListener("error", () =>
        imagePair.classList.add("image-failed"),
      );
      imagePair.append(image);
    }
    const expand = document.createElement("span");
    expand.className = "image-open";
    expand.textContent = "↗";
    expand.setAttribute("aria-hidden", "true");
    imagePair.append(expand);
    const caption = document.createElement("div");
    caption.className = "card-caption";
    const label = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = item.title;
    label.append(title);
    const detail = document.createElement("p");
    detail.textContent = item.detail || "Light & dark";
    label.append(detail);
    const number = document.createElement("span");
    number.className = "card-index";
    number.textContent = String(index + 1).padStart(2, "0");
    caption.append(label, number);
    button.append(imagePair, caption);
    button.addEventListener("click", () => {
      opener = button;
      showWallpaper(item.id);
    });
    article.append(button);
    gallery.append(article);
  });
}

async function showWallpaper(id) {
  const item = filtered.find((item) => item.id === id);
  if (!item) return;
  currentId = id;
  const version = ++previewVersion;
  document.querySelector("#viewer-title").textContent = item.title;
  document.querySelector("#viewer-detail").textContent =
    item.detail || "Light & dark";
  document.querySelector("#viewer-position").textContent =
    `${String(filtered.indexOf(item) + 1).padStart(2, "0")} / ${String(filtered.length).padStart(2, "0")}`;
  const dimensions = (appearance) =>
    `${item[appearance].width} × ${item[appearance].height}`;
  document.querySelector("#viewer-resolution").textContent =
    dimensions("light") === dimensions("dark")
      ? dimensions("light")
      : `Light ${dimensions("light")} · Dark ${dimensions("dark")}`;
  document.querySelector("#preview-status").textContent = "Loading preview…";
  const images = ["light", "dark"].map((appearance) => {
    const image = document.querySelector(`#viewer-${appearance}`);
    image.style.visibility = "hidden";
    image.src = item[appearance].preview;
    image.alt = `${item.title}${item.detail ? `, ${item.detail}` : ""} — ${appearance} wallpaper`;
    const download = document.querySelector(`#download-${appearance}`);
    download.href = item[appearance].original;
    download.setAttribute(
      "aria-label",
      `Download ${appearance} original of ${item.title}`,
    );
    // Cross-origin originals open independently if the host ignores the download attribute.
    if (new URL(download.href).origin !== location.origin) {
      download.target = "_blank";
      download.rel = "noopener noreferrer";
    } else {
      download.removeAttribute("target");
      download.removeAttribute("rel");
    }
    return image;
  });
  if (!viewer.open) viewer.showModal();
  const results = await Promise.allSettled(
    images.map((image) => image.decode()),
  );
  if (version !== previewVersion) return;
  images.forEach((image) => {
    image.style.visibility = "";
  });
  document.querySelector("#preview-status").textContent = results.some(
    (result) => result.status === "rejected",
  )
    ? "Preview unavailable. The originals are still linked below."
    : "";
}
function navigate(direction) {
  const index = filtered.findIndex((item) => item.id === currentId);
  showWallpaper(
    filtered[(index + direction + filtered.length) % filtered.length].id,
  );
}
document
  .querySelector("#previous")
  .addEventListener("click", () => navigate(-1));
document.querySelector("#next").addEventListener("click", () => navigate(1));
document
  .querySelector("#close-viewer")
  .addEventListener("click", () => viewer.close());
viewer.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    navigate(event.key === "ArrowLeft" ? -1 : 1);
  }
});
viewer.addEventListener("close", () => {
  previewVersion++;
  opener?.focus();
});
category.addEventListener("change", renderGallery);
try {
  const response = await fetch("collection.json");
  if (!response.ok)
    throw new Error(`Collection request failed (${response.status})`);
  collection = await response.json();
  for (const title of [...new Set(collection.map((item) => item.category))]) {
    const option = document.createElement("option");
    option.value = title;
    option.textContent = title;
    category.append(option);
  }
  renderGallery();
  document.querySelector("#load-status").hidden = true;
} catch (error) {
  document.querySelector("#load-status").textContent =
    "The collection couldn’t load. Please refresh or try again later.";
  console.error(error);
}
