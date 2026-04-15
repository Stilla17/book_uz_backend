const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  console.error(err);

  if (err.name === 'CastError') {
    error.message = 'Resurs topilmadi';
    res.status(404);
  }

  if (err.code === 11000) {
    error.message = 'Bunday ma’lumot bazada mavjud';
    res.status(400);
  }

  res.status(res.statusCode === 200 ? 500 : res.statusCode).json({
    success: false,
    message: error.message || 'Server xatosi',
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};

module.exports = { errorHandler };