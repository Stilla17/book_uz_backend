const getPaginationParams = (query = {}, defaults = {}) => {
  const defaultPage = defaults.page || 1;
  const defaultLimit = defaults.limit || 10;
  const maxLimit = defaults.maxLimit;

  const page = Math.max(Number(query.page) || defaultPage, 1);
  const requestedLimit = Math.max(Number(query.limit) || defaultLimit, 1);
  const limit = maxLimit ? Math.min(requestedLimit, maxLimit) : requestedLimit;
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

const buildPagination = ({ page, limit, total }) => ({
  page,
  limit,
  total,
  pages: Math.ceil(total / limit),
});

module.exports = {
  getPaginationParams,
  buildPagination,
};
