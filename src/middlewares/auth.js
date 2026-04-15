const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  // 1. Authorization headerdan token olish (accessToken)

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
    console.log('Token from Authorization header');
  }

  if (!token) {
    console.log('No token found');
    return res.status(401).json({ 
      success: false, 
      message: 'Token topilmadi, login qiling!' 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    console.log('Decoded token:', decoded);

    // Foydalanuvchini bazadan topish
    req.user = await User.findById(decoded.id).select('-password');
    
    if (!req.user) {
      console.log('User not found');
      return res.status(401).json({ 
        success: false, 
        message: 'Foydalanuvchi topilmadi' 
      });
    }

    console.log('User authenticated:', req.user.email);
    next();
  } catch (error) {
    console.log('Token verification error:', error.message);
    return res.status(401).json({ 
      success: false, 
      message: 'Avtorizatsiyadan otdi, token xato!' 
    });
  }
};

const restrictTo = (...roles) => {
  return (req, res, next) => {
    const userRole = String(req.user.role || '').toLowerCase();
    const allowed = roles.map(r => String(r).toLowerCase());

    if (!allowed.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "Sizda bu amalni bajarish uchun ruxsat yo'q"
      });
    }

    next();
  };
};

module.exports = { protect, restrictTo };