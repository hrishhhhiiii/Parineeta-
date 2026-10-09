// Which products the product builder's grid shows next to the active one. Pure: no DOM, tested in
// tests/builder.test.js.
import { PRODUCTS, CATEGORIES, parentOf, inCategory } from './products.js';

const MAX = 12;
const label = (id) => CATEGORIES.find((c) => c.id === id)?.label || '';

/**
 * The grid for product p: the active product first, then its own category (sub-category), then the
 * rest of its parent category, then the rest of the collection to fill the grid. Admin order is kept
 * within each group.
 * @returns {{ items: object[], family: number, title: string }}
 *   items  – at most 12 products, p first
 *   family – how many of them belong to p's category family (the rest are "more from the collection")
 *   title  – the heading for the family part, e.g. "Biyer Piri" or "Wedding rituals"
 */
export function builderProducts(p, list = PRODUCTS) {
  const shown = list.filter((x) => x && x.id && !x.hidden);
  const top = parentOf(p.category) || p.category;
  const same = shown.filter((x) => x.id !== p.id && x.category === p.category);
  const kin = shown.filter((x) => x.id !== p.id && x.category !== p.category && p.category && inCategory(x, top));
  const family = [p, ...same, ...kin].slice(0, MAX);
  const rest = shown.filter((x) => !family.includes(x) && x.id !== p.id);
  const items = [...family, ...rest].slice(0, MAX);
  return { items, family: family.length, title: label(p.category) || label(top) };
}

/** The line a card's quick Add to cart / Buy now uses: first colourway, first choice in each group. */
export function defaultLine(p, firstPick) {
  return { id: p.id, style: p.styles[0], pick: firstPick(p), custom: '', qty: 1 };
}
