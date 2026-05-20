SELECT
    ro.id,
    ro.number_id,
    ro.imei,
    ro.status,
    -- Customer full name: prefer user first+last, fallback to ro.name
    COALESCE(
        NULLIF(BTRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''),
        NULLIF(BTRIM(ro.name), ''),
        ''
    ) AS customer_name,
    -- Customer phone number: prefer user phone1, fallback ro.phone_number, then user phone2
    COALESCE(
        NULLIF(BTRIM(u.phone_number1), ''),
        NULLIF(BTRIM(ro.phone_number), ''),
        NULLIF(BTRIM(u.phone_number2), ''),
        ''
    ) AS phone_number,
    -- Phone category name: prefer uz, fallback ru, then en
    COALESCE(
        NULLIF(pc.name_uz, ''),
        NULLIF(pc.name_ru, ''),
        NULLIF(pc.name_en, ''),
        ''
    ) AS device_name,
    -- Latest service form warranty_id and created_at
    sf.warranty_id   AS service_form_warranty_id,
    sf.created_at    AS service_form_created_at,
    sf.created_by    AS service_form_created_by,
    -- Service form creator admin name (from service_forms.created_by)
    COALESCE(
        NULLIF(
            BTRIM(CONCAT_WS(' ', sf_admin.first_name, sf_admin.last_name)),
            ''
        ),
        ''
    ) AS service_form_admin_name,
    -- Fallback: creator admin name from change history
    COALESCE(
        NULLIF(
            BTRIM(CONCAT_WS(' ', hist_admin.first_name, hist_admin.last_name)),
            ''
        ),
        ''
    ) AS history_admin_name,
    -- Final problems counts
    COALESCE(fp_counts.total_final_problems, 0)::integer    AS total_final_problems,
    COALESCE(fp_counts.not_done_final_problems, 0)::integer AS not_done_final_problems,
    -- Source type (from users table)
    u.source AS source_type,
    -- Total amount for metadata
    COALESCE((
        SELECT SUM(price)
        FROM repair_order_initial_problems
        WHERE repair_order_id = ro.id
    ), 0) + COALESCE((
        SELECT SUM(part_price * quantity)
        FROM repair_order_parts
        WHERE repair_order_id = ro.id
    ), 0) AS total_amount,
    -- Specialist name
    COALESCE((
        SELECT BTRIM(CONCAT_WS(' ', a.first_name, a.last_name))
        FROM repair_order_assign_admins raa
        INNER JOIN admins a ON raa.admin_id = a.id
        WHERE raa.repair_order_id = ro.id
        ORDER BY raa.created_at ASC
        LIMIT 1
    ), '') AS specialist_name
FROM repair_orders ro
    LEFT JOIN users u            ON ro.user_id = u.id
    LEFT JOIN phone_categories pc ON ro.phone_category_id = pc.id
    -- Latest service form
    LEFT JOIN LATERAL (
        SELECT s.warranty_id, s.created_at, s.created_by
        FROM service_forms s
        WHERE s.repair_order_id = ro.id
        ORDER BY s.created_at DESC
        LIMIT 1
    ) sf ON true
    -- Admin who created the service form (via service_forms.created_by)
    LEFT JOIN admins sf_admin ON sf.created_by = sf_admin.id
    -- Fallback: admin from change history for service_form_created
    LEFT JOIN LATERAL (
        SELECT roch.created_by
        FROM repair_order_change_histories roch
        WHERE roch.repair_order_id = ro.id
          AND roch.field IN ('service_form_created', 'service_form_updated')
        ORDER BY
            CASE WHEN roch.field = 'service_form_created' THEN 0 ELSE 1 END,
            roch.created_at DESC
        LIMIT 1
    ) hist ON true
    LEFT JOIN admins hist_admin ON hist.created_by = hist_admin.id
    -- Final problems aggregation
    LEFT JOIN LATERAL (
        SELECT
            COUNT(*)::integer                                      AS total_final_problems,
            COUNT(*) FILTER (WHERE rofp.is_done IS NOT TRUE)::integer AS not_done_final_problems
        FROM repair_order_final_problems rofp
        WHERE rofp.repair_order_id = ro.id
    ) fp_counts ON true
WHERE ro.id = :repairOrderId
    AND ro.status != 'Deleted'
LIMIT 1;
