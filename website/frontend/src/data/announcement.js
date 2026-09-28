// Optional strip above the header, e.g. "Puja orders close 20 Sept". Edited in the admin.
export const ANNOUNCEMENT = { text: '', linkText: '', linkUrl: '', startsAt: '', endsAt: '', visible: false };

/** True when the bar has text, is switched on and `now` falls inside its optional window. */
export function announcementActive(a, now = new Date()) {
  if (!a?.visible || !a.text?.trim()) return false;
  const t = now.getTime();
  if (a.startsAt && t < new Date(a.startsAt).getTime()) return false;
  if (a.endsAt && t >= new Date(a.endsAt).getTime()) return false;
  return true;
}
