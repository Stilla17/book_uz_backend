const User = require('../../models/User');
const Product = require('../../models/Product');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const apiResponse = require('../../utils/apiResponse');

const WISHLIST_PRODUCT_SELECT = 'title price discountPrice images ratingAvg slug author publisher stock';

const normalizeWishlistProductIds = (wishlist = []) => {
  const source = Array.isArray(wishlist) ? wishlist : [];

  return [...new Set(source
    .map((item) => {
      if (item && typeof item === 'object') {
        return item.productId || item.product || item._id || item.id;
      }

      return item;
    })
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => id.toString()))];
};

const populateWishlist = (query) =>
  query.populate({
    path: 'wishlist',
    select: WISHLIST_PRODUCT_SELECT,
    populate: [
      { path: 'author' },
      { path: 'publisher' },
    ],
  });

/**
 * 1. Profil ma'lumotlarini olish (Get Profile)
 */

const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('-password -refreshToken');
    apiResponse(res, 200, true, "Profil ma'lumotlari", user);
  } catch (error) { next(error); }
};

/**
 * 2. Profilni yangilash (Update Profile)
 * Ism, telefon yoki avatarni o'zgartirish
 */

const updateProfile = async (req, res, next) => {
  try {
    const { name } = req.body;
    const user = await User.findById(req.user._id);

    const updateData = {};
    if (name) updateData.name = name;

    if (req.file) {
      // 1. Agar eski rasm bo'lsa, uni Cloudinary'dan o'chirib tashlaymiz
      if (user.avatar) {
        const oldPublicId = getPublicId(user.avatar);
        await cloudinary.uploader.destroy(oldPublicId).catch(e => console.log("Eski rasm o'chirilmadi:", e));
      }
      updateData.avatar = req.file.path;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id, 
      { $set: updateData }, 
      { new: true }
    ).select('-password -refreshToken');

    apiResponse(res, 200, true, "Profil yangilandi", updatedUser);
  } catch (error) { next(error); }
};

/**
 * 3. Parolni yangilash (Update Password)
 */

const updatePassword = async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return apiResponse(res, 400, false, "Eski parol noto'g'ri");
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    apiResponse(res, 200, true, "Parol yangilandi");
  } catch (error) { next(error); }
};

/**
 * 4. Wishlistni boshqarish (Toggle Wishlist)
 */

const toggleWishlist = async (req, res, next) => {
  try {
    const { productId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return apiResponse(res, 400, false, "productId noto'g'ri");
    }

    const product = await Product.findById(productId).select('_id');
    if (!product) {
      return apiResponse(res, 404, false, "Mahsulot topilmadi");
    }

    const user = await User.findById(req.user._id).select('wishlist');
    const isWishlisted = user.wishlist.some((id) => id.toString() === productId);

    if (isWishlisted) {
      user.wishlist = user.wishlist.filter((id) => id.toString() !== productId);
    } else {
      user.wishlist.push(productId);
    }

    await user.save();

    const updatedUser = await populateWishlist(User.findById(req.user._id).select('wishlist'));

    apiResponse(
      res,
      200,
      true,
      isWishlisted ? "Saralanganlardan o'chirildi" : "Saralanganlarga qo'shildi",
      {
        action: isWishlisted ? 'removed' : 'added',
        wishlist: updatedUser.wishlist,
      },
    );
  } catch (error) { next(error); }
};

const mergeWishlist = async (req, res, next) => {
  try {
    const productIds = normalizeWishlistProductIds(
      req.body.productIds || req.body.wishlistProductIds || req.body.wishlist,
    );

    if (!productIds.length) {
      const user = await populateWishlist(User.findById(req.user._id).select('wishlist'));
      return apiResponse(res, 200, true, "Saralanganlar birlashtirildi", user.wishlist);
    }

    const existingProductIds = await Product.find({ _id: { $in: productIds } }).distinct('_id');

    const user = await populateWishlist(User.findByIdAndUpdate(
      req.user._id,
      { $addToSet: { wishlist: { $each: existingProductIds } } },
      { new: true },
    ).select('wishlist'));

    apiResponse(res, 200, true, "Saralanganlar birlashtirildi", user.wishlist);
  } catch (error) { next(error); }
};

/**
 * 5. Wishlistdagi kitoblarni to'liq ma'lumoti bilan olish
 */

const getWishlistDetails = async (req, res, next) => {
  try {
    const user = await populateWishlist(User.findById(req.user._id).select('wishlist'));
    apiResponse(res, 200, true, "Saralangan kitoblar", user.wishlist);
  } catch (error) { next(error); }
};

/**
 * 6. Manzillarni boshqarish (Add Address)
 */

const addAddress = async (req, res, next) => {
  try {
    const { city, region, street, isDefault } = req.body;
    const user = await User.findById(req.user._id);

    if (isDefault) {
      user.addresses.forEach(addr => addr.isDefault = false);
    }

    user.addresses.push({ city, region, street, isDefault });
    await user.save();
    apiResponse(res, 200, true, "Manzil qo'shildi", user.addresses);
  } catch (error) { next(error); }
};

/**
 * 7. Manzilni o'chirish (Delete Address)
 */

