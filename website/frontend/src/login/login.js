// One sign-in page for everyone, run by Clerk. After sign-in: owners → admin panel, editors → editor panel
// (the same admin app with publishing and the inbox hidden), customers → their enquiries.
// Password, email code, Google and password reset are switched on in the Clerk dashboard, not here.
import '../account/account.css';
import { configured, getClerk, getSupabase } from '../auth/client.js';

const app = document.getElementById('app');
const params = new URLSearchParams(location.search);
const PAGES = { admin: '/admin.html', account: '/account.html' };
const here = `${location.origin}/login.html`;

function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'text') el.textContent = v;
    else if (k === 'class') el.className = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...kids.flat().filter((c) => c != null && c !== false));
  return el;
}
const back = () => h('p', {}, h('a', { href: '/', text: '← Back to Parineeta' }));

// Browsers that have signed in before open on "Sign in"; first-time visitors open on "Create account".
// Remembered on this device only, so the page never reveals whether an email has an account.
const KNOWN = 'parineeta:has-account';
const knownDevice = () => { try { return localStorage.getItem(KNOWN) === '1'; } catch { return false; } };
const rememberDevice = () => { try { localStorage.setItem(KNOWN, '1'); } catch { /* storage blocked: default to sign-up next time */ } };

function unavailable(title, text, devNote) {
  app.replaceChildren(h('h1', { text: title }), h('p', { class: 'muted', text }),
    import.meta.env.DEV && devNote ? h('p', { class: 'msg is-err', text: devNote }) : '',
    back());
}

/** Sends a signed-in person to the page for their role. */
async function route() {
  rememberDevice();
  app.replaceChildren(h('p', { text: 'Signing you in…' }));
  const sb = await getSupabase();
  const { data: role } = await sb.rpc('admin_role');
  location.replace(role === 'owner' || role === 'editor' ? PAGES.admin : PAGES.account);
}

function show(clerk, mode, note = '') {
  const signin = mode === 'signin';
  const box = h('div', { class: 'clerk-box' });
  app.replaceChildren(
    h('h1', { text: signin ? 'Welcome back' : 'Create your account' }),
    h('p', { class: 'muted', text: signin
      ? 'Sign in to follow your orders. You don\'t need an account to enquire.'
      : 'Optional. It keeps all your enquiries and orders in one place. You don\'t need an account to enquire.' }),
    note ? h('p', { class: 'msg', role: 'status', text: note }) : '',
    box,
    back());
  // Every finished sign-in or sign-up comes back here, and route() picks the right page.
  const opts = {
    routing: 'hash',
    forceRedirectUrl: here,
    signInForceRedirectUrl: here,
    signUpForceRedirectUrl: here,
    signInUrl: `${here}?signin`,
    signUpUrl: `${here}?signup`,
  };
  if (signin) clerk.mountSignIn(box, opts);
  else clerk.mountSignUp(box, opts);
}

if (!configured) {
  unavailable('Sign-in is being set up', 'Please message us on WhatsApp for now.',
    'Developer: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY or VITE_CLERK_PUBLISHABLE_KEY is missing. Copy .env.example to .env in the frontend folder, then restart npm run dev.');
} else {
  let clerk = null;
  try { clerk = await getClerk(); } catch (err) {
    unavailable('Sign-in could not load', 'Check your connection and reload the page. If it keeps happening, message us on WhatsApp.', `Developer: ${err.message}`);
  }
  if (clerk && params.has('signout')) {
    await clerk.signOut();
    // The cart is saved to the account; clear this browser's copy so the next person here starts empty.
    try {
      if (JSON.parse(localStorage.getItem('parineeta:sync'))?.user) localStorage.removeItem('parineeta:v1');
      localStorage.removeItem('parineeta:sync');
    } catch {}
    show(clerk, 'signin', 'You are signed out.');
  } else if (clerk?.user) route();
  else if (clerk) show(clerk, params.has('signup') ? 'signup' : params.has('signin') || knownDevice() ? 'signin' : 'signup');
}
