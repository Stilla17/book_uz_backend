const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  if (err.name === "MulterError") {
    error.statusCode = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    error.message = err.code === "LIMIT_FILE_SIZE"
      ? "Fayl hajmi ruxsat etilgan chegaradan katta"
      : "Yuklangan fayl maydonlari noto'g'ri";
  }

  console.error(err);

  if (err.name === "CastError") {
    error.message = "Resurs topilmadi";
    res.status(404);
  }

  if (err.code === 11000) {
    error.message = "Bunday ma'lumot bazada mavjud";
    res.status(400);
  }

  if (err.name === "ValidationError") {
    error.message = Object.values(err.errors)
      .map((validationError) => validationError.message)
      .join(", ");
    res.status(400);
  }

  if (error.statusCode) {
    res.status(error.statusCode);
  }

  res.status(res.statusCode === 200 ? 500 : res.statusCode).json({
    success: false,
    message: error.message || "Server xatosi",
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
};

module.exports = { errorHandler };
