// One sign-in page for everyone, run by Clerk. After signing in, shop staff go to the admin panel
// and customers go to their orders (/account). An account is optional: customers can always buy
// as guests. Tabs switch between Sign in and Create account, and "Forgot your password?" resets it
// with a code sent by email. Password, email code and Google are switched on in the Clerk dashboard.
import '../styles/numerals.css';
import './login.css';
import { configured, getClerk, getSupabase } from '../auth/client.js';
import { tooManyHops } from '../auth/hops.js';

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

// Browsers that have signed in before open on "Sign in"; first-time visitors open on "Create account".
// Remembered on this device only, so the page never reveals whether an email has an account.
const KNOWN = 'parineeta:has-account';
const knownDevice = () => { try { return localStorage.getItem(KNOWN) === '1'; } catch { return false; } };
const rememberDevice = () => { try { localStorage.setItem(KNOWN, '1'); } catch { /* storage blocked */ } };

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
  const next = role === 'owner' || role === 'editor' ? '/admin.html' : '/account.html';
  if (tooManyHops()) {
    app.replaceChildren(h('h1', { text: 'You are signed in' }),
      h('p', { class: 'muted', text: 'The page kept reloading, so we stopped it. Open your page below. If it happens again, sign out and back in.' }),
      h('p', {}, h('a', { href: next, text: role ? 'Open the admin panel →' : 'Open my orders →' })),
      h('p', {}, h('a', { href: '/login.html?signout', text: 'Sign out' })),
      back());
    return;
  }
  location.replace(next);
}

const TEXT = {
  signin: ['Welcome back', 'Sign in to see your orders and how they are coming along.'],
  signup: ['Create your account', 'Optional: it keeps your orders in one place, with their progress. You can always order without one.'],
  reset: ['Reset your password', 'We will email you a 6-digit code. Enter it with a new password and you are signed in.'],
};

let mounted = null; // the Clerk form on screen, removed before showing another
// Switching tabs: also drop Clerk's #/… step, so the other form starts fresh. (Not on first load:
// Google sign-in returns to #/sso-callback, which the mounted form must see.)
const switchTo = (clerk, m) => {
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  show(clerk, m);
};
function show(clerk, mode, note = '') {
  if (mounted) { mounted(); mounted = null; }
  const [title, intro] = TEXT[mode];
  const tab = (m, label) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(mode === m), onclick: () => switchTo(clerk, m) }, label);
  const box = h('div', { class: mode === 'reset' ? 'card' : 'clerk-box' });
  app.replaceChildren(
    h('h1', { text: title }),
    h('p', { class: 'muted', text: intro }),
    h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Sign in or create an account' }, tab('signin', 'Sign in'), tab('signup', 'Create account')),
    note ? h('p', { class: 'msg', role: 'status', text: note }) : '',
    box,
    mode === 'signin' ? h('p', { class: 'forgot' }, h('button', { type: 'button', class: 'linkbtn', text: 'Forgot your password?', onclick: () => switchTo(clerk, 'reset') })) : '',
    back());
  if (mode === 'reset') return resetForm(clerk, box);
  // Every finished sign-in or sign-up comes back here, and route() picks the right page.
  const opts = {
    routing: 'hash',
    forceRedirectUrl: here,
    signInForceRedirectUrl: here,
    signUpForceRedirectUrl: here,
    signInUrl: `${here}?signin`,
    signUpUrl: `${here}?signup`,
  };
  if (mode === 'signin') { clerk.mountSignIn(box, opts); mounted = () => clerk.unmountSignIn(box); }
  else { clerk.mountSignUp(box, opts); mounted = () => clerk.unmountSignUp(box); }
}

const clerkMessage = (err) => err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || 'Something went wrong. Please try again.';

/** Forgot password: email → 6-digit code + new password → signed in. */
function resetForm(clerk, box) {
  const msg = h('p', { class: 'msg', role: 'status' });
  const say = (text, err = false) => { msg.textContent = text; msg.className = `msg${err ? ' is-err' : ''}`; };
  let signIn = null;

  const email = h('input', { type: 'email', name: 'email', autocomplete: 'email', required: true, inputmode: 'email' });
  const sendBtn = h('button', { type: 'submit', text: 'Email me a code' });
  const step1 = h('form', { class: 'form', novalidate: true },
    h('label', {}, 'Your account email', email), sendBtn, msg);
  step1.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) return say('Please enter the email you signed up with.', true);
    sendBtn.disabled = true;
    say('Sending…');
    try {
      signIn = await clerk.client.signIn.create({ strategy: 'reset_password_email_code', identifier: email.value.trim() });
      showStep2();
    } catch (err) {
      say(clerkMessage(err), true);
    } finally {
      sendBtn.disabled = false;
    }
  });

  function showStep2() {
    const code = h('input', { type: 'text', name: 'code', autocomplete: 'one-time-code', inputmode: 'numeric', maxlength: 6, required: true });
    const password = h('input', { type: 'password', name: 'password', autocomplete: 'new-password', minlength: 8, required: true });
    const saveBtn = h('button', { type: 'submit', text: 'Set new password and sign in' });
    const step2 = h('form', { class: 'form', novalidate: true },
      h('p', { class: 'muted', text: `We sent a code to ${email.value.trim()}. It can take a minute; check your spam folder too.` }),
      h('label', {}, '6-digit code', code),
      h('label', {}, 'New password (8 or more characters)', password),
      saveBtn, msg);
    say('');
    step2.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!/^\d{6}$/.test(code.value.trim())) return say('Enter the 6-digit code from the email.', true);
      if (password.value.length < 8) return say('The new password needs 8 or more characters.', true);
      saveBtn.disabled = true;
      say('Saving…');
      try {
        let si = await signIn.attemptFirstFactor({ strategy: 'reset_password_email_code', code: code.value.trim() });
        if (si.status === 'needs_new_password') si = await si.resetPassword({ password: password.value, signOutOfOtherSessions: true });
        if (si.status === 'complete') {
          await clerk.setActive({ session: si.createdSessionId });
          return route();
        }
        say('Your password is changed. Please sign in with it.');
        setTimeout(() => show(clerk, 'signin', 'Password changed. Sign in with your new password.'), 1500);
      } catch (err) {
        say(clerkMessage(err), true);
      } finally {
        saveBtn.disabled = false;
      }
    });
    box.replaceChildren(step2);
    code.focus();
  }

  box.replaceChildren(step1);
  email.focus();
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
  else if (clerk) show(clerk, params.has('reset') ? 'reset' : params.has('signup') ? 'signup' : params.has('signin') || knownDevice() ? 'signin' : 'signup');
}
