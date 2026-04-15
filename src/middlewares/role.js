const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: `Sizda bu amalni bajarish uchun huquq yo'q: ${req.user.role}` 
      });
    }
    next();
  };
};

module.exports = { authorize };