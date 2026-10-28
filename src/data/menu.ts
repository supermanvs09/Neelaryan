/**
 * NEELARYAN menu — transcribed from the supplied menu PDF (source of truth for
 * product names and prices). Do not change prices here without an updated menu.
 *
 * Flags such as `bestseller` / `isNew` and availability are admin-managed
 * merchandising data; the defaults below are only a starting point.
 */

export type Diet = "veg" | "egg" | "nonveg";

export type Tag = "bestseller" | "new" | "healthy" | "protein" | "spicy" | "recommended";

export type Availability = "available" | "sold_out" | "unavailable";

/** Visual family used by the illustrated food art. */
export type ArtKind =
  | "tea"
  | "coffee"
  | "soda"
  | "iced"
  | "chaat"
  | "eggs"
  | "omelette"
  | "sandwich"
  | "wrap"
  | "rice"
  | "oats"
  | "shake"
  | "icecream";

/** Which customizer opens for an item. */
export type CustomizerKind =
  | "oats-builder"
  | "shake-builder"
  | "tea"
  | "coffee"
  | "soda"
  | "cold"
  | "spice"
  | "notes";

export type CategoryId =
  | "tea-coffee"
  | "soda"
  | "iced-coffee"
  | "snacks"
  | "chat-phata"
  | "eggs"
  | "sandwiches"
  | "wraps"
  | "rice-bowls"
  | "oats-bowls"
  | "shakes"
  | "desserts";

export interface Category {
  id: CategoryId;
  name: string;
  short: string;
  blurb?: string;
  art: ArtKind;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: CategoryId;
  diet: Diet;
  tags: Tag[];
  art: ArtKind;
  /** Primary & secondary tints for the illustration (liquid, filling…). */
  tint: [string, string];
  customizer: CustomizerKind;
  description: string;
  availability: Availability;
}

export const CATEGORIES: Category[] = [
  {
    id: "tea-coffee",
    name: "Tea, Coffee & Refreshments",
    short: "Tea & Coffee",
    blurb: "Everyday favourites · Start your visit with something refreshing",
    art: "coffee",
  },
  {
    id: "soda",
    name: "Soda Bar & Coolers",
    short: "Soda Bar",
    blurb: "Customise your soda with sweet, salted or masala flavours",
    art: "soda",
  },
  { id: "iced-coffee", name: "Iced Coffee & Chocolate Drinks", short: "Iced Coffee", art: "iced" },
  { id: "snacks", name: "Snacks & Chaat", short: "Snacks & Chaat", art: "chaat" },
  {
    id: "chat-phata",
    name: "Chat Phata",
    short: "Chat Phata",
    blurb: "Crunchy Kurkure chaat with fresh vegetables and bold flavours",
    art: "chaat",
  },
  { id: "eggs", name: "Eggs & Omelettes", short: "Eggs", art: "omelette" },
  { id: "sandwiches", name: "Sandwiches", short: "Sandwiches", art: "sandwich" },
  { id: "wraps", name: "Wraps", short: "Wraps", art: "wrap" },
  { id: "rice-bowls", name: "Rice Bowls", short: "Rice Bowls", blurb: "Filling meal bowls", art: "rice" },
  {
    id: "oats-bowls",
    name: "Oats Bowls",
    short: "Oats Bowls",
    blurb: "Wholesome bowls with fruits, nuts, seeds and protein options",
    art: "oats",
  },
  {
    id: "shakes",
    name: "Protein Shakes & Milkshakes",
    short: "Shakes",
    blurb: "Add an ice cream scoop to any eligible milkshake for ₹30 extra.",
    art: "shake",
  },
  { id: "desserts", name: "Ice Creams & Signature Desserts", short: "Desserts", art: "icecream" },
];

type Seed = Omit<MenuItem, "id" | "category" | "availability" | "tags" | "diet" | "description"> & {
  tags?: Tag[];
  diet?: Diet;
  description: string;
};

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

