const { parseMaybeJson } = require("./parsing");

const normalizeComparable = (value) => {
  if (value === undefined || value === null) return "";
  return String(value).trim().toLowerCase();
};

const addPrimitiveValue = (values, value) => {
  if (value === undefined || value === null) return;
  const normalized = normalizeComparable(value);
  if (normalized && normalized !== "[object object]") {
    values.add(normalized);
  }
};

const addLocalizedValue = (values, value) => {
  if (value === undefined || value === null) return;
  if (typeof value !== "object") {
    addPrimitiveValue(values, value);
    return;
  }

  addPrimitiveValue(values, value.uz);
  addPrimitiveValue(values, value.ru);
  addPrimitiveValue(values, value.en);
};

const addValue = (values, value) => {
  if (value === undefined || value === null) return;

  if (Array.isArray(value)) {
    value.forEach((item) => addValue(values, item));
    return;
  }

  if (typeof value === "object") {
    addPrimitiveValue(values, value._id);
    addPrimitiveValue(values, value.id);
    addPrimitiveValue(values, value.slug);
    addPrimitiveValue(values, value.value);
    addPrimitiveValue(values, value.label);
    addLocalizedValue(values, value.name);
    addLocalizedValue(values, value.title);
    return;
  }

  addPrimitiveValue(values, value);
};

const getIdentifierValues = (value) => {
  const values = new Set();
  addValue(values, parseMaybeJson(value, ""));
  return values;
};

const findSubgenreByIdentifier = (subgenres = [], identifier) => {
  const selectedValues = getIdentifierValues(identifier);
  if (!selectedValues.size) return null;

  return subgenres.find((subgenre) => {
    const subgenreValues = getIdentifierValues(subgenre);
    return [...selectedValues].some((value) => subgenreValues.has(value));
  }) || null;
};

const resolveCategoryId = (payload = {}) => {
  const category = parseMaybeJson(payload.category ?? payload.categoryId, "");

  if (category && typeof category === "object") {
    return category._id ?? category.id ?? category.value ?? null;
  }

  return category || null;
};

const resolveSubCategoryId = (payload = {}) => {
  const subCategory = parseMaybeJson(
    payload.subCategoryId ?? payload.subgenreId ?? payload.subgenre,
    "",
  );

  if (subCategory && typeof subCategory === "object") {
    return (
      subCategory._id ??
      subCategory.id ??
      subCategory.slug ??
      subCategory.value ??
      subCategory.label ??
      subCategory.name ??
      subCategory.title ??
      subCategory
    );
  }

  return subCategory || null;
};

module.exports = {
  findSubgenreByIdentifier,
  resolveCategoryId,
  resolveSubCategoryId,
};
