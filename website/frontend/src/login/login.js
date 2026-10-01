// Shop staff sign in here (Clerk), then go to the admin panel. Customers never need an account:
// they buy through the cart and WhatsApp. Password, email code and Google sign-in are switched
// on in the Clerk dashboard, not here.
import './login.css';
import { configured, getClerk, getSupabase } from '../auth/client.js';

const app = document.getElementById('app');
const params = new URLSearchParams(location.search);
const here = `${location.origin}/login.html`;

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
const back = () => h('p', {}, h('a', { href: '/', text: '← Back to Parineeta' }));

function unavailable(title, text, devNote) {
  app.replaceChildren(h('h1', { text: title }), h('p', { class: 'muted', text }),
    import.meta.env.DEV && devNote ? h('p', { class: 'msg is-err', text: devNote }) : '',
    back());
}

/** Staff go to the admin panel; anyone else is told this page is for the shop only. */
async function route(clerk) {
  app.replaceChildren(h('p', { text: 'Signing you in…' }));
  const sb = await getSupabase();
  const { data: role } = await sb.rpc('admin_role');
  if (role === 'owner' || role === 'editor') return location.replace('/admin.html');
  app.replaceChildren(
    h('h1', { text: 'This sign-in is for the shop' }),
    h('p', { class: 'muted', text: `${clerk.user.primaryEmailAddress?.emailAddress || 'This account'} is not on the shop's staff list. You don't need an account to order: add items to the cart and send the order on WhatsApp.` }),
    h('p', {}, h('button', { class: 'ghost', type: 'button', text: 'Sign out', onclick: () => location.replace(`${here}?signout`) })),
    back());
}

function show(clerk, note = '') {
  const box = h('div', { class: 'clerk-box' });
  app.replaceChildren(
    h('h1', { text: 'Shop sign-in' }),
    h('p', { class: 'muted', text: 'For Parineeta staff, to update the website. Customers don\'t need an account to order.' }),
    note ? h('p', { class: 'msg', role: 'status', text: note }) : '',
    box,
    back());
  // A finished sign-in comes back here, and route() opens the admin panel.
  clerk.mountSignIn(box, { routing: 'hash', forceRedirectUrl: here, signInForceRedirectUrl: here, signUpForceRedirectUrl: here });
}

if (!configured) {
  unavailable('Sign-in is being set up', 'Please message us on WhatsApp for now.',
    'Developer: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY or VITE_CLERK_PUBLISHABLE_KEY is missing. Copy .env.example to .env in the frontend folder, then restart npm run dev.');
} else {
  let clerk = null;
  try { clerk = await getClerk(); } catch (err) {
    unavailable('Sign-in could not load', 'Check your connection and reload the page.', `Developer: ${err.message}`);
  }
  if (clerk && params.has('signout')) {
    await clerk.signOut();
    show(clerk, 'You are signed out.');
  } else if (clerk?.user) route(clerk);
  else if (clerk) show(clerk);
}
