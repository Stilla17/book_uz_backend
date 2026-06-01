const locations = require('../../data/uzbekistan-regions-districts.json');
const apiResponse = require('../../utils/apiResponse');

const findRegion = (regionId) => {
  const numericId = Number(regionId);

  return locations.find((region) => {
    return region.id === regionId || (!Number.isNaN(numericId) && region.externalId === numericId);
  });
};

const getRegions = async (req, res, next) => {
  try {
    const { includeDistricts } = req.query;

    const regions = includeDistricts === 'true'
      ? locations
      : locations.map(({ districts, ...region }) => ({
          ...region,
          districtsCount: districts.length,
        }));

    return apiResponse(res, 200, true, "Regionlar ro'yxati", regions);
  } catch (error) {
    console.error('Error in getRegions:', error);
    next(error);
  }
};

const getRegionById = async (req, res, next) => {
  try {
    const region = findRegion(req.params.regionId);

    if (!region) {
      return apiResponse(res, 404, false, 'Region topilmadi');
    }

    return apiResponse(res, 200, true, "Region ma'lumotlari", region);
  } catch (error) {
    console.error('Error in getRegionById:', error);
    next(error);
  }
};

const getDistrictsByRegion = async (req, res, next) => {
  try {
    const region = findRegion(req.params.regionId);

    if (!region) {
      return apiResponse(res, 404, false, 'Region topilmadi');
    }

    return apiResponse(res, 200, true, "Districtlar ro'yxati", region.districts, {
      region: {
        id: region.id,
        externalId: region.externalId,
        name: region.name,
      },
      total: region.districts.length,
    });
  } catch (error) {
    console.error('Error in getDistrictsByRegion:', error);
    next(error);
  }
};

const getDistricts = async (req, res, next) => {
  try {
    const { regionId } = req.query;

    if (regionId) {
      const region = findRegion(regionId);

      if (!region) {
        return apiResponse(res, 404, false, 'Region topilmadi');
      }

      return apiResponse(res, 200, true, "Districtlar ro'yxati", region.districts, {
        region: {
          id: region.id,
          externalId: region.externalId,
          name: region.name,
        },
        total: region.districts.length,
      });
    }

    const districts = locations.flatMap((region) => {
      return region.districts.map((district) => ({
        ...district,
        region: {
          id: region.id,
          externalId: region.externalId,
          name: region.name,
        },
      }));
    });

    return apiResponse(res, 200, true, "Districtlar ro'yxati", districts, {
      total: districts.length,
    });
  } catch (error) {
    console.error('Error in getDistricts:', error);
    next(error);
  }
};

module.exports = {
  getRegions,
  getRegionById,
  getDistricts,
  getDistrictsByRegion,
};
