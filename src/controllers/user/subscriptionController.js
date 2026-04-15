// backend/src/controllers/user/subscriptionController.js
const Subscription = require('../../models/Subscription');
const UserSubscription = require('../../models/UserSubscription');
const apiResponse = require('../../utils/apiResponse');

// Mock plans (agar admin qo'shmagan bo'lsa ishlatiladi)

const mockPlans = [
  {
    _id: "mock_basic_1",
    name: {
      uz: "Boshlang'ich",
      ru: "Начальный",
      en: "Basic"
    },
    description: {
      uz: "Kitob o'qishni endi boshlayotganlar uchun ideal plan",
      ru: "Идеальный план для начинающих читать книги",
      en: "Ideal plan for those starting to read books"
    },
    price: {
      monthly: 29000,
      yearly: 290000
    },
    features: [
      {
        uz: "10 ta elektron kitob",
        ru: "10 электронных книг",
        en: "10 e-books"
      },
      {
        uz: "5 ta audio kitob",
        ru: "5 аудиокниг",
        en: "5 audiobooks"
      },
      {
        uz: "Chegirmalar 10%",
        ru: "Скидки 10%",
        en: "10% discounts"
      },
      {
        uz: "Offline o'qish",
        ru: "Офлайн чтение",
        en: "Offline reading"
      },
      {
        uz: "Reklama yo'q",
        ru: "Без рекламы",
        en: "No ads"
      },
      {
        uz: "24/7 qo'llab-quvvatlash",
        ru: "Поддержка 24/7",
        en: "24/7 support"
      }
    ],
    limits: {
      books: 10,
      audiobooks: 5,
      discount: 10
    },
    trialDays: 7,
    isPopular: false,
    isActive: true,
    order: 1,
    icon: "basic",
    color: "from-blue-500 to-cyan-500"
  },
  {
    _id: "mock_standard_2",
    name: {
      uz: "Standart",
      ru: "Стандартный",
      en: "Standard"
    },
    description: {
      uz: "Aktiv kitobxonlar uchun eng zo'r tanlov",
      ru: "Лучший выбор для активных читателей",
      en: "Best choice for active readers"
    },
    price: {
      monthly: 59000,
      yearly: 590000
    },
    features: [
      {
        uz: "50 ta elektron kitob",
        ru: "50 электронных книг",
        en: "50 e-books"
      },
      {
        uz: "30 ta audio kitob",
        ru: "30 аудиокниг",
        en: "30 audiobooks"
      },
      {
        uz: "Chegirmalar 20%",
        ru: "Скидки 20%",
        en: "20% discounts"
      },
      {
        uz: "Offline o'qish",
        ru: "Офлайн чтение",
        en: "Offline reading"
      },
      {
        uz: "Reklama yo'q",
        ru: "Без рекламы",
        en: "No ads"
      },
      {
        uz: "Premium qo'llab-quvvatlash",
        ru: "Премиум поддержка",
        en: "Premium support"
      },
      {
        uz: "Eksklyuziv kontent",
        ru: "Эксклюзивный контент",
        en: "Exclusive content"
      },
      {
        uz: "Yangi kitoblardan birinchi bo'lib xabardor bo'lish",
        ru: "Первыми узнавать о новинках",
        en: "First to know about new releases"
      }
    ],
    limits: {
      books: 50,
      audiobooks: 30,
      discount: 20
    },
    trialDays: 14,
    isPopular: true,
    isActive: true,
    order: 2,
    icon: "standard",
    color: "from-orange-500 to-pink-500"
  },
  {
    _id: "mock_premium_3",
    name: {
      uz: "Premium",
      ru: "Премиум",
      en: "Premium"
    },
    description: {
      uz: "Cheksiz imkoniyatlar uchun premium plan",
      ru: "Премиум план для безлимитных возможностей",
      en: "Premium plan for unlimited possibilities"
    },
    price: {
      monthly: 99000,
      yearly: 990000
    },
    features: [
      {
        uz: "Cheksiz kitoblar",
        ru: "Безлимитные книги",
        en: "Unlimited books"
      },
      {
        uz: "Cheksiz audio kitoblar",
        ru: "Безлимитные аудиокниги",
        en: "Unlimited audiobooks"
      },
      {
        uz: "Chegirmalar 30%",
        ru: "Скидки 30%",
        en: "30% discounts"
      },
      {
        uz: "Offline o'qish",
        ru: "Офлайн чтение",
        en: "Offline reading"
      },
      {
        uz: "Reklama yo'q",
        ru: "Без рекламы",
        en: "No ads"
      },
      {
        uz: "VIP qo'llab-quvvatlash",
        ru: "VIP поддержка",
        en: "VIP support"
      },
      {
        uz: "Eksklyuziv kontent",
        ru: "Эксклюзивный контент",
        en: "Exclusive content"
      },
      {
        uz: "Yangi kitoblardan birinchi bo'lib xabardor bo'lish",
        ru: "Первыми узнавать о новинках",
        en: "First to know about new releases"
      },
      {
        uz: "Mualliflar bilan uchrashuvlar",
        ru: "Встречи с авторами",
        en: "Meet the authors"
      },
      {
        uz: "Maxsus tadbirlarga taklifnoma",
        ru: "Приглашения на спецмероприятия",
        en: "Special event invitations"
      }
    ],
    limits: {
      books: -1,
      audiobooks: -1,
      discount: 30
    },
    trialDays: 30,
    isPopular: false,
    isActive: true,
    order: 3,
    icon: "premium",
    color: "from-purple-500 to-indigo-500"
  }
];

