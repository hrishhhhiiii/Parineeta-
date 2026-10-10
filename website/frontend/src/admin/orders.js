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
  ['refund_started', 'Refund initiated'],
  ['refunded', 'Refund completed'],
];
const REFUND = ['refund_started', 'refunded'];
// The website has asked customers to sign in before ordering since this day; older orders could be placed as a guest.
const SIGN_IN_SINCE = '2026-10-10';
const CLOSED = ['delivered', 'cancelled', 'refunded'];
const waTo = (phone, text) => {
  const d = String(phone || '').replace(/[^\d]/g, '');
  return d.length >= 10 ? `https://wa.me/${d.length === 10 ? `91${d}` : d}?text=${encodeURIComponent(text)}` : '';
};
const METHOD = { upi: 'UPI', bank: 'Bank transfer', gateway: 'Payment page', later: 'Pay at the shop or on delivery' };
const rupees = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
const when = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** The Orders tab. sb: Supabase client; h, toast, explain: the admin panel's helpers. */
export function ordersView(sb, { h, toast, explain }) {
  const body = h('div', {}, h('p', { class: 'loading', text: 'Loading orders…' }));
  let filter = 'open';
  let rows = [];

  const paint = () => {
    const list = rows.filter((o) => (filter === 'all' ? true : filter === 'open' ? !CLOSED.includes(o.status) : o.status === filter));
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
    // Refunds are sent by hand from the bank or UPI app; these boxes record them (016_refunds.sql).
    const r = o.refund || {};
    const refundAmt = h('input', { class: 'input', type: 'number', min: 1, step: 1, inputmode: 'numeric', placeholder: 'Refund amount ₹',
      value: r.amount ?? o.paid_amount ?? o.paid_now ?? '', 'aria-label': `Refund amount for ${o.ref}` });
    const refundRef = h('input', { class: 'input', maxlength: 60, autocomplete: 'off', spellcheck: 'false', placeholder: 'Refund UPI / bank reference',
      value: r.ref || '', 'aria-label': `Refund reference for ${o.ref}` });
    const refundNote = h('input', { class: 'input', maxlength: 300, placeholder: 'Reason (optional, only you see it)', value: r.note || '', 'aria-label': `Refund reason for ${o.ref}` });
    const askUpi = h('a', { target: '_blank', rel: 'noopener', text: 'Ask the customer for their UPI ID on WhatsApp ↗' });
    const paintAsk = () => {
      const url = waTo(o.phone, `Namaskar ${o.name}, this is Parineeta about order ${o.ref}. We are refunding ${rupees(Number(refundAmt.value) || 0)}. Please send us the UPI ID to send it to.`);
      askUpi.hidden = !url;
      if (url) askUpi.href = url;
    };
    refundAmt.addEventListener('input', paintAsk);
    paintAsk();
    const refundBox = h('div', { class: 'refund' },
      h('p', { class: 'muted', text: 'Send the refund from your bank or UPI app first, then record it here. The customer sees it on their account page.' }),
      h('div', { class: 'row' }, refundAmt, refundRef),
      refundNote,
      h('p', {}, askUpi));
    const showFields = () => {
      const refund = REFUND.includes(status.value);
      refundBox.hidden = !refund;
      amount.hidden = refund;
    };
    status.addEventListener('change', showFields);
    showFields();
    const save = h('button', { type: 'button', class: 'btn btn--gold btn--sm', text: 'Save', onclick: async () => {
      let error;
      if (REFUND.includes(status.value)) {
        const amt = Math.round(Number(refundAmt.value));
        if (!(amt > 0)) return toast('Enter the amount you are refunding.', 'err');
        if (status.value === 'refunded' && !refundRef.value.trim() && !confirm('Save the refund as completed without its UPI / bank reference?')) return;
        save.disabled = true;
        ({ error } = await sb.rpc('set_order_refund', { p_ref: o.ref, p_stage: status.value, p_amount: amt, p_refund_ref: refundRef.value, p_note: refundNote.value }));
        if (!error) {
          const now = new Date().toISOString();
          o.refund = { ...r, amount: amt, ref: refundRef.value.trim(), note: refundNote.value.trim(), startedAt: r.startedAt || now, doneAt: status.value === 'refunded' ? r.doneAt || now : null };
        }
      } else {
        const amt = amount.value === '' ? null : Math.round(Number(amount.value));
        if (status.value === 'paid' && !(amt > 0)) return toast('Enter the amount you received.', 'err');
        save.disabled = true;
        ({ error } = await sb.rpc('set_order_status', { p_ref: o.ref, p_status: status.value, p_amount: amt }));
        if (!error && amt > 0) o.paid_amount = amt;
      }
      save.disabled = false;
      if (error) {
        const missing = /set_order_refund|does not exist|schema cache|orders_status_check/i.test(error.message || '');
        return toast(missing ? 'Refunds need a one-time database update: run database/migrations/016_refunds.sql in Supabase, then try again.' : error.hint || explain(error), 'err');
      }
      Object.assign(o, { status: status.value, suspect: false });
      toast(`Order ${o.ref} saved.`);
      paint();
    } });
    const confirmUrl = r.doneAt ? waTo(o.phone, `Namaskar ${o.name}, your refund of ${rupees(r.amount)} for Parineeta order ${o.ref} has been sent${r.ref ? ` (reference ${r.ref})` : ''}. It can take a few days to show in your account.`) : '';
    const refundLine = r.amount
      ? h('p', { class: 'refund__line' },
        `${r.doneAt ? 'Refund completed' : 'Refund initiated'}: ${rupees(r.amount)} · ${when(r.doneAt || r.startedAt)}${r.ref ? ` · ref ${r.ref}` : ''}${r.by ? ` (${r.by})` : ''}${r.note ? ` · ${r.note}` : ''}`,
        ...(confirmUrl ? [' · ', h('a', { href: confirmUrl, target: '_blank', rel: 'noopener', text: 'Send confirmation on WhatsApp ↗' })] : []))
      : null;
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
      o.signed_in === false && o.created_at >= SIGN_IN_SINCE ? h('p', { class: 'form-msg', text: 'This order was sent without a signed-in account. The website always asks customers to sign in first, so check on WhatsApp that it is real before making it.' }) : null,
      o.totalCheck?.check === 'changed' ? h('p', { class: 'form-msg', text: `Check the price before taking money: the customer's page showed ${rupees(o.totalCheck.clientTotal)}, but the published prices add up to ${rupees(o.total)} (shown below). Either prices changed while they were ordering, or the page was edited.` }) : null,
      o.totalCheck?.check === 'unverified' ? h('p', { class: 'form-msg', text: 'The website could not check this total against the published prices (an older page, or a piece not in the published catalogue). Check the items and prices before taking money.' }) : null,
      h('p', {}, ...[
        o.phone ? h('a', { href: `tel:${o.phone}`, text: o.phone }) : null,
        digits.length >= 10 ? h('a', { href: `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}`, target: '_blank', rel: 'noopener', text: 'WhatsApp' }) : null,
        o.email ? h('a', { href: `mailto:${o.email}`, text: o.email }) : null,
      ].filter(Boolean).flatMap((x, i) => (i ? [' · ', x] : [x]))),
      h('ul', {}, ...(o.items || []).map((i) => h('li', { text: `${i.qty} × ${i.title}${i.detail ? ` (${i.detail})` : ''}: ${rupees(i.amount)}${i.clientAmount != null ? ` (their page said ${rupees(i.clientAmount)})` : ''}` }))),
      o.coupon ? h('p', { text: `Coupon ${o.coupon.code}: ${rupees(o.coupon.off)} off (already taken off the total below).` }) : null,
      h('p', { text: `Estimated total ${rupees(o.total)}. ${paidLine}.` }),
      o.event_date || o.address ? h('p', { class: 'muted', text: [o.event_date && `Event: ${o.event_date}`, o.address && `Deliver to: ${o.address}`].filter(Boolean).join(' · ') }) : null,
      o.paid_amount ? h('p', { class: 'muted', text: `Received ${rupees(o.paid_amount)}${o.paid_at ? ` on ${when(o.paid_at)}` : ''}${o.paid_by ? ` (${o.paid_by})` : ''}` }) : null,
      refundLine,
      h('div', { class: 'row' }, status, amount, save),
      refundBox,
      h('p', {}, remove));
  };

  // Refund details, price checks and coupons come from their own functions, so the Orders list still loads before 016/018/019 are run.
  const optional = (fn) => Promise.resolve(sb.rpc(fn)).catch(() => ({ data: {} }));
  Promise.all([sb.rpc('list_orders'), optional('list_refunds'), optional('list_total_checks'), optional('list_order_coupons')]).then(([{ data, error }, refunds, checks, coupons]) => {
    if (error) return body.replaceChildren(h('p', { class: 'form-msg', text: `Could not load orders: ${explain(error)}` }));
    const byRef = (!refunds?.error && refunds?.data) || {};
    const checkByRef = (!checks?.error && checks?.data) || {};
    const couponByRef = (!coupons?.error && coupons?.data) || {};
    rows = (data || []).map((o) => ({ ...o, ...(byRef[o.ref] ? { refund: byRef[o.ref] } : {}), ...(checkByRef[o.ref] ? { totalCheck: checkByRef[o.ref] } : {}), ...(couponByRef[o.ref] ? { coupon: couponByRef[o.ref] } : {}) }));
    paint();
  });
  return h('div', {}, h('div', { class: 'sec-head' }, h('div', {}, h('h1', { text: 'Orders' }),
    h('p', { class: 'muted', text: 'Orders from the website. Each one also arrives on WhatsApp. Check the payment in your bank or UPI app, then set the stage here as the order moves along.' }))), body);
}
