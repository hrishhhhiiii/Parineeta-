// Rupee amounts as customers see them (₹1,450). Shared by the page code and the message builders.
const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
export const inr = (n) => INR.format(Math.round(n));
