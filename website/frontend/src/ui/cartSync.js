// Keeps a signed-in customer's cart and wishlist in Supabase so they follow them to any device.
// Loaded only when someone has signed in on this browser, so guests never download Clerk or supabase-js.
import { configured, getClerk, getSupabase } from '../auth/client.js';
import { store, replaceState, onLocalChange, mergeCarts as merge } from './store.js';

const SYNC_KEY = 'parineeta:sync'; // { user, dirty }: who this browser last synced for, and unsent edits

const readSync = () => { try { return JSON.parse(localStorage.getItem(SYNC_KEY)) || {}; } catch { return {}; } };
const writeSync = (v) => { try { localStorage.setItem(SYNC_KEY, JSON.stringify(v)); } catch {} };

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const local = () => ({ cart: store.cart.map((l) => ({ ...l })), wish: [...store.wish] });

export async function startCartSync() {
  if (!configured) return;
  const clerk = await getClerk();
  if (!clerk.user) return;
  const user = clerk.user.id;
  const sb = await getSupabase();

  let timer = null;
  let pushing = Promise.resolve();
  async function push() {
    const body = local();
    const { error } = await sb.from('customer_carts').upsert({ user_id: user, ...body, updated_at: new Date().toISOString() });
    if (!error) writeSync({ user, dirty: false });
  }
  const schedulePush = () => {
    writeSync({ user, dirty: true });
    clearTimeout(timer);
    timer = setTimeout(() => { pushing = pushing.then(push); }, 800);
  };

  async function pull(first) {
    const { data, error } = await sb.from('customer_carts').select('cart, wish').eq('user_id', user).maybeSingle();
    if (error) return;
    const remote = { cart: data?.cart || [], wish: data?.wish || [] };
    const sync = readSync();
    // First time this browser syncs for this person, or edits that never reached the server: combine.
    // Otherwise the saved copy is the latest (a removal on another device must not come back).
    const next = sync.user !== user || sync.dirty ? merge(remote, local()) : remote;
    if (!same(next, local())) replaceState(next);
    if (!data || !same(next, remote)) schedulePush();
    else if (first) writeSync({ user, dirty: false });
  }

  onLocalChange(schedulePush);
  await pull(true);
  // Coming back to this tab after using another device picks up those changes.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !readSync().dirty) pull(false);
  });
  // Unsent edits get one last try when the tab closes.
  addEventListener('pagehide', () => { if (readSync().dirty) push(); });
  clerk.addListener(({ user: now }) => {
    if (!now) writeSync({});
  });
}
