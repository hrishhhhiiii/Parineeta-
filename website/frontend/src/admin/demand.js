// "What customers want" in the admin (shop catalogue, phase 4; database/migrations/014_shop.sql):
// searches on the website that found nothing, and customers waiting for sold-out pieces.
// Waiting customers are messaged by the shop on WhatsApp; "Done, clear" then deletes their number.

const when = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/** sb: Supabase client; h, toast, explain: the admin's helpers; products(): [[id, name], …];
 *  choiceText(productId, pick): "Size: Large" for a waiting customer's choices. */
export function demandView(sb, { h, toast, explain, products, choiceText }) {
  const body = h('div', {}, h('p', { class: 'loading', text: 'Loading…' }));
  let data = { misses: [], requests: [], flags: [] };
  const nameOf = (id) => products().find(([k]) => k === id)?.[1] || id;

  const call = async (fn, args, done) => {
    const { error } = await sb.rpc(fn, args);
    if (error) return toast(`Could not save: ${explain(error)}`, 'err');
    toast(done);
    load();
  };

  const flagNote = () => {
    if (!data.flags.length) return null;
    const days = [...new Set(data.flags.map((f) => when(f.day)))].join(', ');
    return h('div', { class: 'card demand__flag' },
      h('strong', { text: 'A daily limit was reached' }),
      h('p', { class: 'muted', text: `On ${days} more searches or "Notify me" requests arrived than the daily limit, so some were dropped. Usually this is spam; if it keeps happening, tell your developer.` }));
  };

  const misses = () => h('section', { class: 'card demand__block' },
    h('h2', { text: 'Searched for, found nothing' }),
    h('p', { class: 'muted', text: 'What customers typed in the website search when nothing matched. Something new to make, or a name to add under a product’s "Other names customers use".' }),
    data.misses.length
      ? h('table', { class: 'demand__table' },
        h('thead', {}, h('tr', {}, h('th', { text: 'Words' }), h('th', { text: 'Times' }), h('th', { text: 'Last' }), h('th', {}))),
        h('tbody', {}, ...data.misses.map((m) => h('tr', {},
          h('td', { text: m.term }),
          h('td', { text: String(m.count) }),
          h('td', { text: when(m.last_seen) }),
          h('td', {}, h('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Clear', 'aria-label': `Clear "${m.term}"`,
            onclick: () => call('clear_search_miss', { p_term: m.term }, `“${m.term}” cleared.`) }))))))
      : h('p', { text: 'Nothing yet. Searches that find nothing appear here.' }));

  const waiting = () => {
    const groups = new Map();
    for (const r of data.requests) {
      if (!groups.has(r.product)) groups.set(r.product, []);
      groups.get(r.product).push(r);
    }
    return h('section', { class: 'card demand__block' },
      h('h2', { text: 'Waiting for sold-out pieces' }),
      h('p', { class: 'muted', text: 'Customers who asked to be told when a sold-out piece is back. Message them on WhatsApp, then press "Done, clear" (their number is deleted). Numbers are also deleted automatically after 90 days.' }),
      groups.size
        ? h('div', { class: 'demand__groups' }, ...[...groups].map(([pid, rows]) => h('div', { class: 'demand__group' },
          h('div', { class: 'demand__group-head' },
            h('h3', { text: `${nameOf(pid)} (${rows.length})` }),
            h('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Done, clear all', onclick: () => {
              if (confirm(`Clear all ${rows.length} waiting for ${nameOf(pid)}? Do this after you have messaged them.`)) call('restock_done', { p_ids: rows.map((r) => r.id) }, 'Cleared.');
            } })),
          h('ul', { class: 'demand__list' }, ...rows.map((r) => {
            const choice = choiceText(pid, r.pick);
            const msg = `Namaskar from Parineeta! ${nameOf(pid)}${choice ? ` (${choice})` : ''} is back. Would you like us to keep one for you?`;
            return h('li', {},
              h('span', { class: 'demand__who' }, h('strong', { text: `+91 ${r.phone.slice(0, 5)} ${r.phone.slice(5)}` }), choice ? h('span', { class: 'muted', text: choice }) : null, h('span', { class: 'muted', text: `asked ${when(r.created_at)}` })),
              h('span', { class: 'row' },
                h('a', { class: 'btn btn--gold btn--sm', href: `https://wa.me/91${r.phone}?text=${encodeURIComponent(msg)}`, target: '_blank', rel: 'noopener', text: 'Message on WhatsApp' }),
                h('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Done, clear', onclick: () => call('restock_done', { p_ids: [r.id] }, 'Cleared.') })));
          })))))
        : h('p', { text: 'No one is waiting. When a piece is sold out, customers can ask to be told when it is back.' }));
  };

  const paint = () => body.replaceChildren(flagNote() || '', misses(), waiting());

  async function load() {
    const { data: d, error } = await sb.rpc('admin_demand');
    if (error) {
      const missing = /admin_demand|function|404|PGRST202/i.test(`${error.message} ${error.code || ''}`);
      body.replaceChildren(h('div', { class: 'card' },
        h('strong', { text: missing ? 'One-time database update needed' : 'Could not load' }),
        h('p', { class: 'muted', text: missing ? 'Run website/database/migrations/014_shop.sql in Supabase, then open this page again.' : explain(error) })));
      return;
    }
    data = { misses: d?.misses || [], requests: d?.requests || [], flags: d?.flags || [] };
    paint();
  }
  load();
  return h('div', {},
    h('div', { class: 'sec-head' }, h('div', {}, h('h1', { text: 'What customers want' }),
      h('p', { class: 'muted', text: 'Searches that found nothing, and customers waiting for sold-out pieces.' }))),
    body);
}
