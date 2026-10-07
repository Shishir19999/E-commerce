import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { CartSummary, CouponBox } from '../components/CartParts';
import { Img, State } from '../components/Common';
import API, { DEMO, errMsg } from '../api/client';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { SHIPPING_METHODS, shippingCost } from '../lib/pricing';
import { money } from '../lib/format';
import { formatCard, validateAddress, validateCard } from '../lib/checkout';

const STEPS = ['Address', 'Shipping', 'Payment'];

const Checkout = () => {
  const { items, subtotal, discount, coupon, clear } = useCart();
  const { user } = useAuth();
  const { toast } = useUI();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [addr, setAddr] = useState({ name: user?.name || '', phone: user?.phone || '', street: user?.address || '', city: '', zip: '' });
  const [method, setMethod] = useState('standard');
  const [card, setCard] = useState({ number: '', exp: '', cvc: '', holder: user?.name || '' });
  const [errs, setErrs] = useState({});
  const [mode, setMode] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    API.get('/api/v1/payments/config').then((r) => setMode(r.data.mode)).catch(() => setMode('mock'));
  }, []);

  if (items.length === 0)
    return <Layout title="Checkout"><div className="container page"><State icon="🛒" title="Your cart is empty" action={<Link to="/shop" className="btn primary">Start shopping</Link>} /></div></Layout>;

  const shipping = shippingCost(method, Math.max(0, subtotal - discount));
  const stripe = mode === 'stripe' && !DEMO;

  const next = () => {
    const e = step === 0 ? validateAddress(addr) : step === 2 && !stripe ? validateCard(card) : {};
    setErrs(e);
    if (Object.keys(e).length === 0) setStep(step + 1);
  };

  const place = async () => {
    const e = stripe ? {} : validateCard(card);
    setErrs(e);
    if (Object.keys(e).length) return setStep(2);
    setBusy(true);
    try {
      const res = await API.post('/api/v1/payments/checkout', {
        items: items.map((i) => ({ product: i.product, quantity: i.quantity, variant: i.variant || '' })),
        shippingAddress: `${addr.name}, ${addr.street}, ${addr.city} ${addr.zip}, Tel ${addr.phone}`,
        shippingMethod: method,
        couponCode: coupon?.code || '',
      });
      if (res.data.mode === 'stripe') {
        window.location.assign(res.data.url); // hosted Stripe Checkout; the cart is cleared on the success page
        return;
      }
      clear();
      toast.success('Order placed. Thank you!');
      navigate(`/orders/${res.data.order._id}`, { state: { placed: true } });
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const f = (obj, set, k, label, props = {}) => (
    <div className="field">
      <label htmlFor={`f-${k}`}>{label}</label>
      <input id={`f-${k}`} className="input" value={obj[k]} aria-invalid={Boolean(errs[k])} aria-describedby={errs[k] ? `f-${k}-e` : undefined} onChange={(e) => set({ ...obj, [k]: props.format ? props.format(e.target.value) : e.target.value })} {...props.input} />
      {errs[k] && <span className="err" id={`f-${k}-e`} role="alert">{errs[k]}</span>}
    </div>
  );

  return (
    <Layout title="Checkout">
      <div className="container page">
        <h1 style={{ fontSize: '1.9rem' }}>Checkout</h1>
        <ol className="steps" aria-label="Checkout progress">
          {[...STEPS, 'Review'].map((s, i) => <li key={s} className={i === step ? 'cur' : i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined}>{i < step ? '✓' : i + 1}. {s}</li>)}
        </ol>
        <div className="layout2">
          <div className="card">
            {step === 0 && (
              <form onSubmit={(e) => { e.preventDefault(); next(); }} noValidate>
                <h2>Delivery address</h2>
                <div className="grid2">{f(addr, setAddr, 'name', 'Full name', { input: { autoComplete: 'name' } })}{f(addr, setAddr, 'phone', 'Phone', { input: { autoComplete: 'tel' } })}</div>
                {f(addr, setAddr, 'street', 'Street address', { input: { autoComplete: 'street-address' } })}
                <div className="grid2">{f(addr, setAddr, 'city', 'City', { input: { autoComplete: 'address-level2' } })}{f(addr, setAddr, 'zip', 'Postal code', { input: { autoComplete: 'postal-code' } })}</div>
                <button className="btn primary">Continue to shipping</button>
              </form>
            )}
            {step === 1 && (
              <div>
                <h2>Shipping method</h2>
                {Object.values(SHIPPING_METHODS).map((m) => {
                  const c = shippingCost(m.id, Math.max(0, subtotal - discount));
                  return (
                    <label key={m.id} className="radio-card">
                      <input type="radio" name="ship" checked={method === m.id} onChange={() => setMethod(m.id)} />
                      <span className="grow"><b>{m.label}</b><br /><span className="muted small">{m.eta}</span></span>
                      <b>{c ? money(c) : 'Free'}</b>
                    </label>
                  );
                })}
                <div className="row"><button className="btn" onClick={() => setStep(0)}>Back</button><button className="btn primary" onClick={next}>Continue to payment</button></div>
              </div>
            )}
            {step === 2 && (
              <form onSubmit={(e) => { e.preventDefault(); next(); }} noValidate>
                <h2>Payment</h2>
                {stripe ? (
                  <p><span className="pill info">Stripe test mode</span> You will be redirected to Stripe Checkout. Use test card 4242 4242 4242 4242. No real money is charged.</p>
                ) : (
                  <>
                    <p><span className="pill warn">Mock payment</span> No real payment is taken. Enter any card-shaped numbers, for example 4242 4242 4242 4242, 12/34, 123. Nothing is stored or sent.</p>
                    {f(card, setCard, 'holder', 'Name on card', { input: { autoComplete: 'off' } })}
                    {f(card, setCard, 'number', 'Card number', { format: formatCard, input: { inputMode: 'numeric', placeholder: '4242 4242 4242 4242', autoComplete: 'off', maxLength: 23 } })}
                    <div className="grid2">
                      {f(card, setCard, 'exp', 'Expiry (MM/YY)', { input: { placeholder: '12/34', autoComplete: 'off', maxLength: 5 } })}
                      {f(card, setCard, 'cvc', 'CVC', { input: { inputMode: 'numeric', placeholder: '123', autoComplete: 'off', maxLength: 4 } })}
                    </div>
                  </>
                )}
                <div className="row"><button type="button" className="btn" onClick={() => setStep(1)}>Back</button><button className="btn primary">Review order</button></div>
              </form>
            )}
            {step === 3 && (
              <div className="stack">
                <h2>Review and place order</h2>
                <div className="grid2">
                  <div><h3>Deliver to</h3><p className="muted">{addr.name}<br />{addr.street}<br />{addr.city} {addr.zip}<br />{addr.phone}</p><button className="btn sm" onClick={() => setStep(0)}>Edit</button></div>
                  <div><h3>Shipping</h3><p className="muted">{SHIPPING_METHODS[method].label}, {SHIPPING_METHODS[method].eta}</p><button className="btn sm" onClick={() => setStep(1)}>Edit</button></div>
                </div>
                <p className="muted small">{stripe ? 'You will pay on Stripe (test mode).' : `Mock payment with card ending ${card.number.replace(/\D/g, '').slice(-4)}.`}</p>
                <div className="row"><button className="btn" onClick={() => setStep(2)}>Back</button><button className="btn primary" disabled={busy || !mode} onClick={place}>{busy ? 'Placing order…' : stripe ? 'Pay with Stripe' : `Place order (${money(Math.max(0, subtotal - discount) + shipping)})`}</button></div>
              </div>
            )}
          </div>
          <aside className="card stack" aria-label="Order summary">
            <h3>Summary</h3>
            {items.map((i) => (
              <div className="row" key={`${i.product}|${i.variant}`} style={{ flexWrap: 'nowrap' }}>
                <div style={{ width: 44, height: 44, flex: '0 0 44px' }}><Img photo={i.photo} name="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover' }} /></div>
                <span className="grow small">{i.name}{i.variant && <span className="muted"> ({i.variant})</span>} &times; {i.quantity}</span><b className="small">{money(i.price * i.quantity)}</b>
              </div>
            ))}
            <CouponBox />
            <CartSummary shipping={shipping} showShipping />
          </aside>
        </div>
      </div>
    </Layout>
  );
};

export default Checkout;
