const mongoose = require("mongoose");

const CouponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, "Kupon kodi bo'lishi shart"],
      unique: true,
      uppercase: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["PERCENT", "FIXED"],
      default: "PERCENT",
    },
    value: {
      type: Number,
      min: 1,
      required: function requiredCouponValue() {
        return this.discountPercentage === undefined;
      },
      validate: {
        validator: function validateCouponValue(value) {
          return this.type !== "PERCENT" || value <= 100;
        },
        message: "Foizli chegirma 100 dan oshmasligi kerak",
      },
    },
    discountPercentage: {
      type: Number,
      min: 1,
      max: 100,
    },
    applicableProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    applicablePublishers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Publishers",
      },
    ],
    minOrderAmount: {
      type: Number,
      default: 0,
    },
    startDate: {
      type: Date,
      required: [true, "Boshlanish sanasi bo'lishi shart"],
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: [true, "Tugash sanasi bo'lishi shart"],
      validate: {
        validator: function validateCouponEndDate(endDate) {
          return !this.startDate || endDate > this.startDate;
        },
        message: "Tugash sanasi boshlanish sanasidan keyin bo'lishi kerak",
      },
    },
    usageLimit: {
      type: Number,
      default: 0, // 0 yoki bo'sh qiymat cheksiz ishlatish degani.
    },
    usedCount: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

CouponSchema.virtual("isExpired").get(function () {
  return Date.now() > this.endDate;
});

CouponSchema.virtual("isStarted").get(function () {
  return Date.now() >= this.startDate;
});

CouponSchema.virtual("isValidByDate").get(function () {
  const now = Date.now();

  return now >= this.startDate && now <= this.endDate;
});

CouponSchema.virtual("expiryDate")
  .get(function getExpiryDate() {
    return this.endDate;
  })
  .set(function setExpiryDate(expiryDate) {
    this.endDate = expiryDate;
  });

CouponSchema.pre("validate", function normalizeCouponDates() {
  if (this.endDate === undefined && this.expiryDate !== undefined) {
    this.endDate = this.expiryDate;
  }
});

CouponSchema.pre("validate", function normalizeCouponValue() {
  if (this.value === undefined && this.discountPercentage !== undefined) {
    this.value = this.discountPercentage;
  }

  if (
    this.type === "PERCENT" &&
    this.discountPercentage === undefined &&
    this.value !== undefined
  ) {
    this.discountPercentage = this.value;
  }
});

CouponSchema.index({ applicableProducts: 1 });
CouponSchema.index({ applicablePublishers: 1 });

module.exports = mongoose.model("Coupon", CouponSchema);
