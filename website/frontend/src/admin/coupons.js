// Admin → Coupons (owner): codes customers type at checkout for money off. A code works on the website
// the moment it is saved (no "Put changes live"), and stops the moment it is switched off.
// Database: migrations/019_coupons.sql, which also works out every discount.

const rupees = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
const day = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const today = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

/** Why a code would be refused right now, or '' when it works. */
function stateOf(c) {
  if (!c.active) return 'Switched off';
  if (c.ends_on && c.ends_on < today()) return 'Ended';
  if (c.max_uses && c.used >= c.max_uses) return 'Used up';
  if (c.starts_on && c.starts_on > today()) return `Starts ${day(c.starts_on)}`;
  return '';
}

/** sb: Supabase client. h, toast, explain: the admin's helpers. */
export function couponsView(sb, { h, toast, explain }) {
  const body = h('div', {}, h('p', { class: 'loading', text: 'Loading coupons…' }));
  let rows = [];
  let editing = null; // the coupon being edited, or {} for a new one

  const describe = (c) => [
    c.kind === 'percent' ? `${c.value}% off${c.max_off ? `, at most ${rupees(c.max_off)}` : ''}` : `${rupees(c.value)} off`,
    c.min_total ? `orders of ${rupees(c.min_total)} or more` : 'any order',
    c.starts_on || c.ends_on ? [c.starts_on && `from ${day(c.starts_on)}`, c.ends_on && `until ${day(c.ends_on)}`].filter(Boolean).join(' ') : 'no end date',
    `used ${c.used}${c.max_uses ? ` of ${c.max_uses}` : ''} time${c.used === 1 && !c.max_uses ? '' : 's'}`,
  ].join(' · ');

  const save = async (p, done) => {
    const { error } = await sb.rpc('save_coupon', { p });
    if (error) return toast(error.hint || explain(error), 'err');
    done?.();
    load();
  };
  const payload = (c, extra = {}) => ({
    code: c.code, kind: c.kind, value: c.value, minTotal: c.min_total || '', maxOff: c.max_off || '', startsOn: c.starts_on || '', endsOn: c.ends_on || '',
    maxUses: c.max_uses || '', active: c.active, note: c.note || '', ...extra,
  });

  const card = (c) => {
    const state = stateOf(c);
    const toggle = h('input', { type: 'checkbox', checked: c.active, 'aria-label': `Coupon ${c.code} works on the website` });
    toggle.addEventListener('change', () => {
      toggle.disabled = true;
      save(payload(c, { active: toggle.checked }), () => toast(toggle.checked ? `${c.code} is on.` : `${c.code} is off. Customers can no longer use it.`));
    });
    return h('article', { class: `card rv-item${state ? '' : ' is-shown'}` },
      h('div', { class: 'rv-item__top' },
        h('label', { class: 'switch' }, toggle, h('span', { class: 'switch__track', 'aria-hidden': 'true' }), h('span', { class: 'switch__text', text: c.active ? 'On' : 'Off' })),
        state && c.active ? h('span', { class: 'badge-new', text: state }) : null),
      h('div', { class: 'rv-item__head' }, h('strong', { text: c.code })),
      h('p', { class: 'rv-card__text', text: describe(c) }),
      c.note ? h('p', { class: 'muted', text: c.note }) : null,
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Change', onclick: () => { editing = { ...c }; paint(); body.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }),
        h('button', { type: 'button', class: 'btn btn--danger btn--sm', text: 'Delete', onclick: async () => {
          if (!confirm(`Delete the code ${c.code} for good? To just stop it working, switch it off instead. Orders that already used it keep their discount.`)) return;
          const { error } = await sb.rpc('delete_coupon', { p_code: c.code });
          if (error) return toast(explain(error), 'err');
          load();
        } })));
  };

  const form = (c) => {
    const isNew = !c.code;
    const field = (label, control, help = '') => h('div', { class: 'field' }, h('label', { class: 'field__label' }, label, control), help ? h('p', { class: 'field__help', text: help }) : null);
    const input = (name, value, attrs = {}) => h('input', { class: 'input', name, value: value ?? '', ...attrs });
    const number = (name, value, attrs = {}) => input(name, value, { type: 'number', min: 0, step: 1, inputmode: 'numeric', ...attrs });
    const kind = h('select', { class: 'input', name: 'kind' },
      h('option', { value: 'percent', text: 'A percentage (e.g. 10% off)', selected: (c.kind || 'percent') === 'percent' }),
      h('option', { value: 'amount', text: 'A fixed amount (e.g. ₹200 off)', selected: c.kind === 'amount' }));
    const valueLabel = h('span', {});
    const maxOffField = field('Most it can take off, ₹ (optional)', number('maxOff', c.max_off), 'For example 500: a 10% code then never takes off more than ₹500.');
    const paintKind = () => {
      valueLabel.textContent = kind.value === 'percent' ? 'How many percent off' : 'How many rupees off';
      maxOffField.hidden = kind.value !== 'percent';
    };
    kind.addEventListener('change', paintKind);
    const value = number('value', c.value, { required: true, min: 1 });
    const f = h('form', { class: 'card form rv-form' },
      h('h2', { text: isNew ? 'Make a coupon code' : `Change ${c.code}` }),
      isNew ? field('The code customers type', input('code', '', { required: true, maxlength: 20, autocomplete: 'off', spellcheck: 'false', placeholder: 'WEDDING10' }),
        '3 to 20 letters or numbers, no spaces. Hard-to-guess codes are safer than short ones like SALE.') : null,
      h('div', { class: 'rv-form__row' },
        field('What it takes off', kind),
        h('div', { class: 'field' }, h('label', { class: 'field__label' }, valueLabel, value))),
      maxOffField,
      field('Smallest order it works on, ₹ (optional)', number('minTotal', c.min_total || '')),
      h('div', { class: 'rv-form__row' },
        field('Starts on (optional)', input('startsOn', c.starts_on, { type: 'date' })),
        field('Last day (optional)', input('endsOn', c.ends_on, { type: 'date' }))),
      field('How many orders can use it (optional)', number('maxUses', c.max_uses, { min: 1 }), isNew ? 'Leave empty for no limit.' : `Used ${c.used || 0} time${c.used === 1 ? '' : 's'} so far.`),
      field('Note for yourself (optional)', input('note', c.note, { maxlength: 200, placeholder: 'e.g. Given to wedding planners in November' })),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'active', checked: isNew ? true : Boolean(c.active) }), h('span', { text: 'On: customers can use it now' })),
      h('div', { class: 'row' },
        h('button', { type: 'submit', class: 'btn btn--gold', text: isNew ? 'Make the code' : 'Save changes' }),
        h('button', { type: 'button', class: 'btn btn--ghost', text: 'Cancel', onclick: () => { editing = null; paint(); } })));
    paintKind();
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const el = f.elements;
      const p = {
        code: isNew ? el.code.value.replace(/\s/g, '').toUpperCase() : c.code, kind: el.kind.value, value: el.value.value,
        maxOff: el.kind.value === 'percent' ? el.maxOff.value : '', minTotal: el.minTotal.value, startsOn: el.startsOn.value, endsOn: el.endsOn.value,
        maxUses: el.maxUses.value, note: el.note.value.trim(), active: el.active.checked,
      };
      if (!/^[A-Z0-9]{3,20}$/.test(p.code)) return toast('The code needs 3 to 20 letters or numbers, with no spaces.', 'err');
      if (isNew && rows.some((x) => x.code === p.code)) return toast(`${p.code} already exists. Change that one instead.`, 'err');
      if (!(Number(p.value) > 0) || (p.kind === 'percent' && Number(p.value) > 90)) return toast(p.kind === 'percent' ? 'Enter a percentage from 1 to 90.' : 'Enter how many rupees to take off.', 'err');
      if (p.startsOn && p.endsOn && p.endsOn < p.startsOn) return toast('The last day is before the start day.', 'err');
      const btn = f.querySelector('button[type=submit]');
      btn.disabled = true;
      await save(p, () => { editing = null; toast(p.active ? `${p.code} saved. It works on the website now.` : `${p.code} saved. It is switched off.`); });
      btn.disabled = false;
    });
    return f;
  };

  const paint = () => {
    body.replaceChildren(...[
      h('div', { class: 'rv-tools' }, h('span', {}), h('button', { type: 'button', class: 'btn btn--gold', text: '+ Make a coupon code', onclick: () => { editing = {}; paint(); } })),
      editing ? form(editing) : null,
      rows.length ? h('div', { class: 'rv-list' }, ...rows.map(card))
        : h('div', { class: 'card empty-state' }, h('span', { class: 'empty-state__icon', 'aria-hidden': 'true', text: '🏷️' }),
          h('p', { text: 'No coupon codes yet.' }),
          h('p', { class: 'muted', text: 'Make a code, give it to customers, and they type it at checkout for money off. The coupon box appears at checkout only while a code is on.' })),
    ].filter(Boolean));
  };

  const load = () => sb.rpc('admin_coupons').then(({ data, error }) => {
    if (error) {
      return body.replaceChildren(h('div', { class: 'card' }, h('p', { class: 'form-msg', text: `Could not load coupons: ${explain(error)}` }),
        h('p', { class: 'muted', text: 'If this is new, run database/migrations/019_coupons.sql in the Supabase SQL editor.' })));
    }
    rows = data || [];
    paint();
  });
  load();

  return h('div', {},
    h('div', { class: 'sec-head' }, h('div', {}, h('h1', { text: 'Coupons' }),
      h('p', { class: 'muted', text: 'Codes customers type at checkout for money off. A code works as soon as you save it and stops as soon as you switch it off.' }))),
    body);
}
