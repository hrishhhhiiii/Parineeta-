// /track#<token>: one enquiry, no sign-in. /account: optional email sign-in listing all your enquiries.
import './account.css';

const URL_ = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
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

const STEPS = [
  ['new', 'Received'], ['replied', 'We replied'], ['ordered', 'Order confirmed'],
  ['painting', 'Being hand-painted'], ['ready', 'Ready'], ['delivered', 'Delivered'],
];
const label = (s) => (s === 'closed' ? 'Closed' : STEPS.find(([k]) => k === s)?.[1] || s);
const date = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const back = () => h('p', {}, h('a', { href: '/', text: '← Back to Parineeta' }));

function enquiryCard(e) {
  const at = STEPS.findIndex(([k]) => k === e.status);
  return h('article', { class: 'card' },
    h('p', { class: 'muted', text: `Sent ${date(e.createdAt)}${e.eventDate ? ` · event on ${date(e.eventDate)}` : ''}` }),
    h('p', {}, 'Status: ', h('span', { class: 'status', text: label(e.status) })),
    e.status !== 'closed' ? h('div', { class: 'steps', 'aria-hidden': 'true' }, ...STEPS.map((_, i) => h('span', { class: i <= at ? 'on' : '' }))) : null,
    e.statusNote ? h('p', { text: e.statusNote }) : null,
    e.items?.length ? h('ul', { class: 'items' }, ...e.items.map((i) => h('li', { text: i }))) : null);
}

/* ---------- data: plain fetch for tracking; supabase-js loads only for the account view ---------- */
const demoEnquiry = { createdAt: new Date().toISOString(), eventDate: '2026-12-02', items: ['Shola mukut (sindoor)'], status: 'painting', statusNote: 'Your crown is being painted. Ready by 20 Nov.' };

async function trackEnquiry(token) {
  if (DEMO) return { firstName: 'Riya', ...demoEnquiry };
  const res = await fetch(`${URL_}/rest/v1/rpc/track_enquiry`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: token }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function demoClient() {
  let user = null;
  return {
    auth: {
      getSession: async () => ({ data: { session: user ? { user } : null } }),
      signInWithOtp: async ({ email }) => { user = { email }; setTimeout(showAccount, 800); return { error: null }; },
      signOut: async () => { user = null; },
    },
    rpc: async (fn) => ({ data: fn === 'my_enquiries' ? [demoEnquiry] : fn === 'admin_role' ? null : true, error: null }),
  };
}
let sbPromise;
const client = () => (sbPromise ??= DEMO
  ? Promise.resolve(demoClient())
  : import('@supabase/supabase-js').then(({ createClient }) => createClient(URL_, KEY, { auth: { flowType: 'pkce', detectSessionInUrl: true } })));

/* ---------- /track#token ---------- */
async function showTrack(token) {
  app.replaceChildren(h('p', { text: 'Looking up your enquiry…' }));
  let e = null;
  try { e = await trackEnquiry(token); } catch {}
  if (!e) {
    app.replaceChildren(h('h1', { text: 'Enquiry not found' }),
      h('p', { class: 'muted', text: 'The link may be incomplete, or the enquiry is more than 18 months old. Message us on WhatsApp and we will help.' }),
      back());
    return;
  }
  const save = h('button', { class: 'ghost', type: 'button', text: 'Save it to an account (optional)',
    onclick: () => { sessionStorage.setItem('claim', token); location.href = '/account.html'; } });
  app.replaceChildren(h('h1', { text: `Namaskar${e.firstName ? `, ${e.firstName}` : ''}` }),
    h('p', { class: 'muted', text: 'Here is where your enquiry stands. Keep this link private: anyone with it can see this page.' }),
    enquiryCard(e), h('p', {}, save), back());
}

/* ---------- /account ---------- */
function showSignIn(message = '') {
  const email = h('input', { type: 'email', required: true, autocomplete: 'email', placeholder: 'you@example.com…', spellcheck: 'false', autocapitalize: 'none', name: 'email', 'aria-label': 'Email' });
  const msg = h('p', { class: 'msg', role: 'status', text: message });
  const btn = h('button', { type: 'submit', text: 'Email me a sign-in link' });
  const form = h('form', { class: 'card' }, h('div', { class: 'row' }, email, btn), msg);
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    btn.disabled = true;
    msg.className = 'msg';
    msg.textContent = 'Sending…';
    const sb = await client();
    const { error } = await sb.auth.signInWithOtp({ email: email.value.trim(), options: { emailRedirectTo: `${location.origin}/account` } });
    btn.disabled = false;
    if (error) {
      msg.className = 'msg is-err';
      msg.textContent = /rate/i.test(error.message) ? 'Too many tries. Please wait a few minutes.' : 'Could not send the link. Check the address and try again.';
      return;
    }
    msg.textContent = `Check ${email.value.trim()} for a sign-in link.`;
  });
  app.replaceChildren(h('h1', { text: 'My enquiries' }),
    h('p', { class: 'muted', text: 'An account is optional. Sign in with just your email, no password, to see every enquiry you sent with it and how it is going.' }),
    form, back());
}

async function showAccount() {
  const sb = await client();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return DEMO ? showSignIn() : location.replace('/login.html');
  const claim = sessionStorage.getItem('claim');
  if (claim) {
    sessionStorage.removeItem('claim');
    await sb.rpc('claim_enquiry', { p_token: claim });
  }
  const [{ data: list, error }, { data: role }] = await Promise.all([sb.rpc('my_enquiries'), sb.rpc('admin_role')]);
  const out = h('button', { class: 'ghost', type: 'button', text: 'Sign out' });
  out.addEventListener('click', async () => { await sb.auth.signOut(); DEMO ? showSignIn('Signed out.') : location.replace('/login.html?signout'); });
  const del = h('button', { class: 'ghost', type: 'button', text: 'Delete my account' });
  del.addEventListener('click', async () => {
    if (!confirm('Delete your account and its enquiries? This cannot be undone.')) return;
    const { error: e } = await sb.rpc('delete_my_account');
    if (e) return alert('Could not delete the account. Please message us and we will do it.');
    await sb.auth.signOut();
    DEMO ? showSignIn('Your account was deleted.') : location.replace('/login.html?signout');
  });
  app.replaceChildren(
    h('div', { class: 'top' }, h('h1', { text: 'My orders and enquiries' }), out),
    h('p', { class: 'muted', text: `Signed in as ${session.user.email}` }),
    role ? h('p', {}, h('a', { href: '/admin.html', text: role === 'owner' ? 'Open the admin panel →' : 'Open the editor panel →' })) : null,
    ...[error ? h('p', { class: 'msg is-err', text: 'Could not load your enquiries. Please try again later.' })
      : list?.length ? list.map(enquiryCard)
      : h('div', { class: 'card' }, h('p', { text: 'No enquiries yet for this email.' }),
          h('p', { class: 'muted', text: 'Sent one by WhatsApp without an email? Open its tracking link and press “Save it to an account”.' }))].flat(),
    back(), h('p', {}, del));
}

if (!DEMO && (!URL_ || !KEY)) {
  app.replaceChildren(h('h1', { text: 'Coming soon' }), h('p', { class: 'muted', text: 'Enquiry tracking is being set up. Message us on WhatsApp for an update.' }), back());
} else {
  const token = location.hash.slice(1);
  if (/^[0-9a-f]{32}$/.test(token)) showTrack(token);
  else showAccount();
}
