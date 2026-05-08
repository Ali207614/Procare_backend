# Frontend Update: Calculator Phone Category Search

## What changed

`GET /api/v1/calculator/phone-categories/:os_type_id` now supports an optional `search` query parameter.

## Usage

```http
GET /api/v1/calculator/phone-categories/:os_type_id?search=iPhone
```

You can combine it with `parent_id` when searching inside a selected category level:

```http
GET /api/v1/calculator/phone-categories/:os_type_id?parent_id=:parent_id&search=15 Pro
```

## Behavior

- Search is case-insensitive.
- Search checks `name_uz`, `name_ru`, and `name_en`.
- Leading and trailing spaces are ignored.
- Maximum length is 100 characters.
- Response shape is unchanged.
