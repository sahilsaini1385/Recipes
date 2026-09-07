/**
 * Pluralising an ingredient's name when a recipe is scaled up.
 *
 * Scaling "1 lemon" by three used to print "3 lemon". Only the unit was ever
 * inflected, and an ingredient counted without a unit has no unit to inflect.
 *
 * This is a whitelist for the same reason inflectUnit is. The family's
 * collection contains "garlic", "flour", "lime juice", "blue food gel",
 * "kraft cheez links garlic flavor" and "cauliflower head or 3 large
 * zucchinis or 2-3 stalks of broccoli". A rules-based pluraliser turns those
 * into garlics, flours, lime juices and broccolis. Printing "3 lemon" is a
 * small blemish; printing "3 garlics" is a wrong ingredient list, so the
 * default when unsure is always to leave the words alone.
 */

/** Countable things a recipe numbers without a unit. Singular -> plural. */
const ITEM_PLURALS: Record<string, string> = {
  // produce
  onion: "onions",
  shallot: "shallots",
  lemon: "lemons",
  lime: "limes",
  orange: "oranges",
  apple: "apples",
  banana: "bananas",
  pear: "pears",
  peach: "peaches",
  plum: "plums",
  avocado: "avocados",
  tomato: "tomatoes",
  potato: "potatoes",
  carrot: "carrots",
  cucumber: "cucumbers",
  mushroom: "mushrooms",
  pepper: "peppers",
  turnip: "turnips",
  parsnip: "parsnips",
  beet: "beets",
  radish: "radishes",
  eggplant: "eggplants",
  cabbage: "cabbages",
  pineapple: "pineapples",
  melon: "melons",
  chile: "chiles",
  chilli: "chillies",
  rib: "ribs",
  jalapeno: "jalapenos",
  "jalapeño": "jalapeños",
  zucchini: "zucchinis",
  scallion: "scallions",
  leek: "leeks",
  clove: "cloves",
  stalk: "stalks",
  sprig: "sprigs",
  leaf: "leaves",
  head: "heads",
  ear: "ears",
  // protein and dairy
  egg: "eggs",
  yolk: "yolks",
  white: "whites",
  breast: "breasts",
  thigh: "thighs",
  chicken: "chickens",
  fillet: "fillets",
  scallop: "scallops",
  shrimp: "shrimp",
  // baked and packaged countables
  tortilla: "tortillas",
  bun: "buns",
  roll: "rolls",
  cake: "cakes",
  biscuit: "biscuits",
  cracker: "crackers",
  cookie: "cookies",
  muffin: "muffins",
  pancake: "pancakes",
  waffle: "waffles",
  bagel: "bagels",
  pie: "pies",
  sausage: "sausages",
  patty: "patties",
  chop: "chops",
  cutlet: "cutlets",
  drumstick: "drumsticks",
  wing: "wings",
  teabag: "teabags",
  slice: "slices",
  strip: "strips",
  wedge: "wedges",
  half: "halves",
  loaf: "loaves",
};

/** The plural forms, so an item that already reads plural is left alone. */
const ALREADY_PLURAL = new Set(Object.values(ITEM_PLURALS));

/**
 * A phrase offering alternatives is not something to inflect one word inside
 * of: "hen or chicken breasts", "yellow or white onion", "cauliflower head OR
 * 3 large zucchinis OR 2-3 stalks of broccoli".
 */
const ALTERNATIVES_RE = /\bor\b| with /i;

function capitalizeLike(source: string, replacement: string): string {
  if (!source || source[0] !== source[0].toUpperCase()) return replacement;
  if (source[0] === source[0].toLowerCase()) return replacement; // no case
  return replacement[0].toUpperCase() + replacement.slice(1);
}

/**
 * "lemon" at 3 -> "lemons"; "bay leaf" -> "bay leaves"; "green stalk of green
 * onion" -> "green stalks of green onion". Anything not recognised, already
 * plural, or part of a compound phrase comes back untouched.
 */
export function pluralizeItem(item: string, amount: number): string {
  if (!item || !isFinite(amount) || amount <= 1) return item;

  // A comma usually introduces preparation, not another ingredient --
  // "medium onion, finely chopped". Inflect the name and keep the rest as
  // written. When the part before the comma is itself a list or a phrase of
  // alternatives ("ham bone, hock, or leftover ham pieces") the head is
  // "ham bone", which no rule below recognises, so it stays untouched.
  const comma = item.indexOf(",");
  if (comma > 0) {
    const name = item.slice(0, comma);
    const rest = item.slice(comma);
    const inflected = pluralizeItem(name, amount);
    return inflected === name ? item : inflected + rest;
  }

  if (ALTERNATIVES_RE.test(item)) return item;

  // In "stalks of celery" the thing being counted is the stalk, not the
  // celery, so inflect the word before "of" rather than the final word.
  const ofMatch = item.match(/^(.*?)(\s+of\s+.*)$/i);
  const head = ofMatch ? ofMatch[1] : item;
  const tail = ofMatch ? ofMatch[2] : "";

  const words = head.split(/(\s+)/); // keeps the separators
  let lastIdx = -1;
  for (let i = words.length - 1; i >= 0; i--) {
    if (words[i].trim()) {
      lastIdx = i;
      break;
    }
  }
  if (lastIdx === -1) return item;

  const word = words[lastIdx];
  const bare = word.toLowerCase().replace(/[^\p{L}]+$/u, "");
  const trailing = word.slice(bare.length);

  if (ALREADY_PLURAL.has(bare)) return item;
  const plural = ITEM_PLURALS[bare];
  if (!plural) return item;

  words[lastIdx] = capitalizeLike(word, plural) + trailing;
  return words.join("") + tail;
}
