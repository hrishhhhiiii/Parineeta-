// Phase 3: order-by date, promo banners and the homepage rows.
import { describe, it, expect, beforeEach } from 'vitest';
import { PRODUCTS } from '../src/data/products.js';
import { stockLine, shortDate, todayIso } from '../src/data/pricing.js';
import { activeBanners, bannerTarget, railItems, recentProducts } from '../src/ui/home.js';

const p = { id: 'x', leadDays: 7 };
const made = { status: 'made', few: false };

describe('order-by date (wedding − days to make − delivery days)', () => {
  it('in good time: says the order-by date', () => {
    expect(stockLine(p, made, '2026-11-20', '2026-10-07', 2).text).toBe('Order by 11 Nov for your 20 Nov wedding.');
  });
  it('on the order-by day itself: still in time', () => {
    expect(stockLine(p, made, '2026-11-20', '2026-11-11', 2).tone).toBe('made');
  });
  it('a day later: tight, ask on WhatsApp', () => {
    const l = stockLine(p, made, '2026-11-20', '2026-11-12', 2);
    expect(l).toMatchObject({ tone: 'tight', text: 'Tight for 20 Nov: ask us on WhatsApp.' });
  });
  it('ready now: in time for the date', () => {
    expect(stockLine(p, { status: 'ready', few: true }, '2026-11-20', '2026-11-19').text).toBe('Ready now, in time for 20 Nov. Only a few left.');
  });
  it('no date, or a date already passed: the usual line and a prompt to add a date', () => {
    expect(stockLine(p, made, '', '2026-10-07')).toMatchObject({ text: 'Made to order in about 7 days.', prompt: true });
    expect(stockLine(p, made, '2026-10-01', '2026-10-07').prompt).toBe(true);
  });
  it('sold out stays sold out', () => {
    expect(stockLine(p, { status: 'out', few: false }, '2026-11-20', '2026-10-07').text).toBe('Sold out');
  });
  it('counts across months, years and leap days', () => {
    expect(stockLine(p, made, '2027-01-05', '2026-12-01', 2).text).toBe('Order by 27 Dec for your 5 Jan wedding.');
    expect(stockLine(p, made, '2028-03-05', '2028-02-01', 2).text).toBe('Order by 25 Feb for your 5 Mar wedding.');
    expect(stockLine({ leadDays: 5 }, made, '2028-03-01', '2028-02-01', 0).text).toBe('Order by 25 Feb for your 1 Mar wedding.'); // 2028 has a 29 Feb
    expect(shortDate('2026-11-20')).toBe('20 Nov');
  });
  it('today is the date in India', () => {
    expect(todayIso(new Date('2026-10-07T20:00:00Z'))).toBe('2026-10-08'); // 01:30 IST next day
  });
});

describe('promo banners', () => {
  const base = { photo: 'mukut-noir', title: 'Puja collection', linkType: 'product', linkProduct: 'topor' };
  it('show only inside their dates (both days included)', () => {
    const list = [{ ...base, start: '2026-10-07', end: '2026-10-07' }, { ...base, start: '2026-10-08' }, { ...base, end: '2026-10-06' }];
    expect(activeBanners(list, '2026-10-07')).toHaveLength(1);
  });
  it('hide when hidden, without a picture, or when their target is gone', () => {
    expect(activeBanners([{ ...base, hidden: true }, { ...base, photo: '' }, { ...base, linkProduct: 'no-such-thing' }], '2026-10-07')).toHaveLength(0);
  });
  it('web links must be https (never javascript: or http:)', () => {
    expect(bannerTarget({ linkType: 'url', linkUrl: 'https://example.com/sale' })).toMatchObject({ kind: 'url' });
    expect(bannerTarget({ linkType: 'url', linkUrl: 'javascript:alert(1)' })).toBe(null);
    expect(bannerTarget({ linkType: 'url', linkUrl: 'http://example.com' })).toBe(null);
  });
  it('categories and searches open the collection', () => {
    expect(bannerTarget({ linkType: 'category', linkCategory: 'crown' })).toMatchObject({ kind: 'category', cat: 'crown' });
    expect(bannerTarget({ linkType: 'search', linkSearch: ' topor ' })).toMatchObject({ kind: 'search', q: 'topor', href: '/?q=topor#collection' });
    expect(bannerTarget({ linkType: 'category', linkCategory: 'nope' })).toBe(null);
  });
});

describe('homepage rows', () => {
  beforeEach(() => PRODUCTS.forEach((x) => { delete x.featured; }));
  it('a row needs at least 2 products', () => {
    PRODUCTS[0].featured = true;
    expect(railItems('featured')).toEqual([]);
    PRODUCTS[1].featured = true;
    expect(railItems('featured').map((x) => x.id)).toEqual([PRODUCTS[0].id, PRODUCTS[1].id]);
  });
  it('recently viewed skips pieces no longer on the site, newest first', () => {
    expect(recentProducts(['kunke', 'gone', 'topor']).map((x) => x.id)).toEqual(['kunke', 'topor']);
    expect(railItems('recent', PRODUCTS, ['kunke'])).toEqual([]);
  });
});
