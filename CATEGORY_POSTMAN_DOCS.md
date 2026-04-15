# Category Postman Docs

Bu hujjat `Category` modelini Postman orqali test qilish uchun yozildi.

## Model formati

Category endi quyidagi ko'rinishda ishlaydi:

```json
{
  "slug": "detektiv",
  "title": {
    "uz": "Detektiv",
    "ru": "Детектив",
    "en": "Detective"
  },
  "subgenres": [
    {
      "slug": "tarixiy-detektiv",
      "title": {
        "uz": "Tarixiy detektiv",
        "ru": "Исторический детектив",
        "en": "Historical detective"
      },
      "books": []
    },
    {
      "slug": "zamonaviy-detektiv",
      "title": {
        "uz": "Zamonaviy detektiv",
        "ru": "Современный детектив",
        "en": "Modern detective"
      },
      "books": []
    }
  ]
}
```

## Muhim eslatma

`POST /api/v1/admin/categories` route `multipart/form-data` ishlatadi, chunki `icon` va `image` file ham qabul qiladi.

Shuning uchun Postman'da `raw JSON` emas, `form-data` tanlang.

## Base URL

Lokal holatda odatda:

```text
http://localhost:5000/api/v1
```

Agar sizda port boshqacha bo'lsa, o'sha portni yozing.

## Authorization

Admin route bo'lgani uchun Bearer token kerak:

```text
Authorization: Bearer YOUR_ADMIN_TOKEN
```

## 1. Category yaratish

### Request

`POST /api/v1/admin/categories`

### Postman Body

Body -> `form-data`

Quyidagi keylarni qo'shing:

| Key | Type | Majburiy | Izoh |
|---|---|---|---|
| `slug` | Text | Yo'q | Bo'sh qoldirilsa `title.uz` dan yasaydi |
| `title` | Text | Ha | JSON string bo'lishi kerak |
| `subgenres` | Text | Yo'q | JSON string bo'lishi kerak |
| `description` | Text | Yo'q | JSON string |
| `order` | Text | Yo'q | Masalan `1` |
| `isActive` | Text | Yo'q | `true` yoki `false` |
| `isFeatured` | Text | Yo'q | `true` yoki `false` |
| `icon` | File | Yo'q | Kategoriya icon rasmi |
| `image` | File | Yo'q | Kategoriya asosiy rasmi |

### `title` uchun value

```json
{"uz":"Detektiv","ru":"Детектив","en":"Detective"}
```

### `subgenres` uchun value

```json
[
  {
    "slug": "tarixiy-detektiv",
    "title": {
      "uz": "Tarixiy detektiv",
      "ru": "Исторический детектив",
      "en": "Historical detective"
    },
    "books": []
  },
  {
    "slug": "zamonaviy-detektiv",
    "title": {
      "uz": "Zamonaviy detektiv",
      "ru": "Современный детектив",
      "en": "Modern detective"
    },
    "books": []
  }
]
```

### `description` uchun value

```json
{"uz":"Detektiv kitoblar","ru":"Детективные книги","en":"Detective books"}
```

### Postman uchun tayyor qiymatlar

`slug`

```text
detektiv
```

`title`

```json
{"uz":"Detektiv","ru":"Детектив","en":"Detective"}
```

`subgenres`

```json
[{"slug":"tarixiy-detektiv","title":{"uz":"Tarixiy detektiv","ru":"Исторический детектив","en":"Historical detective"},"books":[]},{"slug":"zamonaviy-detektiv","title":{"uz":"Zamonaviy detektiv","ru":"Современный детектив","en":"Modern detective"},"books":[]}]
```

`description`

```json
{"uz":"Detektiv kitoblar","ru":"Детективные книги","en":"Detective books"}
```

`order`

```text
1
```

`isActive`

```text
true
```

`isFeatured`

```text
false
```

## 2. Subgenre qo'shish

### Request

`POST /api/v1/admin/categories/sub`

Bu route uchun `Body -> raw -> JSON` ishlatish qulay.

### Body

```json
{
  "categoryId": "CATEGORY_ID",
  "slug": "tarixiy-detektiv",
  "title": {
    "uz": "Tarixiy detektiv",
    "ru": "Исторический детектив",
    "en": "Historical detective"
  },
  "books": []
}
```

## 3. Category yangilash

### Request

`PATCH /api/v1/admin/categories/:id`

Bu route ham `form-data` ishlatadi.

Masalan faqat `subgenres` ni yangilash uchun:

| Key | Type | Value |
|---|---|---|
| `subgenres` | Text | JSON string |

`subgenres` qiymati:

```json
[
  {
    "slug": "tarixiy-detektiv",
    "title": {
      "uz": "Tarixiy detektiv",
      "ru": "Исторический детектив",
      "en": "Historical detective"
    },
    "books": []
  }
]
```

## 4. Categorylarni ko'rish

### Admin

`GET /api/v1/admin/categories`

### User

`GET /api/v1/categories`

### Bitta category

`GET /api/v1/categories/detektiv`

## 5. Xatolar bo'lsa nimalarni tekshirish kerak

1. `Authorization` ichida admin token borligini tekshiring.
2. `POST /admin/categories` uchun `Body` turi `form-data` ekanini tekshiring.
3. `title`, `subgenres`, `description` qiymatlari JSON string ko'rinishida yozilgan bo'lsin.
4. `slug` unique bo'lishi kerak.
5. `books` ichida bo'sh array yoki mavjud `Product` `_id` lar bo'lishi kerak.

## 6. cURL misol

```bash
curl --location 'http://localhost:5000/api/v1/admin/categories' \
--header 'Authorization: Bearer YOUR_ADMIN_TOKEN' \
--form 'slug="detektiv"' \
--form 'title="{\"uz\":\"Detektiv\",\"ru\":\"Детектив\",\"en\":\"Detective\"}"' \
--form 'subgenres="[{\"slug\":\"tarixiy-detektiv\",\"title\":{\"uz\":\"Tarixiy detektiv\",\"ru\":\"Исторический детектив\",\"en\":\"Historical detective\"},\"books\":[]},{\"slug\":\"zamonaviy-detektiv\",\"title\":{\"uz\":\"Zamonaviy detektiv\",\"ru\":\"Современный детектив\",\"en\":\"Modern detective\"},\"books\":[]}]"' \
--form 'description="{\"uz\":\"Detektiv kitoblar\",\"ru\":\"Детективные книги\",\"en\":\"Detective books\"}"' \
--form 'order="1"' \
--form 'isActive="true"' \
--form 'isFeatured="false"'
```
