// Self-contained product artwork: gradients plus a simple glyph, rendered as an SVG data URI.
// Photos can be stored as "art:<hue>:<glyph>:<variant>" so nothing needs to be downloaded.

const S = 'fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"';
const F = 'fill="#fff" fill-opacity=".92"';

const GLYPHS = {
  audio: `<path ${S} d="M52 118v-18a48 48 0 0 1 96 0v18"/><rect ${F} x="40" y="112" width="24" height="42" rx="10"/><rect ${F} x="136" y="112" width="24" height="42" rx="10"/>`,
  watch: `<rect ${F} x="80" y="30" width="40" height="30" rx="6" opacity=".6"/><rect ${F} x="80" y="140" width="40" height="30" rx="6" opacity=".6"/><rect ${S} x="64" y="58" width="72" height="84" rx="18"/><path ${S} d="M100 80v22l14 8"/>`,
  speaker: `<rect ${S} x="62" y="38" width="76" height="124" rx="18"/><circle ${F} cx="100" cy="72" r="9"/><circle ${S} cx="100" cy="124" r="22"/>`,
  camera: `<rect ${S} x="38" y="68" width="124" height="82" rx="14"/><circle ${S} cx="100" cy="109" r="24"/><path ${S} d="M72 68l8-14h40l8 14"/>`,
  keyboard: `<rect ${S} x="28" y="70" width="144" height="70" rx="12"/><path ${S} d="M52 92h8M76 92h8M100 92h8M124 92h8M148 92h0M60 118h80"/>`,
  shirt: `<path ${S} d="M72 44l-34 22 16 26 18-10v68h56V82l18 10 16-26-34-22c-6 12-16 18-28 18s-22-6-28-18z"/>`,
  shoe: `<path ${S} d="M36 134V96c26 2 40-8 50-26l14 12c14 12 34 20 62 26 10 2 14 8 14 16v10z"/><path ${S} d="M36 134h140"/>`,
  bag: `<rect ${S} x="48" y="76" width="104" height="84" rx="14"/><path ${S} d="M76 76a24 24 0 0 1 48 0"/>`,
  cup: `<path ${S} d="M54 70h78v46a30 30 0 0 1-30 30h-18a30 30 0 0 1-30-30z"/><path ${S} d="M132 86h10a16 16 0 0 1 0 32h-10"/>`,
  book: `<rect ${S} x="54" y="38" width="94" height="124" rx="10"/><path ${S} d="M76 38v124M92 72h40M92 92h28"/>`,
  bottle: `<rect ${S} x="86" y="30" width="28" height="22" rx="6"/><rect ${S} x="68" y="52" width="64" height="120" rx="22"/><path ${S} d="M68 100h64"/>`,
  lamp: `<path ${S} d="M64 84l12-46h48l12 46z"/><path ${S} d="M100 84v66M70 156h60"/>`,
  box: `<path ${S} d="M100 36l56 28v68l-56 28-56-28V64z"/><path ${S} d="M44 64l56 28 56-28M100 92v68"/>`,
  leaf: `<path ${S} d="M52 148C48 92 88 52 150 50c2 62-34 102-90 100z"/><path ${S} d="M52 148l56-56"/>`,
  paw: `<ellipse ${F} cx="100" cy="124" rx="30" ry="24"/><ellipse ${F} cx="58" cy="94" rx="11" ry="15"/><ellipse ${F} cx="86" cy="68" rx="11" ry="15"/><ellipse ${F} cx="114" cy="68" rx="11" ry="15"/><ellipse ${F} cx="142" cy="94" rx="11" ry="15"/>`,
  dumbbell: `<path ${S} d="M70 100h60"/><rect ${F} x="46" y="72" width="18" height="56" rx="6"/><rect ${F} x="136" y="72" width="18" height="56" rx="6"/><rect ${F} x="30" y="84" width="12" height="32" rx="5"/><rect ${F} x="158" y="84" width="12" height="32" rx="5"/>`,
  chair: `<path ${S} d="M70 40h60l4 62H66z"/><path ${S} d="M60 102h80M80 102v60M120 102v60"/>`,
  toy: `<rect ${F} x="52" y="96" width="44" height="44" rx="6"/><rect ${F} x="104" y="96" width="44" height="44" rx="6" opacity=".7"/><rect ${F} x="78" y="50" width="44" height="44" rx="6" opacity=".85"/>`,
  sparkle: `<path ${F} d="M100 36l12 40 40 12-40 12-12 40-12-40-40-12 40-12z"/><circle ${F} cx="150" cy="52" r="8"/><circle ${F} cx="52" cy="148" r="6"/>`,
};

export const GLYPH_NAMES = Object.keys(GLYPHS);

const hash = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

// variant 0..3 changes the background composition so a gallery shows distinct images
const backdrop = (v, id) => {
  switch (v % 4) {
    case 1:
      return `<circle cx="168" cy="40" r="90" fill="#fff" fill-opacity=".14"/><circle cx="20" cy="190" r="70" fill="#000" fill-opacity=".12"/>`;
    case 2:
      return `<path d="M0 150Q60 110 120 140T240 120V240H0z" fill="#000" fill-opacity=".14"/><circle cx="40" cy="40" r="30" fill="#fff" fill-opacity=".16"/>`;
    case 3:
      return `<rect width="240" height="240" fill="url(#p${id})"/>`;
    default:
      return `<circle cx="100" cy="100" r="82" fill="#fff" fill-opacity=".14"/>`;
  }
};

export const artSvg = (hue = 220, glyph = 'box', variant = 0) => {
  const h2 = (hue + 38) % 360;
  const id = `${hue}${variant}`;
  const angle = [135, 200, 60, 160][variant % 4];
  const g = GLYPHS[glyph] || GLYPHS.box;
  const scale = variant % 2 ? 0.92 : 1;
  const shift = variant % 2 ? 8 : 0;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice">` +
    `<defs><linearGradient id="g${id}" gradientTransform="rotate(${angle} .5 .5)"><stop offset="0" stop-color="hsl(${hue} 70% 46%)"/><stop offset="1" stop-color="hsl(${h2} 72% 34%)"/></linearGradient>` +
    `<pattern id="p${id}" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="14" fill="#fff" fill-opacity=".08"/></pattern></defs>` +
    `<rect width="200" height="200" fill="url(#g${id})"/>` +
    backdrop(variant, id) +
    `<g transform="translate(${shift} ${shift / 2}) scale(${scale})">${g}</g></svg>`
  );
};

export const svgUri = (svg) => `data:image/svg+xml,${encodeURIComponent(svg)}`;

// "art:210:headphones:1" -> data URI
export const artUri = (spec) => {
  const [, hue, glyph, v] = String(spec).split(':');
  return svgUri(artSvg(Number(hue) || 220, glyph, Number(v) || 0));
};

// Stable placeholder when a product has no usable photo (or its photo fails to load)
export const fallbackArt = (name = 'product') => {
  const h = hash(String(name));
  return svgUri(artSvg(h % 360, GLYPH_NAMES[h % GLYPH_NAMES.length], h % 4));
};

export const makeArt = (hue, glyph, variant = 0) => `art:${hue}:${glyph}:${variant}`;