// Get all active subscription plans (for users)

exports.getPlans = async (req, res, next) => {
  try {
    // Try to get from database first
    const dbPlans = await Subscription.find({ isActive: true })
      .sort({ order: 1, createdAt: -1 });

    // If database has plans, use them, otherwise use mock plans
    let plansToUse = dbPlans;
    
    if (!dbPlans || dbPlans.length === 0) {
      console.log("No plans in database, using mock plans");
      plansToUse = mockPlans;
    }

    const transformedPlans = plansToUse.map(plan => ({
      id: plan._id,
      name: plan.name.uz,
      nameRu: plan.name.ru,
      nameEn: plan.name.en,
      description: plan.description || {
        uz: "",
        ru: "",
        en: ""
      },
      price: plan.price.monthly,
      yearlyPrice: plan.price.yearly,
      period: "month",
      features: plan.features.map(f => f.uz),
      featuresRu: plan.features.map(f => f.ru),
      featuresEn: plan.features.map(f => f.en),
      limits: plan.limits,
      isPopular: plan.isPopular,
      icon: getPlanIcon(plan.icon),
      color: plan.color || getPlanColor(plan.order),
      trialDays: plan.trialDays
    }));

    apiResponse(res, 200, true, "Obuna planlari", transformedPlans);
  } catch (error) {
    console.error("Error in getPlans:", error);
    


    const fallbackPlans = mockPlans.map(plan => ({
      id: plan._id,
      name: plan.name.uz,
      nameRu: plan.name.ru,
      nameEn: plan.name.en,
      description: plan.description,
      price: plan.price.monthly,
      yearlyPrice: plan.price.yearly,
      period: "month",
      features: plan.features.map(f => f.uz),
      featuresRu: plan.features.map(f => f.ru),
      featuresEn: plan.features.map(f => f.en),
      limits: plan.limits,
      isPopular: plan.isPopular,
      icon: getPlanIcon(plan.icon),
      color: plan.color,
      trialDays: plan.trialDays
    }));
    
    apiResponse(res, 200, true, "Obuna planlari (mock)", fallbackPlans);
  }
};

// Helper function to get plan icon

const getPlanIcon = (icon) => {
  const icons = {
    basic: 'BookOpen',
    standard: 'Zap',
    premium: 'Crown',
    pro: 'Award'
  };
  return icons[icon] || 'BookOpen';
};


// Helper function to get plan color

const getPlanColor = (order) => {
  const colors = [
    "from-blue-500 to-cyan-500",
    "from-orange-500 to-pink-500", 
    "from-purple-500 to-indigo-500",
    "from-green-500 to-emerald-500",
    "from-yellow-500 to-orange-500"
  ];
  return colors[order % colors.length];
};

// Get user's current subscription

