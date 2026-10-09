// Signed in: the top-bar person icon becomes Clerk's UserButton (photo, "Manage account", sign out),
// with links to the customer's orders and, for staff, their panel plus an Admin / Editor badge.
import { configured, getClerk, getSupabase } from '../auth/client.js';
import { icon } from './dom.js';

const PANEL = { owner: ['Admin', 'Admin panel'], editor: ['Editor', 'Editor panel'] };
// Clerk silently drops a link item unless it has both mountIcon and unmountIcon.
const menuIcon = (name) => ({ mountIcon: (el) => el.replaceChildren(icon(name)), unmountIcon: (el) => el?.replaceChildren() });

export async function startAccountMenu() {
  const slot = document.querySelector('.nav__account');
  if (!configured || !slot) return;
  const clerk = await getClerk();
  if (!clerk.user) return;
  const sb = await getSupabase();
  const { data: role } = await sb.rpc('admin_role');
  const staff = PANEL[role];

  const mount = document.createElement('div');
  const wrap = document.createElement('div');
  wrap.className = 'nav__account-wrap';
  wrap.append(mount);
  if (staff) {
    const badge = document.createElement('span');
    badge.className = 'avatar__role';
    badge.textContent = staff[0];
    wrap.append(badge);
  }
  slot.replaceWith(wrap);
  clerk.mountUserButton(mount, {
    customMenuItems: [
      ...(staff ? [{ label: staff[1], href: '/admin.html', ...menuIcon('pencil-simple-line') }] : []),
      { label: 'My orders', href: '/account.html', ...menuIcon('receipt') },
      { label: 'manageAccount' },
      { label: 'signOut' },
    ],
  });

  // The phone menu's "Sign in" becomes "My account" for everyone; staff reach their panel from the photo menu.
  const mobile = document.querySelector('.menu__links a[href^="/login.html"]');
  if (mobile) {
    mobile.textContent = 'My account';
    mobile.href = '/account.html';
  }
}
