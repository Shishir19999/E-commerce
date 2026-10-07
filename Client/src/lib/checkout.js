// Pure form helpers for the checkout steps (unit tested).

export const formatCard = (v) => String(v).replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim();

const luhn = (digits) => {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
};

export const validateAddress = (a) => {
  const e = {};
  if (a.name.trim().length < 2) e.name = 'Enter your full name';
  if (a.phone.replace(/\D/g, '').length < 7) e.phone = 'Enter a phone number with at least 7 digits';
  if (a.street.trim().length < 3) e.street = 'Enter your street address';
  if (a.city.trim().length < 2) e.city = 'Enter your city';
  if (a.zip.trim().length < 3) e.zip = 'Enter your postal code';
  return e;
};

export const validateCard = (c, now = new Date()) => {
  const e = {};
  const digits = c.number.replace(/\D/g, '');
  if (c.holder.trim().length < 2) e.holder = 'Enter the name on the card';
  if (digits.length < 13 || digits.length > 19 || !luhn(digits)) e.number = 'Enter a valid card number (try 4242 4242 4242 4242)';
  const m = /^(\d{2})\/(\d{2})$/.exec(c.exp.trim());
  if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) e.exp = 'Use the format MM/YY';
  else if (2000 + Number(m[2]) < now.getFullYear() || (2000 + Number(m[2]) === now.getFullYear() && Number(m[1]) < now.getMonth() + 1)) e.exp = 'This card has expired';
  if (!/^\d{3,4}$/.test(c.cvc)) e.cvc = 'Enter the 3 or 4 digit code';
  return e;
};
