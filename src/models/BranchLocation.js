const mongoose = require("mongoose");

const LocationSchema = new mongoose.Schema(
  {
    branchName: { type: String, required: true },
    longitude: { type: Number, required: true },
    latitude: { type: Number, required: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("BranchLocation", LocationSchema);
