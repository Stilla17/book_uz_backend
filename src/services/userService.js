const User = require('../models/User');

class UserService {
  async toggleWishlist(userId, productId) {
    const user = await User.findById(userId);
    
    const isAdded = user.wishlist.includes(productId);

    if (isAdded) {
      user.wishlist = user.wishlist.filter(id => id.toString() !== productId);
    } else {
      user.wishlist.push(productId);
    }

    await user.save();
    return { 
      wishlist: user.wishlist, 
      action: isAdded ? 'removed' : 'added' 
    };
  }

  /**
   * Foydalanuvchining barcha sevimlilarini olish
   */
  
  async getWishlist(userId) {
    const user = await User.findById(userId).populate('wishlist');
    return user.wishlist;
  }
}

module.exports = new UserService();