const deleteAddress = async (req, res, next) => {
  try {
    const { addressId } = req.params;
    const user = await User.findById(req.user._id);
    
    user.addresses = user.addresses.filter(addr => addr._id.toString() !== addressId);
    await user.save();
    
    apiResponse(res, 200, true, "Manzil o'chirildi", user.addresses);
  } catch (error) { next(error); }
};

/**
 * 8. Foydalanuvchi manzillarini olish (Get Addresses)
 */

const getAddresses = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('addresses');
    apiResponse(res, 200, true, "Manzillar ro'yxati", user.addresses);
  } catch (error) { 
    next(error); 
  }
};

const updateNotificationSettings = async (req, res, next) => {
  try {
    const { email, sms, telegram, push } = req.body;
    
    const user = await User.findById(req.user._id);
    
    user.notifications = {
      email: email !== undefined ? email : user.notifications?.email,
      sms: sms !== undefined ? sms : user.notifications?.sms,
      telegram: telegram !== undefined ? telegram : user.notifications?.telegram,
      push: push !== undefined ? push : user.notifications?.push
    };
    
    await user.save();
    
    apiResponse(res, 200, true, "Xabarnoma sozlamalari yangilandi", user.notifications);
  } catch (error) { next(error); }
};

/**
 * 10. Xabarnoma sozlamalarini olish (Get Notification Settings)
 */

const getNotificationSettings = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('notifications');
    
    const defaultNotifications = {
      email: true,
      sms: false,
      telegram: true,
      push: true
    };
    
    apiResponse(res, 200, true, "Xabarnoma sozlamalari", user.notifications || defaultNotifications);
  } catch (error) { next(error); }
};

/**
 * 11. Xavfsizlik sozlamalarini yangilash (Update Security Settings)
 */

const updateSecuritySettings = async (req, res, next) => {
  try {
    const { twoFactorAuth, loginAlerts, deviceHistory } = req.body;
    
    const user = await User.findById(req.user._id);
    
    user.security = {
      twoFactorAuth: twoFactorAuth !== undefined ? twoFactorAuth : user.security?.twoFactorAuth,
      loginAlerts: loginAlerts !== undefined ? loginAlerts : user.security?.loginAlerts,
      deviceHistory: deviceHistory !== undefined ? deviceHistory : user.security?.deviceHistory
    };
    
    await user.save();
    
    apiResponse(res, 200, true, "Xavfsizlik sozlamalari yangilandi", user.security);
  } catch (error) { next(error); }
};

/**
 * 12. Xavfsizlik sozlamalarini olish (Get Security Settings)
 */

const getSecuritySettings = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('security');
    

    const defaultSecurity = {
      twoFactorAuth: false,
      loginAlerts: true,
      deviceHistory: false
    };
    
    apiResponse(res, 200, true, "Xavfsizlik sozlamalari", user.security || defaultSecurity);
  } catch (error) { next(error); }
};

/**
 * 13. Til va mintaqa sozlamalarini yangilash (Update Language & Region)
 */

const updateLanguageRegion = async (req, res, next) => {
  try {
    const { language, currency } = req.body;
    
    const user = await User.findById(req.user._id);
    
    user.preferences = {
      ...user.preferences,
      language: language || user.preferences?.language || 'uz',
      currency: currency || user.preferences?.currency || 'UZS'
    };
    
    await user.save();
    
    apiResponse(res, 200, true, "Til va mintaqa sozlamalari yangilandi", user.preferences);
  } catch (error) { next(error); }
};

/**
 * 14. Til va mintaqa sozlamalarini olish (Get Language & Region)
 */

const getLanguageRegion = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('preferences');
    
    const defaultPreferences = {
      language: 'uz',
      currency: 'UZS'
    };
    
    apiResponse(res, 200, true, "Til va mintaqa sozlamalari", user.preferences || defaultPreferences);
  } catch (error) { next(error); }
};

/**
 * 15. Faol qurilmalarni olish (Get Active Devices)
 */

const getActiveDevices = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('devices');

    apiResponse(res, 200, true, "Faol qurilmalar", user.devices || []);
  } catch (error) { next(error); }
};

/**
 * 16. Qurilmani o'chirish (Remove Device)
 */

const removeDevice = async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    
    const user = await User.findById(req.user._id);
    
    if (!user.devices) {
      user.devices = [];
    }
    
    user.devices = user.devices.filter(device => device._id.toString() !== deviceId);
    await user.save();
    
    apiResponse(res, 200, true, "Qurilma o'chirildi", user.devices);
  } catch (error) { next(error); }
};

/**
 * 17. Hisobni o'chirish (Delete Account)
 */

const deleteAccount = async (req, res, next) => {
  try {
    const { password } = req.body;
    
    const user = await User.findById(req.user._id);
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return apiResponse(res, 400, false, "Parol noto'g'ri");
    }
    
    await User.findByIdAndDelete(req.user._id);
    
    apiResponse(res, 200, true, "Hisob o'chirildi");
  } catch (error) { next(error); }
};



module.exports = { 
  getProfile, 
  updateProfile, 
  updatePassword, 
  toggleWishlist, 
  mergeWishlist,
  getWishlistDetails,
  addAddress,
  deleteAddress,
  getAddresses,
   updateNotificationSettings,
  getNotificationSettings,
  updateSecuritySettings,
  getSecuritySettings,
  updateLanguageRegion,
  getLanguageRegion,
  getActiveDevices,
  removeDevice,
  deleteAccount
};
