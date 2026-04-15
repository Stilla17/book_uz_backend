// backend/src/controllers/admin/adminSubscriptionController.js
const Subscription = require('../../models/Subscription');
const apiResponse = require('../../utils/apiResponse');


exports.getAllSubscriptions = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, isActive } = req.query;
    
    let query = {};
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const subscriptions = await Subscription.find(query)
      .sort({ order: 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Subscription.countDocuments(query);

    apiResponse(res, 200, true, "Obuna planlari", {
      subscriptions,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};


exports.getSubscription = async (req, res, next) => {
  try {
    const subscription = await Subscription.findById(req.params.id);
    
    if (!subscription) {
      return apiResponse(res, 404, false, "Obuna plani topilmadi");
    }

    apiResponse(res, 200, true, "Obuna plani", subscription);
  } catch (error) {
    next(error);
  }
};


exports.createSubscription = async (req, res, next) => {
  try {
    const { name, description, price, features, limits, trialDays, isPopular, order, icon, color } = req.body;

    const subscription = await Subscription.create({
      name,
      description,
      price,
      features,
      limits,
      trialDays: trialDays || 0,
      isPopular: isPopular || false,
      order: order || 0,
      icon,
      color
    });

    apiResponse(res, 201, true, "Obuna plani yaratildi", subscription);
  } catch (error) {
    next(error);
  }
};


exports.updateSubscription = async (req, res, next) => {
  try {
    const subscription = await Subscription.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    if (!subscription) {
      return apiResponse(res, 404, false, "Obuna plani topilmadi");
    }

    apiResponse(res, 200, true, "Obuna plani yangilandi", subscription);
  } catch (error) {
    next(error);
  }
};


exports.deleteSubscription = async (req, res, next) => {
  try {
    const subscription = await Subscription.findByIdAndDelete(req.params.id);

    if (!subscription) {
      return apiResponse(res, 404, false, "Obuna plani topilmadi");
    }

    apiResponse(res, 200, true, "Obuna plani o'chirildi");
  } catch (error) {
    next(error);
  }
};



exports.toggleSubscriptionStatus = async (req, res, next) => {
  try {
    const subscription = await Subscription.findById(req.params.id);

    if (!subscription) {
      return apiResponse(res, 404, false, "Obuna plani topilmadi");
    }

    subscription.isActive = !subscription.isActive;
    subscription.updatedAt = Date.now();
    await subscription.save();

    apiResponse(res, 200, true, `Obuna plani ${subscription.isActive ? 'faollashtirildi' : 'o\'chirildi'}`, subscription);
  } catch (error) {
    next(error);
  }
};



exports.updateOrder = async (req, res, next) => {
  try {
    const { orders } = req.body; 

    for (const item of orders) {
      await Subscription.findByIdAndUpdate(item.id, { order: item.order });
    }

    apiResponse(res, 200, true, "Tartib yangilandi");
  } catch (error) {
    next(error);
  }
};