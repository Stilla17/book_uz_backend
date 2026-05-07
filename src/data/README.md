# Uzbekistan locations

`uzbekistan-regions-districts.json` is a self-contained region and district list.
It does not depend on MongoDB `_id` values, so it can be copied into another backend project safely.

Use the TypeScript helper:

```ts
import { getUzbekistanDistricts, getUzbekistanRegions, uzbekistanLocations } from './uzbekistanLocations';

const regions = getUzbekistanRegions();
const tashkentDistricts = getUzbekistanDistricts('toshkent_shahri');
const namanganDistricts = getUzbekistanDistricts(21);
```

Regenerate the JSON from the source files:

```bash
node scripts/build-uzbekistan-locations.js
```
