// Counts automatic moves between /login and /account in this tab. If Clerk ever sends them back
// and forth (it happened with the profile panel's hash routing on a development key), the pages
// stop redirecting after a few hops and show a message instead of spinning for ever.
const KEY = 'parineeta:auth-hops';

/** Records one hop; true when there have been too many in the last 15 seconds. */
export function tooManyHops() {
  try {
    const now = Date.now();
    const recent = (JSON.parse(sessionStorage.getItem(KEY)) || []).filter((t) => now - t < 15000);
    recent.push(now);
    sessionStorage.setItem(KEY, JSON.stringify(recent));
    return recent.length > 4;
  } catch {
    return false;
  }
}
