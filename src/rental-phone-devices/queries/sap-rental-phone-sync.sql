SELECT
  T0."ItemCode" AS code,
  T0."ItemName" AS name,
  T0."U_ISFREE" AS is_free,
  T0."U_PRICE" AS price,
  T0."U_CURRENCY" AS currency
FROM "OITM" T0
WHERE T0."U_TYPE" = 'RENTAL_PHONE'
  AND T0."validFor" = 'Y'
