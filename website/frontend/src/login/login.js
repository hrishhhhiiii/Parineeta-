// One sign-in page for everyone. After sign-in: owners → admin panel, editors → editor panel
// (the same admin app with publishing and the inbox hidden), customers → their enquiries.
import '../account/account.css';
import { createClient } from '@supabase/supabase-js';

const URL_ = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
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
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...kids.flat().filter((c) => c != null && c !== false));
  return el;
}
const EXAMPLES = { email: 'you@example.com…' };
const input = (type, label, auto, extra = {}) => {
  const i = h('input', {
    type, name: extra.name || (type === 'email' ? 'email' : auto), required: true, autocomplete: auto,
    placeholder: EXAMPLES[type], spellcheck: type === 'email' ? 'false' : null, autocapitalize: type === 'email' ? 'none' : null, ...extra,
  });
  const err = h('span', { class: 'fld__err', role: 'alert' });
  return { i, err, row: h('label', { class: 'fld' }, h('span', { text: label }), i, err) };
};
/** Shows an error under one field and moves focus to it. */
function fieldError(f, text) {
  f.err.textContent = text;
  f.i.setAttribute('aria-invalid', 'true');
  f.i.focus();
  f.i.addEventListener('input', () => { f.err.textContent = ''; f.i.removeAttribute('aria-invalid'); }, { once: true });
}
// Focusing a field opens the phone keyboard over the page, so only do it with a mouse or trackpad.
const focusIfDesktop = (el) => { if (matchMedia('(pointer: fine)').matches) el.focus(); };
const msgEl = () => h('p', { class: 'msg', role: 'status' });
const say = (el, text, err = false) => { el.className = `msg${err ? ' is-err' : ''}`; el.textContent = text; };
const link = (text, fn) => h('button', { type: 'button', class: 'linkbtn', text, onclick: fn });
const back = () => h('p', {}, h('a', { href: '/', text: '← Back to Parineeta' }));

// Browsers that have signed in before open on "Sign in"; first-time visitors open on "Create account".
// Remembered on this device only, so the page never reveals whether an email has an account.
const KNOWN = 'parineeta:has-account';
const knownDevice = () => { try { return localStorage.getItem(KNOWN) === '1'; } catch { return false; } };
const rememberDevice = () => { try { localStorage.setItem(KNOWN, '1'); } catch { /* storage blocked: default to sign-up next time */ } };

/** Sign in / Create account switch shown above both forms. */
function tabs(active, email) {
  const tab = (id, text, go) => h('button', {
    type: 'button', role: 'tab', class: `tab${active === id ? ' is-on' : ''}`, 'aria-selected': String(active === id), text,
    onclick: () => active !== id && go(email.i.value.trim()),
  });
  return h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Account' },
    tab('signin', 'Sign in', (v) => signIn('', v)), tab('signup', 'Create account', signUp));
}

function friendly(error) {
  const m = error?.message || '';
  if (/invalid login credentials/i.test(m)) return 'That email and password do not match.';
  if (/email not confirmed/i.test(m)) return 'Please confirm your email first: open the link we sent you.';
  if (/already registered|already been registered/i.test(m)) return 'That email already has an account. Sign in, or use "Forgot password?".';
  if (/password should be|weak/i.test(m)) return 'Choose a longer password: at least 8 characters.';
  if (/rate|too many/i.test(m)) return 'Too many tries. Please wait a few minutes and try again.';
  return 'Something went wrong. Please try again.';
}

if (!URL_ || !KEY) {
  app.replaceChildren(h('h1', { text: 'Sign-in is being set up' }), h('p', { class: 'muted', text: 'Please message us on WhatsApp for now.' }),
    import.meta.env.DEV ? h('p', { class: 'msg is-err', text: 'Developer: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing. Copy .env.example to .env in the frontend folder, then restart npm run dev.' }) : null,
    back());
  throw new Error('Supabase is not configured');
}
const sb = createClient(URL_, KEY, { auth: { flowType: 'pkce', detectSessionInUrl: true } });

