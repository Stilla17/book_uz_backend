export type LocationName = {
  uz: string;
  ru?: string;
  en?: string;
  cyrl?: string;
  kar?: string;
};

export type UzbekistanDistrict = {
  id: string;
  externalId: number;
  name: LocationName;
  soato: number;
  phoneCode: number;
  order: number;
};

export type UzbekistanRegion = {
  id: string;
  externalId: number;
  name: LocationName;
  districts: UzbekistanDistrict[];
};

export const uzbekistanLocations = require('./uzbekistan-regions-districts.json') as UzbekistanRegion[];

export function getUzbekistanRegions() {
  return uzbekistanLocations.map(({ districts, ...region }) => region);
}

export function getUzbekistanDistricts(regionId: string | number) {
  const region = uzbekistanLocations.find((item) => item.id === regionId || item.externalId === Number(regionId));
  return region ? region.districts : [];
}
