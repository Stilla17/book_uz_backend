const getCategoryName = (category = {}) => {
  if (category.title?.uz) return category.title.uz;
  if (typeof category.name === "string") return category.name;
  return category.name?.uz || "";
};

const getSubgenreName = (subgenre) => {
  if (!subgenre) return "";
  if (subgenre.title?.uz) return subgenre.title.uz;
  if (typeof subgenre.name === "string") return subgenre.name;
  if (typeof subgenre === "string") return subgenre;
  return subgenre.name?.uz || "";
};

const getIdString = (value) => {
  if (!value) return "";
  if (value._id) return value._id.toString();
  return value.toString();
};

const getCategorySubgenres = (category = {}) => {
  if (Array.isArray(category.subgenres) && category.subgenres.length) {
    return category.subgenres;
  }

  if (!Array.isArray(category.subcategories)) {
    return [];
  }

  return category.subcategories.map((subcategory, index) => ({
    _id: category.subcategoryIds?.[index] || subcategory,
    name: getSubgenreName(subcategory),
    order: index,
    isActive: true,
  }));
};

module.exports = {
  getCategoryName,
  getSubgenreName,
  getIdString,
  getCategorySubgenres,
};
