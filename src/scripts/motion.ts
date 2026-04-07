type MotionOptions = {
  rootMargin?: string;
};

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
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
    { threshold: 0.12, rootMargin: options.rootMargin ?? "0px 0px -12% 0px" }
  );

  elements.forEach((el) => observer.observe(el));
}

function initMagneticButtons() {
  const magnetic = document.querySelectorAll<HTMLElement>("[data-magnetic]");
  if (!magnetic.length || prefersReducedMotion()) return;

  magnetic.forEach((el) => {
    let raf = 0;
    const strength = Number(el.getAttribute("data-magnetic")) || 10;

    const onMove = (ev: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const x = ev.clientX - (rect.left + rect.width / 2);
        const y = ev.clientY - (rect.top + rect.height / 2);
        const dx = (x / rect.width) * strength;
        const dy = (y / rect.height) * strength;
        el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      });
    };

    const onLeave = () => {
      cancelAnimationFrame(raf);
      el.style.transform = "";
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
  });
}

function initTiltCards() {
  const cards = document.querySelectorAll<HTMLElement>("[data-tilt]");
  if (!cards.length || prefersReducedMotion()) return;

  cards.forEach((card) => {
    let raf = 0;
    const max = Number(card.getAttribute("data-tilt")) || 6;
    card.style.transformStyle = "preserve-3d";

    const onMove = (ev: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = card.getBoundingClientRect();
        const px = (ev.clientX - r.left) / r.width;
        const py = (ev.clientY - r.top) / r.height;
        const rx = (py - 0.5) * -max;
        const ry = (px - 0.5) * max;
        card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-2px)`;
      });
    };

    const onLeave = () => {
      cancelAnimationFrame(raf);
      card.style.transform = "";
    };

    card.addEventListener("pointermove", onMove);
    card.addEventListener("pointerleave", onLeave);
  });
}

function initHeroParallax() {
  const hero = document.querySelector<HTMLElement>("#hero");
  if (!hero || prefersReducedMotion()) return;
  const orbs = hero.querySelectorAll<HTMLElement>(".orb");
  if (!orbs.length) return;

  let raf = 0;
  const onMove = (ev: PointerEvent) => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const r = hero.getBoundingClientRect();
      const x = (ev.clientX - r.left) / r.width - 0.5;
      const y = (ev.clientY - r.top) / r.height - 0.5;
      orbs.forEach((orb, i) => {
        const s = (i + 1) * 10;
        orb.style.transform = `translate3d(${x * s}px, ${y * s}px, 0)`;
      });
    });
  };

  hero.addEventListener("pointermove", onMove);
  hero.addEventListener("pointerleave", () => {
    orbs.forEach((orb) => (orb.style.transform = ""));
  });
}

function animateCount(el: HTMLElement) {
  const to = Number(el.getAttribute("data-count-to") ?? "0");
  const decimals = Number(el.getAttribute("data-count-decimals") ?? "0");
  const duration = 900;
  const start = performance.now();
  const from = 0;

  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const v = from + (to - from) * eased;
    el.textContent = v.toFixed(decimals);
    if (t < 1) requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}

function initCountUp() {
  const els = document.querySelectorAll<HTMLElement>("[data-count]");
  if (!els.length) return;

  if (prefersReducedMotion()) {
    els.forEach((el) => {
      const to = el.getAttribute("data-count-to") ?? "0";
      el.textContent = to;
    });
    return;
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        animateCount(entry.target as HTMLElement);
        obs.unobserve(entry.target);
      }
    },
    { threshold: 0.35 }
  );

  els.forEach((el) => observer.observe(el));
}

document.addEventListener("DOMContentLoaded", () => {
  initScrollReveal();
  initMagneticButtons();
  initTiltCards();
  initHeroParallax();
  initCountUp();
});