// The Google button only shows once Google sign-in is switched on in Supabase (Authentication → Providers).
const providers = fetch(`${URL_}/auth/v1/settings`, { headers: { apikey: KEY } })
  .then((r) => (r.ok ? r.json() : {})).then((d) => d.external || {}).catch(() => ({}));

const GOOGLE_G = '<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.2C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-9.9 6.9-17.2z"/><path fill="#FBBC05" d="M10.6 28.5c-.5-1.4-.8-2.9-.8-4.5s.3-3.1.8-4.5l-7.9-6.2C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.2z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.2C6.6 42.6 14.6 48 24 48z"/></svg>';

function googleButton(msg) {
  const btn = h('button', { type: 'button', class: 'oauth', hidden: true });
  btn.innerHTML = GOOGLE_G;
  btn.append(h('span', { text: 'Continue with Google' }));
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: here } });
    if (error) {
      btn.disabled = false;
      say(msg, 'Google sign-in is not available right now. Use your email and password.', true);
    }
  });
  providers.then((p) => { btn.hidden = !p.google; });
  return btn;
}

/** Sends a signed-in person to the page for their role. */
async function route() {
  rememberDevice();
  app.replaceChildren(h('p', { text: 'Signing you in…' }));
  const { data: role } = await sb.rpc('admin_role');
  location.replace(role === 'owner' || role === 'editor' ? PAGES.admin : PAGES.account);
}

function signIn(note = '', prefill = '') {
  const email = input('email', 'Email', 'username', { value: prefill });
  const pass = input('password', 'Password', 'current-password', { minlength: 6 });
  const msg = msgEl();
  if (note) say(msg, note);
  const btn = h('button', { type: 'submit', text: 'Sign in' });
  const google = googleButton(msg);
  const or = h('p', { class: 'or', hidden: true }, h('span', { text: 'or use your email' }));
  providers.then((p) => { or.hidden = !p.google; });
  const form = h('form', { class: 'card' }, google, or, email.row, pass.row, btn, msg);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    btn.disabled = true;
    say(msg, 'Signing in…');
    const { error } = await sb.auth.signInWithPassword({ email: email.i.value.trim(), password: pass.i.value });
    btn.disabled = false;
    if (error) {
      say(msg, friendly(error), true);
      // Supabase answers the same for "no such account" and "wrong password", so offer both ways out.
      if (/invalid login credentials/i.test(error.message)) {
        msg.append(h('span', { class: 'hint' }, 'New here? ', link('Create an account with this email', () => signUp(email.i.value.trim())), ' · ', link('Reset password', () => forgot(email.i.value.trim()))));
      }
      return;
    }
    route();
  });
  app.replaceChildren(
    h('h1', { text: 'Welcome back' }),
    h('p', { class: 'muted', text: 'Sign in to follow your orders. You don\'t need an account to enquire.' }),
    tabs('signin', email),
    form,
    h('p', { class: 'links' }, link('Forgot password?', () => forgot(email.i.value)), ' · ', link('Email me a sign-in link instead', () => magic(email.i.value))),
    back());
  (prefill ? pass.i : email.i).focus();
}

function signUp(prefill = '') {
  const email = input('email', 'Email', 'email', { value: prefill });
  const pass = input('password', 'Password (8+ characters)', 'new-password', { minlength: 8 });
  const again = input('password', 'Type the password again', 'new-password', { minlength: 8 });
  const msg = msgEl();
  const btn = h('button', { type: 'submit', text: 'Create account' });
  const google = googleButton(msg);
  const form = h('form', { class: 'card' }, google, email.row, pass.row, again.row, btn, msg);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (pass.i.value !== again.i.value) return fieldError(again, 'The two passwords are different. Type the same password in both boxes.');
    btn.disabled = true;
    say(msg, 'Creating your account…');
    const { data, error } = await sb.auth.signUp({ email: email.i.value.trim(), password: pass.i.value, options: { emailRedirectTo: here } });
    btn.disabled = false;
    if (error) return say(msg, friendly(error), true);
    if (data.session) return route();
    form.replaceChildren(h('p', { text: `Almost done. We sent a confirmation link to ${email.i.value.trim()}. Open it to finish creating your account.` }));
  });
  app.replaceChildren(h('h1', { text: 'Create your account' }),
    h('p', { class: 'muted', text: 'Optional. It keeps all your enquiries and orders in one place. You don\'t need an account to enquire.' }),
    tabs('signup', email),
    form,
    h('p', { class: 'links' }, 'Already have an account? ', link('Sign in', () => signIn('', email.i.value.trim())), ' · ', link('Email me a sign-in link instead', () => magic(email.i.value))),
    back());
  focusIfDesktop(email.i);
}

