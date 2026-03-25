SELECT
    ro.id,
    ro.number_id,
    ro.imei,
    u.source AS source_type,
    ro.created_at,
    COALESCE(u.first_name || ' ' || u.last_name, ro.name, '') AS customer_name,
    COALESCE(u.phone_number1, ro.phone_number, '')            AS phone_number,
    COALESCE(pc.name_uz, pc.name_ru, pc.name_en, '')          AS device_name,
    COALESCE((
        SELECT a.first_name || ' ' || a.last_name
        FROM repair_order_assign_admins raa
        INNER JOIN admins a ON raa.admin_id = a.id
        WHERE raa.repair_order_id = ro.id
        ORDER BY raa.created_at ASC
        LIMIT 1
    ), '')                                                     AS specialist_name,
    COALESCE((
        SELECT SUM(price)
        FROM repair_order_initial_problems
        WHERE repair_order_id = ro.id
    ), 0) + COALESCE((
        SELECT SUM(part_price * quantity)
        FROM repair_order_parts
        WHERE repair_order_id = ro.id
    ), 0)                                                      AS total_amount
FROM repair_orders ro
    LEFT JOIN users u          ON ro.user_id = u.id
    LEFT JOIN phone_categories pc ON ro.phone_category_id = pc.id
WHERE ro.id = :repairOrderId
    AND ro.status = 'Open'
LIMIT 1;
