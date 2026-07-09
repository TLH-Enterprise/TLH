type MotionOptions = {
  rootMargin?: string;
};

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

function preventContactHashJumpOnReload() {
  // If the URL contains #contacto (often kept after clicking CTAs),
  // browsers will auto-scroll there on refresh. For a landing, we prefer top.
  if (window.location.hash !== "#contacto") return;
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  history.replaceState(null, "", window.location.pathname + window.location.search);
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

function initScrollReveal(options: MotionOptions = {}) {
  const elements = document.querySelectorAll<HTMLElement>("[data-reveal]");
  if (!elements.length) return;

  if (prefersReducedMotion()) {
    elements.forEach((el) => el.classList.add("is-revealed"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        el.classList.add("is-revealed");
        obs.unobserve(el);
      }
    },
    { threshold: 0.12, rootMargin: options.rootMargin ?? "0px 0px -10% 0px" }
  );

  // Reveal above-the-fold content immediately (still animates via rAF) so it
  // is never stuck hidden; observe the rest to animate on scroll.
  const vh = window.innerHeight || document.documentElement.clientHeight;
  elements.forEach((el) => {
    const rect = el.getBoundingClientRect();
    const inView = rect.top < vh * 0.92 && rect.bottom > 0;
    if (inView) {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => el.classList.add("is-revealed"))
      );
    } else {
      observer.observe(el);
    }
  });
}

function initSpotlight() {
  if (prefersReducedMotion()) return;
  const cards = document.querySelectorAll<HTMLElement>("[data-spotlight]");
  if (!cards.length) return;

  cards.forEach((card) => {
    let raf = 0;
    card.addEventListener(
      "pointermove",
      (e) => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          const rect = card.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * 100;
          const y = ((e.clientY - rect.top) / rect.height) * 100;
          card.style.setProperty("--mx", `${x}%`);
          card.style.setProperty("--my", `${y}%`);
        });
      },
      { passive: true }
    );
  });
}

document.addEventListener("DOMContentLoaded", () => {
  preventContactHashJumpOnReload();
  initScrollReveal();
  initSpotlight();
});
