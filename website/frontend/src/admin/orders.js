// Owner: orders from the website's checkout (saved by database/migrations/009_simple_orders.sql).
// The customer has already sent the same order on WhatsApp; here the owner records the payment
// and moves the order along until it is delivered.

export const ORDER_STATUS = [
  ['placed', 'New: check the payment'],
  ['paid', 'Payment received'],
  ['making', 'Being made'],
  ['ready', 'Ready'],
  ['delivered', 'Delivered'],
  ['cancelled', 'Cancelled'],
];
const METHOD = { upi: 'UPI', bank: 'Bank transfer', gateway: 'Payment page', later: 'Pay at the shop or on delivery' };
const rupees = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
const when = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** The Orders tab. sb: Supabase client; h, toast, explain: the admin panel's helpers. */
export function ordersView(sb, { h, toast, explain }) {
  const body = h('div', {}, h('p', { class: 'loading', text: 'Loading orders…' }));
  let filter = 'open';
  let rows = [];

  const paint = () => {
    const list = rows.filter((o) => (filter === 'all' ? true : filter === 'open' ? !['delivered', 'cancelled'].includes(o.status) : o.status === filter));
    body.replaceChildren(
      h('div', { class: 'inbox__tools' },
        h('select', { class: 'input', 'aria-label': 'Show', onchange: (e) => { filter = e.target.value; paint(); } },
          ...[['open', 'Open orders'], ['all', 'All orders'], ...ORDER_STATUS].map(([v, t]) => h('option', { value: v, text: t, selected: v === filter })))),
      list.length ? h('div', { class: 'inbox' }, ...list.map(card))
        : h('div', { class: 'card' }, h('strong', { text: rows.length ? 'Nothing here' : 'No orders yet' }),
          h('p', { class: 'muted', text: rows.length ? 'Try “All orders”.' : 'When a customer checks out on the website, the order appears here, and it also arrives on WhatsApp.' })));
  };

  const card = (o) => {
    const digits = String(o.phone || '').replace(/[^\d]/g, '');
    const status = h('select', { class: 'input', 'aria-label': `Stage of order ${o.ref}` },
      ...ORDER_STATUS.map(([v, t]) => h('option', { value: v, text: t, selected: v === o.status })));
    const amount = h('input', { class: 'input', type: 'number', min: 0, step: 1, inputmode: 'numeric', placeholder: 'Amount received ₹',
      value: o.paid_amount ?? '', 'aria-label': `Amount received for ${o.ref}` });
    const save = h('button', { type: 'button', class: 'btn btn--gold btn--sm', text: 'Save', onclick: async () => {
      const amt = amount.value === '' ? null : Math.round(Number(amount.value));
      if (status.value === 'paid' && !(amt > 0)) return toast('Enter the amount you received.', 'err');
      save.disabled = true;
      const { error } = await sb.rpc('set_order_status', { p_ref: o.ref, p_status: status.value, p_amount: amt });
      save.disabled = false;
      if (error) return toast(explain(error), 'err');
      Object.assign(o, { status: status.value, suspect: false, ...(amt > 0 ? { paid_amount: amt } : {}) });
      toast(`Order ${o.ref} saved.`);
      paint();
    } });
    const remove = h('button', { type: 'button', class: 'linkbtn', text: 'Delete (test or spam order)', onclick: async () => {
      if (!confirm(`Delete order ${o.ref} from ${o.name}? This cannot be undone.`)) return;
      const { error } = await sb.rpc('delete_order', { p_ref: o.ref });
      if (error) return toast(explain(error), 'err');
      rows = rows.filter((x) => x !== o);
      paint();
    } });
    const paidLine = o.method === 'later'
      ? 'Pays at the shop or on delivery'
      : `Customer was asked to pay ${rupees(o.paid_now)}${o.plan ? ` (${o.plan})` : ''} by ${METHOD[o.method] || o.method}${o.utr ? ` · payment ref ${o.utr}` : ''}`;
    return h('article', { class: 'card inbox__item' },
      h('div', { class: 'inbox__head' }, h('strong', { text: `${o.ref} · ${o.name}` }), h('span', { class: 'muted', text: when(o.created_at) })),
      o.suspect ? h('p', { class: 'form-msg', text: 'Many orders came from the same connection within an hour. Check this one is real before making it.' }) : null,
      h('p', {}, ...[
        o.phone ? h('a', { href: `tel:${o.phone}`, text: o.phone }) : null,
        digits.length >= 10 ? h('a', { href: `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}`, target: '_blank', rel: 'noopener', text: 'WhatsApp' }) : null,
        o.email ? h('a', { href: `mailto:${o.email}`, text: o.email }) : null,
      ].filter(Boolean).flatMap((x, i) => (i ? [' · ', x] : [x]))),
      h('ul', {}, ...(o.items || []).map((i) => h('li', { text: `${i.qty} × ${i.title}${i.detail ? ` (${i.detail})` : ''}: ${rupees(i.amount)}` }))),
      h('p', { text: `Estimated total ${rupees(o.total)}. ${paidLine}.` }),
      o.event_date || o.address ? h('p', { class: 'muted', text: [o.event_date && `Event: ${o.event_date}`, o.address && `Deliver to: ${o.address}`].filter(Boolean).join(' · ') }) : null,
      o.paid_amount ? h('p', { class: 'muted', text: `Received ${rupees(o.paid_amount)}${o.paid_at ? ` on ${when(o.paid_at)}` : ''}${o.paid_by ? ` (${o.paid_by})` : ''}` }) : null,
      h('div', { class: 'row' }, status, amount, save),
      h('p', {}, remove));
  };

  sb.rpc('list_orders').then(({ data, error }) => {
    if (error) return body.replaceChildren(h('p', { class: 'form-msg', text: `Could not load orders: ${explain(error)}` }));
    rows = data || [];
    paint();
  });
  return h('div', {}, h('div', { class: 'sec-head' }, h('div', {}, h('h1', { text: 'Orders' }),
    h('p', { class: 'muted', text: 'Orders from the website. Each one also arrives on WhatsApp. Check the payment in your bank or UPI app, then set the stage here as the order moves along.' }))), body);
}