exports.getUserSubscription = async (req, res, next) => {
  try {
    const subscription = await UserSubscription.findOne({
      user: req.user.id,
      status: { $in: ['active', 'trial'] }
    }).populate('subscription');

    if (!subscription) {
      return apiResponse(res, 200, true, "Aktiv obuna yo'q", null);
    }

    apiResponse(res, 200, true, "Foydalanuvchi obunasi", subscription);
  } catch (error) {
    next(error);
  }
};

// Subscribe to a plan

exports.subscribe = async (req, res, next) => {
  try {
    const { planId, period, paymentMethod } = req.body;
    const userId = req.user.id;

    let plan = await Subscription.findOne({ _id: planId, isActive: true });
    

    if (!plan) {
      plan = mockPlans.find(p => p._id === planId);
    }

    if (!plan) {
      return apiResponse(res, 404, false, "Obuna plani topilmadi");
    }

    const existingSubscription = await UserSubscription.findOne({
      user: userId,
      status: { $in: ['active', 'trial'] }
    });

    if (existingSubscription) {
      return apiResponse(res, 400, false, "Sizda allaqachon aktiv obuna mavjud");
    }

    const startDate = new Date();
    const endDate = new Date();
    const duration = period === 'yearly' ? 365 : 30;
    endDate.setDate(endDate.getDate() + duration);

    // Determine price

    const price = period === 'yearly' ? plan.price.yearly : plan.price.monthly;

    // Create subscription

    const userSubscription = await UserSubscription.create({
      user: userId,
      subscription: planId,
      status: plan.trialDays > 0 ? 'trial' : 'active',
      period,
      startDate,
      endDate,
      paymentMethod,
      price
    });

    const paymentUrl = `/payment/${userSubscription._id}`;

    apiResponse(res, 201, true, "Obuna yaratildi", {
      subscription: userSubscription,
      paymentUrl
    });
  } catch (error) {
    next(error);
  }
};

// Cancel subscription

exports.cancelSubscription = async (req, res, next) => {
  try {
    const subscription = await UserSubscription.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!subscription) {
      return apiResponse(res, 404, false, "Obuna topilmadi");
    }

    subscription.status = 'cancelled';
    subscription.autoRenew = false;
    subscription.updatedAt = Date.now();
    await subscription.save();

    apiResponse(res, 200, true, "Obuna bekor qilindi");
  } catch (error) {
    next(error);
  }
};

// Get user's subscription history
exports.getSubscriptionHistory = async (req, res, next) => {
  try {
    const subscriptions = await UserSubscription.find({ user: req.user.id })
      .populate('subscription')
      .sort({ createdAt: -1 });

    apiResponse(res, 200, true, "Obuna tarixi", subscriptions);
  } catch (error) {
    next(error);
  }
};


// Check if user has access to content
exports.checkAccess = async (req, res, next) => {
  try {
    const { contentId, contentType } = req.query; 
    const userId = req.user.id;

    // Get user's active subscription
    const subscription = await UserSubscription.findOne({
      user: userId,
      status: { $in: ['active', 'trial'] }
    }).populate('subscription');

    if (!subscription) {
      return apiResponse(res, 200, true, "Access denied", { hasAccess: false });
    }

    const plan = subscription.subscription;
    let hasAccess = false;

    // Check limits based on plan
    if (contentType === 'book') {
      if (plan.limits.books === -1) {
        hasAccess = true;
      } else {
        const booksUsed = await getUserBooksCount(userId, subscription.period);
        hasAccess = booksUsed < plan.limits.books;
      }
    } else if (contentType === 'audiobook') {
      if (plan.limits.audiobooks === -1) {
        hasAccess = true; 
      } else {
        const audiobooksUsed = await getUserAudiobooksCount(userId, subscription.period);
        hasAccess = audiobooksUsed < plan.limits.audiobooks;
      }
    }

    apiResponse(res, 200, true, "Access check", { hasAccess });
  } catch (error) {
    next(error);
  }
};

// Helper functions (implement based on your data structure)
async function getUserBooksCount(userId, period) {
  return 0;
}

async function getUserAudiobooksCount(userId, period) {
  return 0;
}