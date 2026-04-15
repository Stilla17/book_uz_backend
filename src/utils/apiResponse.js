const apiResponse = (res, statusCode, success, message, data = null, meta = null) => {
  const response = {
    success,
    message,
    timestamp: new Date().toISOString()
  };

  if (data !== null) response.data = data;
  if (meta !== null) response.meta = meta; 

  return res.status(statusCode).json(response);
};

module.exports = apiResponse;