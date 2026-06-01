const BranchLocation = require("../../models/BranchLocation");
const apiResponse = require("../../utils/apiResponse");

const getBranchLocations = async (req, res, next) => {
  try {
    const locations = await BranchLocation.find().sort({ createdAt: -1 });

    return apiResponse(res, 200, true, "Branch locationlar ro'yxati", locations);
  } catch (error) {
    console.error("Error in getBranchLocations:", error);
    next(error);
  }
};

module.exports = {
  getBranchLocations,
};
