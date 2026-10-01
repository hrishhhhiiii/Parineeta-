// Clerk signs people in; Supabase stays the database and trusts Clerk's session token.
// Imported lazily, so guests never download Clerk or supabase-js.
import { Clerk } from '@clerk/clerk-js';
import { ui } from '@clerk/ui';
import { createClient } from '@supabase/supabase-js';

export { profileOf, avatar } from './profile.js';

const URL_ = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const PK = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export const configured = Boolean(URL_ && KEY && PK);

const appearance = {
  variables: {
    colorPrimary: '#d8a94a',
    colorPrimaryForeground: '#150507',
    colorBackground: '#22100f',
    colorForeground: '#f6eddb',
    colorMutedForeground: '#d9cab0',
    colorInput: '#150507',
    colorInputForeground: '#f6eddb',
    colorNeutral: '#f6eddb',
    colorDanger: '#ffb4a8',
    borderRadius: '10px',
  },
  // Staff accounts are managed by the owner, so Clerk's own "Delete account" is hidden.
  elements: { profileSection__danger: { display: 'none' } },
};

let clerkPromise;
/** The loaded Clerk instance, shared by everything on the page. */
export function getClerk() {
  return (clerkPromise ??= (async () => {
    const clerk = new Clerk(PK);
    // Signing out anywhere (UserButton, UserProfile) lands on /login?signout.
    await clerk.load({ ui, appearance, signInUrl: '/login.html', afterSignOutUrl: '/login.html?signout' });
    return clerk;
  })());
}

let db;
/** Supabase client that sends the signed-in person's Clerk token with every request. */
export async function getSupabase() {
  const clerk = await getClerk();
  return (db ??= createClient(URL_, KEY, { accessToken: async () => (await clerk.session?.getToken()) ?? null }));
}

/** The signed-in person as { id, email, name, photo }, or null. */
export function userOf(u) {
  if (!u) return null;
  return { id: u.id, email: u.primaryEmailAddress?.emailAddress || '', name: u.fullName || '', photo: u.hasImage ? u.imageUrl : '' };
}
