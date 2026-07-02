const Cart = require('../../models/Cart');
const Product = require('../../models/Product');
const apiResponse = require('../../utils/apiResponse');
const { applyActiveDiscountsToProducts, getEffectiveProductPrice } = require('../../utils/productDiscounts');

const populateCartProducts = (query) =>
  query.populate({
    path: 'items.product',
    select: 'title price discountPrice images stock slug format author publisher',
    populate: [
      { path: 'author' },
      { path: 'publisher' },
    ],
  });

const withDiscountedCart = async (cart) => {
  if (!cart) return cart;

  const cartObject = typeof cart.toObject === 'function' ? cart.toObject() : { ...cart };
  const products = cartObject.items
    .map((item) => item.product)
    .filter((product) => product && typeof product === 'object');
  const discountedProducts = await applyActiveDiscountsToProducts(products);
  const productById = new Map(
    discountedProducts.map((product) => [product._id?.toString(), product]),
  );

  cartObject.items = cartObject.items.map((item) => {
    const productId = item.product?._id?.toString();
    const product = productById.get(productId) || item.product;
    const price = product?.discountPrice > 0 ? product.discountPrice : product?.price || item.price;

    return {
      ...item,
      product,
      price,
    };
  });
  cartObject.totalPrice = cartObject.items.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );

  return cartObject;
};

// 1. Savatni ko'rish (Get Cart)

exports.getCart = async (req, res, next) => {
  try {
    const cart = await populateCartProducts(Cart.findOne({ user: req.user.id }));
    
    if (!cart) return apiResponse(res, 200, true, "Savat bo'sh", { items: [], totalPrice: 0 });

    apiResponse(res, 200, true, "Savat ma'lumotlari", await withDiscountedCart(cart));
  } catch (error) { next(error); }
};

// 2. Savatga qo'shish yoki miqdorini yangilash

exports.addToCart = async (req, res, next) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const userId = req.user.id;

    const product = await Product.findById(productId);
    if (!product) return apiResponse(res, 404, false, "Mahsulot topilmadi");
    if (product.stock < quantity) return apiResponse(res, 400, false, "Omborda yetarli mahsulot yo'q");

    let cart = await Cart.findOne({ user: userId });

    const effectivePrice = await getEffectiveProductPrice(product);

    if (!cart) {
      cart = await Cart.create({
        user: userId,
        items: [{ product: productId, quantity, price: effectivePrice }],
        totalPrice: effectivePrice * quantity
      });
    } else {
      const itemIndex = cart.items.findIndex(p => p.product.toString() === productId);
      
      if (itemIndex > -1) {
        cart.items[itemIndex].quantity += quantity;
        cart.items[itemIndex].price = effectivePrice;
      } else {
        cart.items.push({ product: productId, quantity, price: effectivePrice });
      }

      cart.totalPrice = cart.items.reduce((total, item) => total + (item.quantity * item.price), 0);
      await cart.save();
    }

    const populatedCart = await populateCartProducts(Cart.findById(cart._id));

    apiResponse(res, 200, true, "Savat yangilandi", await withDiscountedCart(populatedCart));
  } catch (error) { next(error); }
};

// 3. Mahsulot miqdorini o'zgartirish (Update Quantity)

exports.updateCartItem = async (req, res, next) => {
  try {
    const { productId, quantity } = req.body;
    
    let cart = await Cart.findOne({ user: req.user.id });
    

    if (!cart) {
      return apiResponse(res, 404, false, "Savat topilmadi");
    }

    const itemIndex = cart.items.findIndex(p => p.product.toString() === productId);
    
    if (itemIndex > -1) {
      cart.items[itemIndex].quantity = quantity;
      cart.totalPrice = cart.items.reduce((total, item) => total + (item.quantity * item.price), 0);
      await cart.save();

      const populatedCart = await populateCartProducts(Cart.findById(cart._id));
      
      return apiResponse(res, 200, true, "Miqdor yangilandi", await withDiscountedCart(populatedCart));
    }
    
    apiResponse(res, 404, false, "Mahsulot savatda topilmadi");
  } catch (error) { 
    next(error); 
  }
};

// 4. Savatdan bitta mahsulotni o'chirish

exports.removeFromCart = async (req, res, next) => {
  try {
    const { productId } = req.params;
    let cart = await Cart.findOne({ user: req.user.id });

    if (!cart) {
      return apiResponse(res, 404, false, "Savat topilmadi");
    }

    cart.items = cart.items.filter(item => item.product.toString() !== productId);
    cart.totalPrice = cart.items.reduce((total, item) => total + (item.quantity * item.price), 0);
    await cart.save();

    const populatedCart = await populateCartProducts(Cart.findById(cart._id));

    apiResponse(res, 200, true, "Mahsulot savatdan olib tashlandi", await withDiscountedCart(populatedCart));
  } catch (error) { next(error); }
};

exports.clearCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });
    
    if (!cart) {
      return apiResponse(res, 404, false, "Savat topilmadi");
    }
    
    await Cart.findOneAndDelete({ user: req.user.id });
    apiResponse(res, 200, true, "Savat tozalandi");
  } catch (error) { next(error); }
};
