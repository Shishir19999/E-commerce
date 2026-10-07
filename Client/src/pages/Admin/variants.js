// "Color: Black, White | Size: S, M" -> [{ name, options }]
export const parseVariants = (text) =>
  text.split('|').map((g) => g.trim()).filter(Boolean).map((g) => {
    const [name, opts = ''] = g.split(':');
    return { name: name.trim(), options: opts.split(',').map((o) => o.trim()).filter(Boolean) };
  });
