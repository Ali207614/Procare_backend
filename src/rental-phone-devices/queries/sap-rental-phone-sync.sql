SELECT 
  T0."Code", 
  T0."U_ItemCode", 
  T0."U_ItemName", 
  T1."ItemCode", 
  T1."ItemName",
  T1."OnHand",
  T0."U_IS_FREE", 
  T0."U_PRICE", 
  T0."U_IS_AVAILABLE" 
FROM "{{schema}}"."@RENTAL_PHONES" T0
LEFT JOIN "{{schema}}"."OITM" T1 ON T0."U_ItemCode" = T1."ItemCode"
WHERE T0."U_IS_AVAILABLE" = 'YES' and T1."OnHand" > 0
