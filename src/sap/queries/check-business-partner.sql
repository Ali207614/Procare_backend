SELECT "CardCode"
FROM {{schema}}."OCRD"
WHERE LOWER("Phone1") = LOWER(?)
AND "CardType" = 'C'
