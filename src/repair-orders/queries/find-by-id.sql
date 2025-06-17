
SELECT
    ro.*,

    u.first_name AS client_first_name,
    u.last_name AS client_last_name,
    u.phone_number AS client_phone_number,

    pc.name_uz AS phone_name,

    ca.name AS created_by_name,
    ca.phone AS created_by_phone,

    s.name_uz AS status_name_uz,
    s.color AS status_color,
    s.bg_color AS status_bg_color,

    b.name AS branch_name,
    b.color AS branch_color,
    b.bg_color AS branch_bg_color,

    (
        SELECT json_agg(jsonb_build_object(
            'admin_id', aa.admin_id,
            'created_at', aa.created_at
        ))
        FROM repair_order_assign_admins aa
        WHERE aa.repair_order_id = ro.id
    ) AS assigned_admins,

    (
        SELECT json_agg(jsonb_build_object(
            'id', ip.id,
            'problem_category_id', ip.problem_category_id,
            'price', ip.price,
            'estimated_minutes', ip.estimated_minutes,
            'created_by', ip.created_by,
            'created_at', ip.created_at,
            'updated_at', ip.updated_at
        ))
        FROM repair_order_initial_problems ip
        WHERE ip.repair_order_id = ro.id
    ) AS initial_problems,

    (
        SELECT json_agg(jsonb_build_object(
            'id', fp.id,
            'problem_category_id', fp.problem_category_id,
            'price', fp.price,
            'estimated_minutes', fp.estimated_minutes,
            'created_by', fp.created_by,
            'created_at', fp.created_at,
            'updated_at', fp.updated_at
        ))
        FROM repair_order_final_problems fp
        WHERE fp.repair_order_id = ro.id
    ) AS final_problems,

    (
        SELECT json_agg(jsonb_build_object(
            'id', c.id,
            'text', c.text,
            'status', c.status,
            'created_by', c.created_by,
            'status_by', c.status_by,
            'created_at', c.created_at,
            'updated_at', c.updated_at
        ))
        FROM repair_order_comments c
        WHERE c.repair_order_id = ro.id AND c.status = 'Open'
    ) AS comments,

    (
        SELECT json_agg(jsonb_build_object(
            'id', p.id,
            'lat', p.lat,
            'long', p.long,
            'description', p.description,
            'is_main', p.is_main,
            'status', p.status,
            'created_by', p.created_by,
            'created_at', p.created_at,
            'updated_at', p.updated_at
        ))
        FROM repair_order_pickups p
        WHERE p.repair_order_id = ro.id AND p.status = 'Open'
    ) AS pickups,

    (
        SELECT jsonb_build_object(
            'id', d.id,
            'lat', d.lat,
            'long', d.long,
            'description', d.description,
            'is_main', d.is_main,
            'created_by', d.created_by,
            'created_at', d.created_at,
            'updated_at', d.updated_at
        )
        FROM repair_order_deliveries d
        WHERE d.repair_order_id = ro.id
        LIMIT 1
    ) AS delivery

FROM repair_orders ro
LEFT JOIN users u ON ro.user_id = u.id
LEFT JOIN admins ca ON ro.created_by = ca.id
LEFT JOIN branches b ON ro.branch_id = b.id
LEFT JOIN phone_categories pc ON ro.phone_category_id = pc.id
LEFT JOIN repair_order_statuses s ON ro.status_id = s.id

WHERE ro.id = :orderId AND ro.status != 'Deleted'
LIMIT 1;
