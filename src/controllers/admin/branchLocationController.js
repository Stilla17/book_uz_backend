const Location = require("../../models/BranchLocation");

exports.createLocation = async (req, res) => {
  try {
    const { branchName, longitude, latitude } = req.body;

    if (!branchName || longitude == null || latitude == null) {
      return res.status(400).json({
        success: false,
        message: "all fields are required",
      });
    }

    const location = await Location.create({
      branchName,
      longitude,
      latitude,
    });

    res.status(201).json({
      success: true,
      data: location,
      message: "Location created successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

exports.getLocationById = async (req, res) => {
  try {
    const location = await Location.findById(req.params.id);

    if (!location) {
      return res.status(404).json({
        success: false,
        message: "Location not found",
      });
    }

    res.status(200).json({
      success: true,
      data: location,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

exports.updateLocation = async (req, res) => {
  try {
    const { branchName, longitude, latitude } = req.body;
    const updateData = {};

    if (branchName !== undefined) updateData.branchName = branchName;
    if (longitude !== undefined) updateData.longitude = longitude;
    if (latitude !== undefined) updateData.latitude = latitude;

    const location = await Location.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!location) {
      return res.status(404).json({
        success: false,
        message: "Location not found",
      });
    }

    res.status(200).json({
      success: true,
      data: location,
      message: "Location updated successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

exports.deleteLocation = async (req, res) => {
  try {
    const location = await Location.findByIdAndDelete(req.params.id);

    if (!location) {
      return res.status(404).json({
        success: false,
        message: "Location not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Location deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

exports.getLocations = async (req, res) => {
  try {
    const locations = await Location.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: locations,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};
