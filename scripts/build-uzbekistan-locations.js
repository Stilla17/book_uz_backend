const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const regions = require(path.join(rootDir, 'regions.json'));
const districts = require(path.join(rootDir, 'districtData.json'));

const regionIndexByExternalId = {
  8: 0,
  9: 6,
  10: 12,
  11: 1,
  12: 11,
  13: 9,
  14: 4,
  15: 7,
  16: 10,
  17: 13,
  18: 2,
  19: 8,
  21: 5,
  22: 3,
};

const regionSlugs = {
  8: 'qoraqalpogiston',
  9: 'buxoro',
  10: 'samarqand',
  11: 'navoiy',
  12: 'andijon',
  13: 'fargona',
  14: 'surxondaryo',
  15: 'sirdaryo',
  16: 'xorazm',
  17: 'toshkent_viloyati',
  18: 'qashqadaryo',
  19: 'jizzax',
  21: 'namangan',
  22: 'toshkent_shahri',
};

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/['‘’`]/g, '')
    .replace(/oʻ|o‘|o’/g, 'o')
    .replace(/gʻ|g‘|g’/g, 'g')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const data = Object.entries(regionIndexByExternalId).map(([externalId, regionIndex]) => {
  const regionId = Number(externalId);
  const regionDistricts = districts
    .filter((district) => district.region_id === regionId)
    .map((district) => ({
      id: slugify(district.name_en || district.name_uz) || `district_${district.id}`,
      externalId: district.id,
      name: {
        uz: district.name_uz,
        ru: district.name_ru,
        en: district.name_en,
        cyrl: district.name_cyrl,
        kar: district.name_kar,
      },
      soato: district.soato,
      phoneCode: district.phone_kod,
      order: district.c_order,
    }));

  return {
    id: regionSlugs[regionId],
    externalId: regionId,
    name: regions[regionIndex].name,
    districts: regionDistricts,
  };
});

const outputPath = path.join(rootDir, 'src', 'common', 'data', 'uzbekistan-regions-districts.json');
fs.writeFileSync(outputPath, `${JSON.stringify(data, null, 2)}\n`);

console.log(`Wrote ${data.length} regions and ${data.reduce((sum, region) => sum + region.districts.length, 0)} districts to ${outputPath}`);
