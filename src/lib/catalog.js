export const CATALOG = Object.freeze({
  "vela-cumaru-120": {
    id: "vela-cumaru-120",
    name: "Vela Aromática",
    fragrance: "Cumaru & Sândalo",
    format: "Vela aromática",
    size: "130g",
    price: 69.99,
    initialStock: 10,
    shipping: { weightKg: 0.33, widthCm: 10, heightCm: 10, lengthCm: 10 },
  },
  "vela-sakura-120": {
    id: "vela-sakura-120",
    name: "Vela Aromática",
    fragrance: "Árvore de Sakura & Musk",
    format: "Vela aromática",
    size: "130g",
    price: 69.99,
    initialStock: 10,
    shipping: { weightKg: 0.33, widthCm: 10, heightCm: 10, lengthCm: 10 },
  },
  "home-cumaru-250": {
    id: "home-cumaru-250",
    name: "Home Parfum",
    fragrance: "Cumaru & Sândalo",
    format: "Home Parfum",
    size: "250ml",
    price: 39.99,
    initialStock: 10,
    shipping: { weightKg: 0.3, widthCm: 8, heightCm: 5, lengthCm: 21.5 },
  },
  "home-sakura-250": {
    id: "home-sakura-250",
    name: "Home Parfum",
    fragrance: "Árvore de Sakura & Musk",
    format: "Home Parfum",
    size: "250ml",
    price: 39.99,
    initialStock: 10,
    shipping: { weightKg: 0.3, widthCm: 8, heightCm: 5, lengthCm: 21.5 },
  },
  "wax-cumaru-60": {
    id: "wax-cumaru-60",
    name: "Wax Melts",
    fragrance: "Cumaru & Sândalo",
    format: "Wax Melts",
    size: "80g",
    price: 39.99,
    initialStock: 10,
    shipping: { weightKg: 0.1, widthCm: 10, heightCm: 5, lengthCm: 10 },
  },
  "wax-sakura-60": {
    id: "wax-sakura-60",
    name: "Wax Melts",
    fragrance: "Árvore de Sakura & Musk",
    format: "Wax Melts",
    size: "80g",
    price: 39.99,
    initialStock: 10,
    shipping: { weightKg: 0.1, widthCm: 10, heightCm: 5, lengthCm: 10 },
  },
});
export const catalogArray = () => Object.values(CATALOG);
export function validateItems(items = []) {
  if (!Array.isArray(items) || !items.length)
    throw new Error("Sua sacola está vazia.");
  if (items.length > 60) throw new Error("Quantidade inválida.");
  const grouped = new Map();
  for (const item of items) {
    if (!item || !Object.hasOwn(CATALOG, item.id))
      throw new Error("Produto inválido.");
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1)
      throw new Error("Quantidade inválida.");
    grouped.set(item.id, (grouped.get(item.id) || 0) + quantity);
  }
  items = [...grouped].map(([id, quantity]) => ({ id, quantity }));
  let subtotal = 0;
  const normalized = items.map((item) => {
    const product = CATALOG[item.id];
    if (!product) throw new Error(`Produto inválido: ${item.id}`);
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10)
      throw new Error("Quantidade inválida.");
    subtotal += product.price * quantity;
    return { ...product, quantity };
  });
  return { items: normalized, subtotal: Math.round(subtotal * 100) / 100 };
}
