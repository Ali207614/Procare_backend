SELECT
  a.id,
  a.first_name,
  a.last_name,
  a.phone_number,
  a.status,
  a.is_active,
  a.created_at,
  JSON_AGG(
    JSON_BUILD_OBJECT(
      'repair_order_id', ro.id,
      'type', pickup_type,
      'status_name_uz', ros.name_uz,
      'status_name_ru', ros.name_ru,
      'status_name_en', ros.name_en
    )
  ) FILTER (WHERE ro.id IS NOT NULL) AS orders
FROM admins a
JOIN admin_roles ar ON ar.admin_id = a.id
JOIN roles r ON r.id = ar.role_id
LEFT JOIN (
  SELECT
    p.courier_id,
    ro.id,
    'pickup' AS pickup_type,
    ros.name_uz,
    ros.name_ru,
    ros.name_en
  FROM repair_order_pickups p
  JOIN repair_orders ro ON ro.id = p.repair_order_id
  JOIN repair_order_statuses ros ON ros.id = ro.status_id
  WHERE p.status = 'Open' AND ro.status = 'Open'

  UNION ALL

  SELECT
    d.courier_id,
    ro.id,
    'delivery' AS pickup_type,
    ros.name_uz,
    ros.name_ru,
    ros.name_en
  FROM repair_order_deliveries d
  JOIN repair_orders ro ON ro.id = d.repair_order_id
  JOIN repair_order_statuses ros ON ros.id = ro.status_id
  WHERE ro.status = 'Open'
) AS ro ON ro.courier_id = a.id
WHERE r.name = 'Courier'
  AND r.status = 'Open'
  AND a.status != 'Deleted'
  AND (
    :search::text IS NULL OR (
      a.first_name ILIKE '%' || :search || '%' OR
      a.last_name ILIKE '%' || :search || '%' OR
      a.phone_number ILIKE '%' || :search || '%'
    )
  )
GROUP BY a.id
ORDER BY a.created_at DESC
LIMIT :limit OFFSET :offset;
