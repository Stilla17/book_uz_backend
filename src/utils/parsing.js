const isBlank = (value) => value === undefined || value === null || value === "";

const parseMaybeJson = (
  value,
  fallback = undefined,
  { returnOriginalOnError = true } = {},
) => {
  if (isBlank(value)) return fallback;
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch (error) {
    return returnOriginalOnError ? value : fallback;
  }
};

const parseBoolean = (value, fallback = false) => {
  if (value === undefined) return fallback;
  return value === true || value === "true";
};

module.exports = {
  parseMaybeJson,
  parseBoolean,
};
