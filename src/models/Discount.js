const mongoose = require("mongoose");

const DiscountSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Chegirma nomi bo'lishi shart"],
      trim: true,
    },
    type: {
      type: String,
      enum: ["PERCENT", "FIXED"],
      default: "PERCENT",
    },
    value: {
      type: Number,
      required: [true, "Chegirma qiymati bo'lishi shart"],
      min: [1, "Chegirma qiymati 1 dan kam bo'lmasligi kerak"],
      validate: {
        validator: function validateDiscountValue(value) {
          return this.type !== "PERCENT" || value <= 100;
        },
        message: "Foizli chegirma 100 dan oshmasligi kerak",
      },
    },
    targetType: {
      type: String,
      enum: ["PRODUCTS", "PUBLISHERS"],
      required: [true, "Chegirma turi bo'lishi shart"],
      default: "PRODUCTS",
    },
    products: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    publishers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Publishers",
      },
    ],
    minOrderAmount: {
      type: Number,
      default: 0,
      min: 0,
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
        validator: function validateDiscountEndDate(endDate) {
          return !this.startDate || endDate > this.startDate;
        },
        message: "Tugash sanasi boshlanish sanasidan keyin bo'lishi kerak",
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

DiscountSchema.virtual("isExpired").get(function getIsExpired() {
  return Date.now() > this.endDate;
});

DiscountSchema.virtual("isStarted").get(function getIsStarted() {
  return Date.now() >= this.startDate;
});

DiscountSchema.virtual("isValidByDate").get(function getIsValidByDate() {
  const now = Date.now();

  return now >= this.startDate && now <= this.endDate;
});

DiscountSchema.pre("validate", function clearUnusedTargets() {
  if (this.targetType !== "PRODUCTS") {
    this.products = [];
  }

  if (this.targetType !== "PUBLISHERS") {
    this.publishers = [];
  }
});

DiscountSchema.path("products").validate(function validateProducts(products) {
  return this.targetType !== "PRODUCTS" || products.length > 0;
}, "Mahsulot chegirmasi uchun kamida bitta mahsulot tanlanishi kerak");

DiscountSchema.path("publishers").validate(function validatePublishers(
  publishers,
) {
  return this.targetType !== "PUBLISHERS" || publishers.length > 0;
}, "Nashriyot chegirmasi uchun kamida bitta nashriyot tanlanishi kerak");

DiscountSchema.index({ targetType: 1, isActive: 1 });
DiscountSchema.index({ products: 1 });
DiscountSchema.index({ publishers: 1 });
DiscountSchema.index({ startDate: 1, endDate: 1 });

DiscountSchema.set("toJSON", { virtuals: true });
DiscountSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Discount", DiscountSchema);
