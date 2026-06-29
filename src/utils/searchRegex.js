const APOSTROPHE_CHARS = "'`’‘ʻʼ´";
const APOSTROPHE_PATTERN = `[${APOSTROPHE_CHARS.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}]?`;

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeSearchText = (value) => {
  if (Array.isArray(value)) return normalizeSearchText(value[0]);
  if (value === undefined || value === null) return "";
  return String(value).trim();
};

const stripApostrophes = (value) =>
  String(value || "").replace(new RegExp(`[${escapeRegex(APOSTROPHE_CHARS)}]`, "g"), "");

const normalizeApostrophes = (value) =>
  String(value || "").replace(new RegExp(`[${escapeRegex(APOSTROPHE_CHARS)}]`, "g"), "'");

const latinToCyrillic = (value) => {
  let text = normalizeApostrophes(value).toLowerCase();

  const digraphs = [
    ["o'", "ў"],
    ["g'", "ғ"],
    ["sh", "ш"],
    ["ch", "ч"],
    ["yo", "ё"],
    ["yu", "ю"],
    ["ya", "я"],
    ["ye", "е"],
    ["ts", "ц"],
  ];

  for (const [latin, cyrillic] of digraphs) {
    text = text.replaceAll(latin, cyrillic);
  }

  const letters = {
    a: "а",
    b: "б",
    d: "д",
    e: "е",
    f: "ф",
    g: "г",
    h: "ҳ",
    i: "и",
    j: "ж",
    k: "к",
    l: "л",
    m: "м",
    n: "н",
    o: "о",
    p: "п",
    q: "қ",
    r: "р",
    s: "с",
    t: "т",
    u: "у",
    v: "в",
    x: "х",
    y: "й",
    z: "з",
  };

  return text.replace(/[a-z]/g, (char) => letters[char] || char);
};

const cyrillicToLatin = (value) => {
  const letters = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    ғ: "g'",
    д: "d",
    е: "e",
    ё: "yo",
    ж: "j",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    қ: "q",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ў: "o'",
    ф: "f",
    х: "x",
    ҳ: "h",
    ц: "ts",
    ч: "ch",
    ш: "sh",
    щ: "sh",
    ъ: "",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
  };

  return String(value || "")
    .toLowerCase()
    .replace(/[а-яёғқҳў]/giu, (char) => letters[char.toLowerCase()] ?? char);
};

const buildLooseLatinPattern = (value) => {
  const text = stripApostrophes(cyrillicToLatin(value)).toLowerCase();
  let pattern = "";

  for (const char of text) {
    if (char === "g" || char === "o") {
      pattern += `${escapeRegex(char)}${APOSTROPHE_PATTERN}`;
    } else {
      pattern += escapeRegex(char);
    }
  }

  return pattern;
};

const buildLooseCyrillicPattern = (value) => {
  const text = stripApostrophes(cyrillicToLatin(value)).toLowerCase();
  const tokens = [];

  for (let index = 0; index < text.length; index += 1) {
    const rest = text.slice(index);

    if (rest.startsWith("sh")) {
      tokens.push("[шщ]");
      index += 1;
      continue;
    }
    if (rest.startsWith("ch")) {
      tokens.push("ч");
      index += 1;
      continue;
    }
    if (rest.startsWith("yo")) {
      tokens.push("ё");
      index += 1;
      continue;
    }
    if (rest.startsWith("yu")) {
      tokens.push("ю");
      index += 1;
      continue;
    }
    if (rest.startsWith("ya")) {
      tokens.push("я");
      index += 1;
      continue;
    }
    if (rest.startsWith("ye")) {
      tokens.push("е");
      index += 1;
      continue;
    }
    if (rest.startsWith("ts")) {
      tokens.push("ц");
      index += 1;
      continue;
    }

    const char = text[index];
    const letters = {
      a: "а",
      b: "б",
      d: "д",
      e: "[еэ]",
      f: "ф",
      g: "[гғ]",
      h: "[ҳх]",
      i: "и",
      j: "ж",
      k: "к",
      l: "л",
      m: "м",
      n: "н",
      o: "[оў]",
      p: "п",
      q: "қ",
      r: "р",
      s: "с",
      t: "т",
      u: "у",
      v: "в",
      x: "х",
      y: "й",
      z: "з",
    };

    tokens.push(letters[char] || escapeRegex(char));
  }

  return tokens.join("");
};

const buildSearchPattern = (value, { exact = false } = {}) => {
  const text = normalizeSearchText(value);
  if (!text) return "";

  const latinVariant = cyrillicToLatin(text);
  const cyrillicVariant = latinToCyrillic(latinVariant);
  const variants = [
    escapeRegex(text),
    escapeRegex(cyrillicVariant),
    escapeRegex(latinVariant),
    escapeRegex(stripApostrophes(latinVariant)),
    buildLooseLatinPattern(text),
    buildLooseCyrillicPattern(text),
  ].filter(Boolean);

  const uniquePatterns = [...new Set(variants)];
  const pattern = uniquePatterns.length === 1
    ? uniquePatterns[0]
    : `(?:${uniquePatterns.join("|")})`;

  return exact ? `^${pattern}$` : pattern;
};

const buildSearchRegex = (value, options = {}) => ({
  $regex: buildSearchPattern(value, options),
  $options: "i",
});

module.exports = {
  buildSearchPattern,
  buildSearchRegex,
  escapeRegex,
  normalizeSearchText,
};
