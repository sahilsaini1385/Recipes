/** Helpers for rendering people's names consistently across the site. */

/** The first usable word of a name, ignoring quoted nicknames. */
export function firstName(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/^["'“”‘’()]+|["'“”‘’()]+$/g, ""));
  return words.find(Boolean) ?? name.trim();
}

// Suffixes that shouldn't count as a surname for monogram purposes.
const NAME_SUFFIXES = new Set(["sr", "jr", "ii", "iii", "iv", "v"]);

/**
 * First name + surname initials. Quoted nicknames ('Rajinder "Tony"
 * Saini' -> RS), parentheticals, and suffixes (Sr/Jr/III) are skipped, and
 * middle names don't steal the second slot ('Jack Bahal Saini' -> JS).
 */
export function initials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((w) => !/^["“”'‘’(]/.test(w))
    .filter((w) => /[\p{L}\p{N}]/u.test(w))
    .filter((w) => !NAME_SUFFIXES.has(w.toLowerCase().replace(/\./g, "")));
  const picked = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  return picked
    .map((w) => (w.match(/[\p{L}\p{N}]/u) ?? [""])[0].toUpperCase())
    .join("");
}
