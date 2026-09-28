/** User-controlled pause for all idle animation (WCAG 2.2.2), remembered across visits. */
export const motion = {
  paused: (() => {
    try {
      return localStorage.getItem('parineeta:motion') === 'paused';
    } catch {
      return false;
    }
  })(),
  listeners: new Set(),
  set(paused) {
    this.paused = paused;
    try {
      localStorage.setItem('parineeta:motion', paused ? 'paused' : 'on');
    } catch {
      /* storage unavailable */
    }
    this.listeners.forEach((fn) => fn(paused));
  },
};
