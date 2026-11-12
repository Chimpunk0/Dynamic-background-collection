// One visual wordmark moves between the semantic heading and the home link.
// Its endpoints share proportions, so it lands exactly without a crossfade.
const hero = document.querySelector(".hero-brand");
const target = document.querySelector(".header .brand");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const mark = hero.cloneNode(true);
mark.removeAttribute("id");
mark.className = "brand-morph wordmark";
mark.setAttribute("aria-hidden", "true");
mark.hidden = true;
document.body.append(mark);
let geometry;
let frame;

function measure() {
  const from = hero.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  const size = parseFloat(getComputedStyle(hero).fontSize);
  geometry = {
    x: from.left,
    y: from.top + scrollY,
    toX: to.left,
    toY: to.top,
    size,
    scale: parseFloat(getComputedStyle(target).fontSize) / size,
    distance: Math.max(200, from.top + scrollY - to.top + from.height * 0.55),
  };
  mark.style.fontSize = `${size}px`;
  paint();
}
function paint() {
  frame = undefined;
  const enabled = !reducedMotion.matches;
  document.documentElement.classList.toggle("has-brand-morph", enabled);
  mark.hidden = !enabled;
  if (!enabled || !geometry) return;
  const progress = Math.min(1, Math.max(0, scrollY / geometry.distance));
  const eased = progress * progress * (3 - 2 * progress);
  const mix = (start, end) => start + (end - start) * eased;
  mark.style.fontSize = `${geometry.size * mix(1, geometry.scale)}px`;
  mark.style.transform = `translate3d(${mix(geometry.x, geometry.toX)}px, ${mix(geometry.y, geometry.toY)}px, 0)`;
}
function schedule() {
  if (frame === undefined) frame = requestAnimationFrame(paint);
}
addEventListener("scroll", schedule, { passive: true });
addEventListener("resize", measure);
addEventListener("pageshow", measure);
reducedMotion.addEventListener("change", measure);
new ResizeObserver(measure).observe(hero);
measure();
