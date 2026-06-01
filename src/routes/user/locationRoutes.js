const express = require('express');
const router = express.Router();
const locationController = require('../../controllers/user/locationSelectController');

router.get('/regions', locationController.getRegions);
router.get('/districts', locationController.getDistricts);
router.get('/regions/:regionId', locationController.getRegionById);
router.get('/regions/:regionId/districts', locationController.getDistrictsByRegion);

module.exports = router;