function forgot(prefill = '') {
  const email = input('email', 'Email', 'email', { value: prefill });
  const msg = msgEl();
  const btn = h('button', { type: 'submit', text: 'Email me a reset link' });
  const form = h('form', { class: 'card' }, email.row, btn, msg);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    btn.disabled = true;
    const { error } = await sb.auth.resetPasswordForEmail(email.i.value.trim(), { redirectTo: `${here}?reset=1` });
    btn.disabled = false;
    // Same answer whether or not the email has an account, so the form can't be used to find accounts.
    if (error && /rate|too many/i.test(error.message)) return say(msg, friendly(error), true);
    say(msg, `If ${email.i.value.trim()} has an account, a link to set a new password is on its way. It works once.`);
  });
  app.replaceChildren(h('h1', { text: 'Forgot your password?' }), h('p', { class: 'muted', text: 'We will email you a link to choose a new one.' }),
    form, h('p', {}, link('← Back to sign in', () => signIn())), back());
}

function magic(prefill = '') {
  const email = input('email', 'Email', 'email', { value: prefill });
  const msg = msgEl();
  const btn = h('button', { type: 'submit', text: 'Email me a sign-in link' });
  const form = h('form', { class: 'card' }, email.row, btn, msg);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    btn.disabled = true;
    const { error } = await sb.auth.signInWithOtp({ email: email.i.value.trim(), options: { emailRedirectTo: here } });
    btn.disabled = false;
    if (error) return say(msg, friendly(error), true);
    say(msg, `Check ${email.i.value.trim()} for a sign-in link. Open it on this device.`);
  });
  app.replaceChildren(h('h1', { text: 'Sign in with an email link' }), h('p', { class: 'muted', text: 'No password needed. New customers get an account automatically.' }),
    form, h('p', {}, link('← Sign in with a password', () => signIn())), back());
}

function newPassword() {
  const pass = input('password', 'New password (8+ characters)', 'new-password', { minlength: 8 });
  const again = input('password', 'Type it again', 'new-password', { minlength: 8 });
  const msg = msgEl();
  const btn = h('button', { type: 'submit', text: 'Save new password' });
  const form = h('form', { class: 'card' }, pass.row, again.row, btn, msg);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (pass.i.value !== again.i.value) return fieldError(again, 'The two passwords are different. Type the same password in both boxes.');
    btn.disabled = true;
    const { error } = await sb.auth.updateUser({ password: pass.i.value });
    btn.disabled = false;
    if (error) return say(msg, friendly(error), true);
    say(msg, 'Password saved.');
    history.replaceState(null, '', location.pathname);
    setTimeout(route, 800);
  });
  app.replaceChildren(h('h1', { text: 'Choose a new password' }), form, back());
}

let recovering = params.has('reset');
const oauthError = params.get('error_description') || new URLSearchParams(location.hash.slice(1)).get('error_description');
sb.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') {
    recovering = true;
    newPassword();
  }
});

const { data: { session } } = await sb.auth.getSession();
if (params.has('signout')) {
  await sb.auth.signOut();
  signIn('You are signed out.');
} else if (session && recovering) newPassword();
else if (session) route();
else if (recovering) signIn('That reset link has expired or was already used. Ask for a new one below.');
else if (oauthError) signIn('Google sign-in was cancelled or failed. Try again, or use your email and password.');
else if (params.has('signup')) signUp();
else if (params.has('signin') || knownDevice()) signIn();
else signUp();
