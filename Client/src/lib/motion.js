// Parallax + scroll reveal using IntersectionObserver and requestAnimationFrame.
// Only transform and opacity are animated. Everything is switched off for reduced motion,
// small screens and low-power devices (data saver, <= 2 cores / <= 2 GB memory).

export const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

export const motionAllowed = (env = {}) => {
  const { reducedMotion = false, width = 1280, saveData = false, cores = 8, memory = 8 } = env;
  return !reducedMotion && width >= 768 && !saveData && cores > 2 && memory > 2;
};

// vertical shift (px) for an element whose box is `rect`, inside a viewport of height `vh`.
// 0 when the element is centred in the viewport; limited so layers never run out of their frame.
export const parallaxOffset = (rect, vh, speed = 0.15, max = 90) => {
  const centre = rect.top + rect.height / 2;
  return Math.round(clamp((vh / 2 - centre) * speed, -max, max) * 10) / 10;
};

const readEnv = () => {
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  return {
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    width: window.innerWidth,
    saveData: Boolean(nav.connection?.saveData),
    cores: nav.hardwareConcurrency || 8,
    memory: nav.deviceMemory || 8,
  };
};

export const motionOn = () => typeof window !== 'undefined' && motionAllowed(readEnv());

let io = null;
const live = new Set();
let ticking = false;

const frame = () => {
  ticking = false;
  const vh = window.innerHeight;
  live.forEach((el) => {
    const speed = Number(el.dataset.parallax) || 0.15;
    el.style.transform = `translate3d(0, ${parallaxOffset(el.parentElement.getBoundingClientRect(), vh, speed)}px, 0)`;
  });
};
const schedule = () => {
  if (!ticking) {
    ticking = true;
    requestAnimationFrame(frame);
  }
};

const observer = () => {
  if (io) return io;
  io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.target.dataset.parallax !== undefined) {
          if (e.isIntersecting) live.add(e.target);
          else live.delete(e.target);
          schedule();
        } else if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
  );
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  return io;
};

// returns a cleanup function
export const watchReveal = (el, delay = 0) => {
  if (!el || !motionOn()) return () => {};
  el.style.transitionDelay = `${delay}ms`;
  el.classList.add('reveal');
  observer().observe(el);
  return () => io?.unobserve(el);
};

export const watchParallax = (el) => {
  if (!el || !motionOn()) return () => {};
  el.dataset.active = '1';
  observer().observe(el);
  return () => {
    io?.unobserve(el);
    live.delete(el);
    el.style.transform = '';
    delete el.dataset.active;
  };
};