function build(category: CategoryId, seeds: Seed[]): MenuItem[] {
  return seeds.map((s) => ({
    ...s,
    id: slug(s.name),
    category,
    diet: s.diet ?? "veg",
    tags: s.tags ?? [],
    availability: "available",
  }));
}

const tea = (name: string, price: number, tint: [string, string], description: string, tags?: Tag[]): Seed => ({
  name,
  price,
  art: "tea",
  tint,
  customizer: "tea",
  description,
  tags,
});

export const MENU: MenuItem[] = [
  ...build("tea-coffee", [
    tea("Classic Tea", 20, ["#c98f5a", "#e9cfa8"], "Freshly brewed milk tea, the everyday favourite."),
    tea("Ginger Tea", 20, ["#c48a50", "#ecd2a6"], "Milk tea brewed with fresh ginger."),
    tea("Elaichi Tea", 20, ["#c9935e", "#eed7b0"], "Milk tea scented with cardamom."),
    tea("Mint Tea", 20, ["#b98e57", "#dfe6c2"], "Milk tea with a fresh mint lift."),
    tea("Black Tea", 20, ["#7a3e1d", "#b0602c"], "Light, clear black tea without milk."),
    tea("Green Tea", 30, ["#a9b65a", "#d9e0a2"], "A gentle cup of green tea.", ["healthy"]),
    { name: "Ragi Java", price: 40, art: "coffee", tint: ["#8a5a3c", "#d2b49a"], customizer: "coffee", description: "A warm, malty finger-millet drink.", tags: ["healthy"] },
    { name: "Classic Hot Coffee", price: 40, art: "coffee", tint: ["#7a4a2b", "#d9b48c"], customizer: "coffee", description: "Hot milk coffee, simple and comforting." },
    { name: "Espresso - Double Shot", price: 69, art: "coffee", tint: ["#3e2112", "#7a4a2b"], customizer: "notes", description: "Two shots of espresso, served short." },
    { name: "Cappuccino", price: 89, art: "coffee", tint: ["#8c5a36", "#f0e2cc"], customizer: "coffee", description: "Espresso with steamed milk and foam.", tags: ["recommended"] },
    { name: "Café Latte", price: 99, art: "coffee", tint: ["#a6754c", "#f2e6d2"], customizer: "coffee", description: "Espresso with silky steamed milk." },
    { name: "Café Mocha", price: 109, art: "coffee", tint: ["#5e3420", "#e8d2bc"], customizer: "coffee", description: "Espresso, chocolate and steamed milk." },
  ]),
  ...build("soda", [
    { name: "Salt/Sugar Soda", price: 39, art: "soda", tint: ["#e9f1ee", "#c9e3dc"], customizer: "soda", description: "Chilled soda, sweet or salted — your call." },
    { name: "Masala Soda", price: 49, art: "soda", tint: ["#d9c79a", "#efe3c2"], customizer: "soda", description: "Fizzy soda with a tangy masala kick.", tags: ["spicy"] },
    { name: "Jeera Soda", price: 49, art: "soda", tint: ["#d6c08a", "#efe4c4"], customizer: "soda", description: "Cumin-spiced, refreshing soda." },
    { name: "Lemon Soda", price: 49, art: "soda", tint: ["#efe58a", "#f7f2c4"], customizer: "soda", description: "Fresh lemon with sparkling soda." },
    { name: "Orange Soda", price: 49, art: "soda", tint: ["#f3a640", "#f8d39a"], customizer: "soda", description: "Bright orange flavour over soda." },
    { name: "Mint Soda", price: 49, art: "soda", tint: ["#a8dcb4", "#d9f0de"], customizer: "soda", description: "Cooling mint with sparkling soda." },
    { name: "Rose Soda", price: 59, art: "soda", tint: ["#ef8fa8", "#f8cbd6"], customizer: "soda", description: "Fragrant rose syrup with soda." },
    { name: "Strawberry Soda", price: 59, art: "soda", tint: ["#e8475f", "#f6a3b0"], customizer: "soda", description: "Strawberry flavour with sparkling soda." },
    { name: "Mango Soda", price: 59, art: "soda", tint: ["#f5b335", "#fadb94"], customizer: "soda", description: "Mango flavour with sparkling soda." },
    { name: "Green Apple Soda", price: 69, art: "soda", tint: ["#9ccf4a", "#d4ec9e"], customizer: "soda", description: "Crisp green apple over soda." },
    { name: "Blueberry Soda", price: 69, art: "soda", tint: ["#5a5fc8", "#a9a9ea"], customizer: "soda", description: "Blueberry flavour with sparkling soda." },
    { name: "Lemon Mint Soda", price: 69, art: "soda", tint: ["#c9e48a", "#eaf5c8"], customizer: "soda", description: "Lemon and mint, the classic cooler.", tags: ["recommended"] },
    { name: "Sprite Mint Mojito", price: 79, art: "soda", tint: ["#b5e3c0", "#e4f6e8"], customizer: "cold", description: "Sprite, mint and lime, mojito-style." },
    { name: "Blue Lagoon Mocktail", price: 79, art: "soda", tint: ["#2f8fd8", "#8cc9f0"], customizer: "cold", description: "Our ocean-blue citrus mocktail.", tags: ["bestseller"] },
  ]),
  ...build("iced-coffee", [
    { name: "Classic Cold Coffee", price: 99, art: "iced", tint: ["#a77a52", "#e6d0b4"], customizer: "cold", description: "Chilled, creamy blended coffee.", tags: ["bestseller"] },
    { name: "Iced Latte", price: 109, art: "iced", tint: ["#b48a62", "#efe2cf"], customizer: "cold", description: "Espresso over cold milk and ice." },
    { name: "Chocolate Cold Coffee", price: 119, art: "iced", tint: ["#6e4128", "#d8bba0"], customizer: "cold", description: "Cold coffee blended with chocolate." },
    { name: "Iced Mocha", price: 129, art: "iced", tint: ["#5a321c", "#cfb197"], customizer: "cold", description: "Espresso, chocolate and cold milk over ice." },
  ]),
  ...build("snacks", [
    { name: "Roasted Chana", price: 39, art: "chaat", tint: ["#c48a3e", "#e9cf9a"], customizer: "spice", description: "Crunchy roasted chickpeas.", tags: ["healthy", "protein"] },
    { name: "Black Chana Chaat", price: 59, art: "chaat", tint: ["#5c3a26", "#d8573a"], customizer: "spice", description: "Black chickpeas tossed chaat-style.", tags: ["healthy", "protein"] },
    { name: "Peanut Masala Chaat", price: 59, art: "chaat", tint: ["#b97a3e", "#d8573a"], customizer: "spice", description: "Peanuts tossed with masala and fresh bits.", tags: ["spicy"] },
    { name: "Corn Masala Chaat", price: 69, art: "chaat", tint: ["#f2c437", "#d8573a"], customizer: "spice", description: "Sweet corn tossed with masala.", tags: ["spicy"] },
    { name: "Roasted Chana & Black Chana Salad", price: 69, art: "chaat", tint: ["#8a5a32", "#6fae4a"], customizer: "spice", description: "Two kinds of chana in a fresh salad.", tags: ["healthy", "protein"] },
    { name: "Fresh Vegetable Salad", price: 79, art: "chaat", tint: ["#6fae4a", "#e0503a"], customizer: "notes", description: "A bowl of fresh, crunchy vegetables.", tags: ["healthy"] },
    { name: "Roasted Flavoured Makhana", price: 79, art: "chaat", tint: ["#f3ead8", "#d9a55a"], customizer: "spice", description: "Roasted fox nuts with seasoning.", tags: ["healthy"] },
  ]),
  ...build("chat-phata", [
    { name: "Peri-Peri Chat Phata", price: 59, art: "chaat", tint: ["#e2572e", "#f2b13a"], customizer: "spice", description: "Crunchy Kurkure chaat with peri-peri spice.", tags: ["spicy"] },
    { name: "Crunchy Peanut Chat Phata", price: 69, art: "chaat", tint: ["#d98a2e", "#b97a3e"], customizer: "spice", description: "Kurkure chaat with roasted peanuts.", tags: ["spicy"] },
  ]),
  ...build("eggs", [
    { name: "Boiled Eggs – 2 Pieces", price: 25, art: "eggs", tint: ["#f7f1e3", "#f2b62e"], customizer: "notes", diet: "egg", description: "Two boiled eggs.", tags: ["protein"] },
    { name: "Masala Boiled Eggs – 2 Pieces", price: 35, art: "eggs", tint: ["#f7f1e3", "#d8573a"], customizer: "spice", diet: "egg", description: "Two boiled eggs with masala.", tags: ["protein", "spicy"] },
    { name: "Plain Omelette", price: 40, art: "omelette", tint: ["#f4cf55", "#f8e39a"], customizer: "notes", diet: "egg", description: "A soft, fluffy omelette.", tags: ["protein"] },
    { name: "Onion Omelette", price: 45, art: "omelette", tint: ["#f4cf55", "#b56fa8"], customizer: "spice", diet: "egg", description: "Omelette with onion.", tags: ["protein"] },
    { name: "Masala Omelette", price: 50, art: "omelette", tint: ["#efc04a", "#5aa043"], customizer: "spice", diet: "egg", description: "Omelette with onion, chilli and masala.", tags: ["protein", "spicy"] },
    { name: "Onion & Tomato Omelette", price: 60, art: "omelette", tint: ["#f4cf55", "#e0503a"], customizer: "spice", diet: "egg", description: "Omelette with onion and tomato.", tags: ["protein"] },
  ]),
  ...build("sandwiches", [
    { name: "Vegetable Sandwich", price: 79, art: "sandwich", tint: ["#6fae4a", "#e0503a"], customizer: "notes", description: "Fresh vegetables between toasted bread." },
    { name: "Chocolate Sandwich", price: 79, art: "sandwich", tint: ["#5a321c", "#8a5a3a"], customizer: "notes", description: "A sweet, melty chocolate sandwich." },
    { name: "Egg Sandwich", price: 89, art: "sandwich", tint: ["#f4cf55", "#f7f1e3"], customizer: "notes", diet: "egg", description: "Egg sandwich, filling and simple.", tags: ["protein"] },
    { name: "Paneer Sandwich", price: 109, art: "sandwich", tint: ["#f7efdc", "#e0503a"], customizer: "spice", description: "Paneer sandwich with a light spice.", tags: ["protein"] },
    { name: "Chicken Sandwich", price: 129, art: "sandwich", tint: ["#d9a066", "#6fae4a"], customizer: "spice", diet: "nonveg", description: "Chicken sandwich, hearty and satisfying.", tags: ["protein"] },
  ]),
  ...build("wraps", [
    { name: "Egg Bhurji Wrap", price: 99, art: "wrap", tint: ["#f2c437", "#6fae4a"], customizer: "spice", diet: "egg", description: "Spiced egg bhurji rolled in a wrap.", tags: ["protein"] },
    { name: "Paneer Wrap", price: 119, art: "wrap", tint: ["#f7efdc", "#e0503a"], customizer: "spice", description: "Paneer rolled in a soft wrap.", tags: ["protein"] },
    { name: "Chicken Shawarma-Style Wrap", price: 149, art: "wrap", tint: ["#c98a4e", "#6fae4a"], customizer: "spice", diet: "nonveg", description: "Shawarma-style chicken in a wrap.", tags: ["protein", "bestseller"] },
  ]),
  ...build("rice-bowls", [
    { name: "Egg Rice Bowl", price: 119, art: "rice", tint: ["#f4cf55", "#f7f1e3"], customizer: "spice", diet: "egg", description: "A filling rice bowl with egg.", tags: ["protein"] },
    { name: "Paneer Rice Bowl", price: 149, art: "rice", tint: ["#f7efdc", "#e0503a"], customizer: "spice", description: "A filling rice bowl with paneer.", tags: ["protein"] },
    { name: "Chicken Rice Bowl", price: 169, art: "rice", tint: ["#c98a4e", "#d8573a"], customizer: "spice", diet: "nonveg", description: "A filling rice bowl with chicken.", tags: ["protein"] },
  ]),
  ...build("oats-bowls", [
    { name: "Banana Cinnamon Oats", price: 99, art: "oats", tint: ["#f3e3a1", "#a0652d"], customizer: "oats-builder", description: "Warm oats with banana and cinnamon.", tags: ["healthy"] },
    { name: "Apple Cinnamon Oats", price: 119, art: "oats", tint: ["#d8343a", "#a0652d"], customizer: "oats-builder", description: "Warm oats with apple and cinnamon.", tags: ["healthy"] },
    { name: "Pomegranate Oats", price: 129, art: "oats", tint: ["#c21d3b", "#f3e3a1"], customizer: "oats-builder", description: "Oats topped with ruby pomegranate.", tags: ["healthy"] },
    { name: "Light Dry Fruit Oats", price: 129, art: "oats", tint: ["#b07a45", "#7a3f2a"], customizer: "oats-builder", description: "Oats with a light mix of dry fruits.", tags: ["healthy"] },
    { name: "Banana Peanut Butter Oats", price: 129, art: "oats", tint: ["#f3e3a1", "#a8682c"], customizer: "oats-builder", description: "Creamy oats with banana and peanut butter.", tags: ["bestseller", "protein"] },
    { name: "Banana & Dry Fruit Oats", price: 139, art: "oats", tint: ["#f3e3a1", "#7a3f2a"], customizer: "oats-builder", description: "Oats with banana and dry fruits.", tags: ["healthy"] },
    { name: "Chocolate Peanut Butter Oats", price: 139, art: "oats", tint: ["#4a2616", "#a8682c"], customizer: "oats-builder", description: "Oats with chocolate and peanut butter.", tags: ["recommended"] },
    { name: "Dry Fruit & Seeds Oats", price: 149, art: "oats", tint: ["#7a3f2a", "#4f7a35"], customizer: "oats-builder", description: "Oats with dry fruits and seeds.", tags: ["healthy"] },
    { name: "Plant Protein Oats", price: 169, art: "oats", tint: ["#efe4cc", "#6f9a4a"], customizer: "oats-builder", description: "Oats with a scoop of plant protein.", tags: ["protein", "healthy"] },
    { name: "Whey Protein Oats", price: 179, art: "oats", tint: ["#f4ead6", "#c9a04a"], customizer: "oats-builder", description: "Oats with a scoop of whey protein.", tags: ["protein"] },
  ]),
  ...build("shakes", [
    { name: "Vanilla Milkshake", price: 109, art: "shake", tint: ["#f3e6c4", "#fbf3dc"], customizer: "shake-builder", description: "Classic vanilla, thick and creamy." },
    { name: "Chocolate Milkshake", price: 109, art: "shake", tint: ["#6b3f25", "#a87452"], customizer: "shake-builder", description: "Rich chocolate milkshake." },
    { name: "Peanut Butter & Milkmaid Shake", price: 119, art: "shake", tint: ["#c99a5b", "#e8cfa0"], customizer: "shake-builder", description: "Peanut butter and condensed milk shake." },
    { name: "Banana Smoothie", price: 129, art: "shake", tint: ["#efe0a0", "#f8f0cc"], customizer: "shake-builder", description: "Smooth, naturally sweet banana.", tags: ["healthy"] },
    { name: "Dates Shake", price: 129, art: "shake", tint: ["#9a6a43", "#cfa47e"], customizer: "shake-builder", description: "Dates blended into a creamy shake.", tags: ["healthy"] },
    { name: "Butterscotch Shake", price: 129, art: "shake", tint: ["#d9a556", "#f0d29a"], customizer: "shake-builder", description: "Butterscotch shake with a caramel note." },
    { name: "Cold Coffee & Chocolate Shake", price: 129, art: "shake", tint: ["#7a4a2e", "#b88a66"], customizer: "shake-builder", description: "Coffee and chocolate, blended cold." },
    { name: "Oreo Milkshake", price: 129, art: "shake", tint: ["#b8b0a6", "#efeae2"], customizer: "shake-builder", description: "Cookies-and-cream shake with Oreo.", tags: ["bestseller"] },
    { name: "Kesar Badam Shake", price: 139, art: "shake", tint: ["#f0c56a", "#f8e2a8"], customizer: "shake-builder", description: "Saffron and almond shake." },
    { name: "Chocolate Peanut Butter Shake", price: 149, art: "shake", tint: ["#7d4f2e", "#c99a5b"], customizer: "shake-builder", description: "Chocolate and peanut butter shake.", tags: ["protein"] },
    { name: "KitKat Shake", price: 149, art: "shake", tint: ["#8a5a3a", "#c9302c"], customizer: "shake-builder", description: "Chocolate shake blended with KitKat." },
    { name: "Pista Shake", price: 149, art: "shake", tint: ["#c7d6a0", "#e8efd0"], customizer: "shake-builder", description: "Pistachio shake, lightly nutty." },
    { name: "Banana Plant Protein Shake", price: 169, art: "shake", tint: ["#eadcae", "#9cbf6a"], customizer: "shake-builder", description: "Banana shake with plant protein.", tags: ["protein", "healthy"] },
    { name: "Banana Whey Protein Shake", price: 169, art: "shake", tint: ["#efe2b6", "#c9a04a"], customizer: "shake-builder", description: "Banana shake with whey protein.", tags: ["protein"] },
  ]),
  ...build("desserts", [
    { name: "Vanilla Scoop", price: 49, art: "icecream", tint: ["#f6ecd0", "#fbf5e4"], customizer: "notes", description: "A scoop of vanilla ice cream." },
    { name: "Chocolate Scoop", price: 59, art: "icecream", tint: ["#6b3f25", "#8a5a3a"], customizer: "notes", description: "A scoop of chocolate ice cream." },
    { name: "Butterscotch Scoop", price: 59, art: "icecream", tint: ["#e3b062", "#f2d49a"], customizer: "notes", description: "A scoop of butterscotch ice cream." },
    { name: "Nutty Delight", price: 119, art: "icecream", tint: ["#e9d3a4", "#a0652d"], customizer: "notes", description: "Ice cream loaded with nuts." },
    { name: "Oreo Cookies & Cream", price: 119, art: "icecream", tint: ["#efeae2", "#2b2421"], customizer: "notes", description: "Cookies-and-cream ice cream with Oreo." },
    { name: "Royal Dry Fruit", price: 139, art: "icecream", tint: ["#f2e1b8", "#7a3f2a"], customizer: "notes", description: "Ice cream with a royal dry-fruit mix." },
    { name: "Chocolate Overload", price: 139, art: "icecream", tint: ["#4a2616", "#7a4a2e"], customizer: "notes", description: "Chocolate, chocolate and more chocolate.", tags: ["bestseller"] },
    { name: "Chocolate Hazelnut Delight", price: 149, art: "icecream", tint: ["#5a321c", "#b07a45"], customizer: "notes", description: "Chocolate ice cream with hazelnut." },
    { name: "Vanilla Hazelnut Delight", price: 149, art: "icecream", tint: ["#f3e6c4", "#b07a45"], customizer: "notes", description: "Vanilla ice cream with hazelnut." },
  ]),
];

export const MENU_BY_ID: Record<string, MenuItem> = Object.fromEntries(MENU.map((m) => [m.id, m]));

export const categoryById = (id: CategoryId) => CATEGORIES.find((c) => c.id === id)!;

export const TAG_LABEL: Record<Tag, string> = {
  bestseller: "Bestseller",
  new: "New",
  healthy: "Healthy",
  protein: "Protein rich",
  spicy: "Spicy",
  recommended: "Recommended",
};
