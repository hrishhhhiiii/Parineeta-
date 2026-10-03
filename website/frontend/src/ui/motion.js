/** Shared pause state for idle animation. There is no on-page control any more; visitors who ask
 * their device for reduced motion get still versions instead (see reduceMotion / reducedMotion). */
export const motion = {
  paused: false,
  listeners: new Set(),
  set(paused) {
    this.paused = paused;
    this.listeners.forEach((fn) => fn(paused));
  },
};
try {
  localStorage.removeItem('parineeta:motion');
} catch {
  /* storage unavailable */
}
