import { Link, useNavigate } from 'react-router-dom';
import { FaHeart, FaRegHeart } from 'react-icons/fa';
import { Img, Reveal, Stars } from './Common';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useUI } from '../context/UIContext';
import { discountPct, money } from '../lib/format';

const ProductCard = ({ p, index = 0, list = false }) => {
  const { add, setOpen } = useCart();
  const { ids, toggle } = useWishlist();
  const { toast } = useUI();
  const navigate = useNavigate();
  const wished = ids.includes(p._id);
  const off = discountPct(p);
  const out = p.quantity <= 0;
  const hasVariants = p.variants?.length > 0;

  const quickAdd = () => {
    if (hasVariants) return navigate(`/product/${p.slug}`);
    add(p, 1, '');
    toast.success(`${p.name} added to cart`);
    setOpen(true);
  };
  const wish = async () => {
    if (!(await toggle(p._id))) {
      toast('Sign in to save items to your wishlist');
      navigate('/login', { state: { from: '/wishlist' } });
    }
  };

  return (
    <Reveal as="article" delay={(index % 4) * 70} className="pcard">
      <button className="wish" aria-pressed={wished} aria-label={wished ? `Remove ${p.name} from wishlist` : `Save ${p.name} to wishlist`} onClick={wish}>
        {wished ? <FaHeart /> : <FaRegHeart />}
      </button>
      <Link to={`/product/${p.slug}`} className="media" aria-label={p.name}>
        <Img photo={p.photo} name={p.name} />
        <span className="tags">
          {off > 0 && <span className="pill sale">-{off}%</span>}
          {out ? <span className="pill">Sold out</span> : p.quantity <= 10 && <span className="pill warn">Only {p.quantity} left</span>}
        </span>
      </Link>
      <div className="body">
        {p.category?.name && <span className="cat">{p.category.name}</span>}
        <Link to={`/product/${p.slug}`} className="name">{p.name}</Link>
        <span className="row small muted" style={{ gap: 6 }}>
          <Stars value={p.rating} /> {p.numReviews > 0 ? `(${p.numReviews})` : 'No reviews'}
        </span>
        {list && <p className="muted small">{p.description.slice(0, 160)}</p>}
        <div className="foot">
          <span className="price">{money(p.price)}{off > 0 && <s>{money(p.compareAtPrice)}</s>}</span>
          <button className="btn sm primary" disabled={out} onClick={quickAdd}>{out ? 'Sold out' : hasVariants ? 'Options' : 'Add'}</button>
        </div>
      </div>
    </Reveal>
  );
};

export default ProductCard;
