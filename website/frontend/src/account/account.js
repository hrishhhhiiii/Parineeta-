// /account: a signed-in customer's orders and their stage, plus profile settings (sign-in is on /login).
// Orders are matched by the account's email: checkout fills it in for signed-in customers.
import '../login/login.css';
import { tooManyHops } from '../auth/hops.js';

const DEMO = import.meta.env.DEV && new URLSearchParams(location.search).has('demo');
const app = document.getElementById('app');

function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'text') el.textContent = v;
    else if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...kids.flat().filter((c) => c != null && c !== false));
  return el;
}

// The order stages the shop sets in /admin → Orders.
const STEPS = [['placed', 'Order received'], ['paid', 'Payment received'], ['making', 'Being made'], ['ready', 'Ready'], ['delivered', 'Delivered']];
const label = (s) => (s === 'cancelled' ? 'Cancelled' : STEPS.find(([k]) => k === s)?.[1] || s);
const date = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const back = () => h('p', {}, h('a', { href: '/', text: '← Back to Parineeta' }));

function orderCard(o) {
  const at = STEPS.findIndex(([k]) => k === o.status);
  return h('article', { class: 'card' },
    h('p', { class: 'muted', text: `Order ${o.ref} · placed ${date(o.createdAt)}` }),
    h('p', {}, 'Stage: ', h('span', { class: 'status', text: label(o.status) })),
    o.status !== 'cancelled' ? h('div', { class: 'steps', 'aria-hidden': 'true' }, ...STEPS.map((_, i) => h('span', { class: i <= at ? 'on' : '' }))) : null,
    o.items?.length ? h('ul', { class: 'items' }, ...o.items.map((i) => h('li', { text: `${i.qty} × ${i.title}${i.detail ? ` (${i.detail})` : ''}` }))) : null,
    h('p', { class: 'muted', text: `Estimated total ${INR.format(o.total)}${o.paidAmount ? ` · paid ${INR.format(o.paidAmount)}` : ''}` }));
}

const demoOrder = { ref: 'PRN-261001-DEMO', createdAt: new Date().toISOString(), total: 1450, paidNow: 725, status: 'making', paidAmount: 725,
  items: [{ title: 'Gach Kouto', qty: 1, detail: 'Sindoor red, Single piece' }] };
const demoSession = () => ({
  user: { email: 'riya@example.com', name: 'Riya' },
  sb: { rpc: async (fn) => ({ data: fn === 'my_orders' ? [demoOrder] : fn === 'admin_role' ? null : true, error: null }) },
  deleteUser: async () => {},
});

/** The signed-in person and a Supabase client acting as them, or null. Clerk loads only on this page. */
async function connect() {
  if (DEMO) return demoSession();
  const { configured, getClerk, getSupabase, userOf } = await import('../auth/client.js');
  if (!configured) return null;
  const clerk = await getClerk();
  if (!clerk.user) return null;
  return { clerk, user: userOf(clerk.user), sb: await getSupabase(), deleteUser: () => clerk.user.delete() };
}

function stuck() {
  app.replaceChildren(h('h1', { text: 'Your account could not open' }),
    h('p', { class: 'muted', text: 'Close this tab, open the website again and sign in. If it keeps happening, message us on WhatsApp about your order.' }),
    back());
}

async function showAccount() {
  const looping = tooManyHops();
  let me;
  try { me = await connect(); } catch { return stuck(); }
  if (!me) return looping ? stuck() : location.replace('/login.html?signin');
  const { sb } = me;
  const [{ data: orders, error }, { data: role }] = await Promise.all([sb.rpc('my_orders'), sb.rpc('admin_role')]);
  // Clerk's UserButton (Manage account, Sign out) when signed in for real; a plain button in demo mode.
  const out = me.clerk ? h('div', { class: 'user-btn' }) : h('button', { class: 'ghost', type: 'button', text: 'Sign out', onclick: () => location.replace('/login.html?signout') });
  const settings = me.clerk ? h('div', { class: 'clerk-profile' }) : null;
  const del = h('button', { class: 'ghost', type: 'button', text: 'Delete my account' });
  del.addEventListener('click', async () => {
    if (!confirm('Delete your account? Your past orders stay with the shop for its accounts, without your name or contact details. This cannot be undone.')) return;
    const { error: e } = await sb.rpc('delete_my_account');
    if (e) return alert('Could not delete the account. Please message us on WhatsApp and we will do it.');
    try { await me.deleteUser(); } catch {
      return alert('Your details were removed, but the login could not be deleted. Please message us on WhatsApp and we will finish it.');
    }
    location.replace('/login.html?signout');
  });
  app.replaceChildren(
    h('div', { class: 'top' }, h('h1', { text: 'My orders' }), out),
    h('p', { class: 'muted', text: `Signed in as ${me.user.email}` }),
    me.clerk ? h('p', { class: 'profile-actions' },
      h('button', { type: 'button', class: 'ghost', text: 'Edit profile', onclick: () => me.clerk.openUserProfile() }),
      h('button', { type: 'button', class: 'ghost', text: 'Change password', onclick: () => me.clerk.openUserProfile({ __experimental_startPath: '/security' }) })) : '',
    role ? h('p', {}, h('a', { href: '/admin.html', text: role === 'owner' ? 'Open the admin panel →' : 'Open the editor panel →' })) : '',
    ...(error ? [h('p', { class: 'msg is-err', text: 'Could not load your orders. Please try again later.' })]
      : orders?.length ? orders.map(orderCard)
      : [h('div', { class: 'card' }, h('p', { text: 'No orders yet.' }),
          h('p', { class: 'muted', text: `Orders placed with this email (${me.user.email}) appear here, with their stage as we make them.` }))]),
    settings ? h('h2', { class: 'acc-h2', text: 'Profile and password' }) : '',
    settings || '',
    back(), h('p', {}, del));
  if (me.clerk && !looping) {
    me.clerk.mountUserButton(out, { customMenuItems: [{ label: 'manageAccount' }, { label: 'signOut' }] });
    // Virtual routing: the panel's pages switch in memory and never change the address. Hash routing
    // went through clerk.navigate(), which on a development key reloads the page and caused a loop.
    me.clerk.mountUserProfile(settings, { routing: 'virtual' });
  }
}

const configured = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!DEMO && !configured) {
  app.replaceChildren(h('h1', { text: 'Coming soon' }), h('p', { class: 'muted', text: 'Accounts are being set up. Message us on WhatsApp about your order.' }), back());
} else {
  showAccount();
}
