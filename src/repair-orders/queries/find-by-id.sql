SELECT
    ro.id,
    ro.number_id,
    ro.total,
    ro.imei,
    ro.delivery_method,
    ro.pickup_method,
    ro.sort,
    ro.priority,
    ro.name,
    ro.description,
    ro.phone_number,
    ro.source,
    CASE
        WHEN ro.agreed_date IS NULL OR BTRIM(ro.agreed_date::text) = '' THEN NULL
        ELSE TO_CHAR(NULLIF(BTRIM(ro.agreed_date::text), '')::timestamp, 'YYYY-MM-DD HH24:MI')
    END AS agreed_date,
    jsonb_build_object(
        'id', rc.id,
        'name', rc.name
    ) AS reject_cause,
    jsonb_build_object(
        'id', ror.id,
        'title', ror.title,
        'description', ror.description
    ) AS region,
    ro.created_at,
    COALESCE((jsonb_build_object(
            'id', u.id,
            'first_name', u.first_name,
            'last_name', u.last_name,
            'phone_number1', u.phone_number1,
            'phone_number2', u.phone_number2
    )), '{}'::jsonb) AS user,
    COALESCE(
        jsonb_build_object(
            'id', ca.id,
            'first_name', ca.first_name,
            'last_name', ca.last_name,
            'phone_number', ca.phone_number
        ),
        '{}'::jsonb
    ) AS created_by_admin,
    COALESCE((jsonb_build_object(
        'id', pc.id,
        'name_uz', pc.name_uz,
        'name_ru', pc.name_ru,
        'name_en', pc.name_en
    )), '{}'::jsonb) AS phone_category,
    COALESCE((
    jsonb_build_object(
        'id', s.id,
        'name_uz', s.name_uz,
        'name_ru', s.name_ru,
        'name_en', s.name_en,
        'color', s.color,
        'bg_color', s.bg_color,
        'can_user_view', s.can_user_view,
        'transitions', COALESCE((
            SELECT json_agg(
                jsonb_build_object(
                    'id', t.to_status_id,
                    'name_uz', s2.name_uz,
                    'name_ru', s2.name_ru,
                    'name_en', s2.name_en,
                    'can_user_view', s2.can_user_view
                )
            )
            FROM "repair-order-status-transitions" t
            INNER JOIN repair_order_statuses s2
                ON s2.id = t.to_status_id
            WHERE t.from_status_id = s.id
        ), '[]'::json)
    )
), '{}'::jsonb) AS repair_order_status,
    COALESCE((jsonb_build_object(
        'id', b.id,
        'name_uz', b.name_uz,
        'name_ru', b.name_ru,
        'name_en', b.name_en
    )), '{}'::jsonb) AS branch,
    COALESCE((
        SELECT json_agg(DISTINCT jsonb_build_object(
            'id', aa.admin_id,
            'first_name', a.first_name,
            'last_name', a.last_name,
            'phone_number', a.phone_number,
            'created_at', aa.created_at
        ))
        FROM repair_order_assign_admins aa
        INNER JOIN admins a ON aa.admin_id = a.id
        WHERE aa.repair_order_id = ro.id
    ), '[]'::json) AS assigned_admins,
    COALESCE((
        SELECT json_agg(
            jsonb_build_object(
                'id', ip.id,
                'problem_category', jsonb_build_object(
                    'id', pc_ip.id,
                    'name_uz', pc_ip.name_uz,
                    'name_ru', pc_ip.name_ru,
                    'name_en', pc_ip.name_en
                ),
                'price', ip.price,
                'estimated_minutes', ip.estimated_minutes,
                'created_by', ip.created_by,
                'created_at', ip.created_at,
                'updated_at', ip.updated_at,
                'parts', COALESCE((
                    SELECT json_agg(
                        jsonb_build_object(
                            'id', rp.id,
                            'repair_part', jsonb_build_object(
                                'id', rp_part.id,
                                'name_uz', rp_part.part_name_uz,
                                'name_ru', rp_part.part_name_ru,
                                'name_en', rp_part.part_name_en,
                                'price', rp_part.part_price,
                                'quantity', rp_part.quantity,
                                'description_uz', rp_part.description_uz,
                                'description_ru', rp_part.description_ru,
                                'description_en', rp_part.description_en,
                                'status', rp_part.status,
                                'created_by', rp_part.created_by,
                                'created_at', rp_part.created_at,
                                'updated_at', rp_part.updated_at
                            ),
                            'quantity', rp.quantity,
                            'part_price', rp.part_price,
                            'created_by', rp.created_by,
                            'created_at', rp.created_at,
                            'updated_at', rp.updated_at
                        )
                    )
                    FROM repair_order_parts rp
                    LEFT JOIN repair_parts rp_part ON rp.repair_part_id = rp_part.id
                    WHERE rp.repair_order_initial_problem_id = ip.id
                ), '[]'::json)
            )
        )
        FROM repair_order_initial_problems ip
        LEFT JOIN problem_categories pc_ip ON ip.problem_category_id = pc_ip.id
        WHERE ip.repair_order_id = ro.id
    ), '[]'::json) AS initial_problems,
    COALESCE((
        SELECT json_agg(
            jsonb_build_object(
                'id', fp.id,
                'problem_category', jsonb_build_object(
                    'id', pc_fp.id,
                    'name_uz', pc_fp.name_uz,
                    'name_ru', pc_fp.name_ru,
                    'name_en', pc_fp.name_en
                ),
                'price', fp.price,
                'estimated_minutes', fp.estimated_minutes,
                'created_by', fp.created_by,
                'created_at', fp.created_at,
                'updated_at', fp.updated_at,
                'parts', COALESCE((
                    SELECT json_agg(
                        jsonb_build_object(
                            'id', rp.id,
                            'repair_part', jsonb_build_object(
                                'id', rp_part.id,
                                'name_uz', rp_part.part_name_uz,
                                'name_ru', rp_part.part_name_ru,
                                'name_en', rp_part.part_name_en,
                                'price', rp_part.part_price,
                                'quantity', rp_part.quantity,
                                'description_uz', rp_part.description_uz,
                                'description_ru', rp_part.description_ru,
                                'description_en', rp_part.description_en,
                                'status', rp_part.status,
                                'created_by', rp_part.created_by,
                                'created_at', rp_part.created_at,
                                'updated_at', rp_part.updated_at
                            ),
                            'quantity', rp.quantity,
                            'part_price', rp.part_price,
                            'created_by', rp.created_by,
                            'created_at', rp.created_at,
                            'updated_at', rp.updated_at
                        )
                    )
                    FROM repair_order_parts rp
                    LEFT JOIN repair_parts rp_part ON rp.repair_part_id = rp_part.id
                    WHERE rp.repair_order_final_problem_id = fp.id
                ), '[]'::json)
            )
        )
        FROM repair_order_final_problems fp
        LEFT JOIN problem_categories pc_fp ON fp.problem_category_id = pc_fp.id
        WHERE fp.repair_order_id = ro.id
    ), '[]'::json) AS final_problems,
  COALESCE((
    SELECT json_agg(
      jsonb_build_object(
        'id', c.id,
        'text', c.text,
        'status', c.status,
        'comment_type', c.comment_type,
        'history_change_id', c.history_change_id,
        'is_editable', c.comment_type = 'manual',
        'is_deletable', c.comment_type = 'manual',
        'created_by_admin', COALESCE((
            SELECT jsonb_build_object(
                'id', a1.id,
                'first_name', a1.first_name,
                'last_name', a1.last_name,
                'phone_number', a1.phone_number
            )
            FROM admins a1
            WHERE a1.id = c.created_by
            LIMIT 1
        ), '{}'::jsonb),
        'repair_order_status', COALESCE((
            SELECT jsonb_build_object(
                'id', s.id,
                'name_uz', s.name_uz,
                'name_ru', s.name_ru,
                'name_en', s.name_en,
                'can_user_view', s.can_user_view
            )
            FROM repair_order_statuses s
            WHERE s.id = c.status_by
            LIMIT 1
        ), '{}'::jsonb),
        'created_at', c.created_at,
        'updated_at', c.updated_at
      )
      ORDER BY 
        CASE WHEN c.comment_type = 'manual' THEN 1 ELSE 2 END ASC,
        c.created_at DESC, 
        c.id DESC
    )
    FROM repair_order_comments c
    WHERE c.repair_order_id = ro.id
      AND c.status = 'Open'
), '[]'::json) AS comments,
    COALESCE((
           select jsonb_build_object(
                'id', p.id,
                'lat', p.lat,
                'long', p.long,
                'description', p.description,
                'is_main', p.is_main,
                'status', p.status,
                'courier', COALESCE((
                    SELECT jsonb_build_object(
                        'id', aa.id,
                        'first_name', aa.first_name,
                        'last_name', aa.last_name,
                        'phone_number', aa.phone_number
                    )
                    FROM admins aa
                    WHERE aa.id = p.courier_id
                    LIMIT 1
                ), '{}'::jsonb),
                'created_by', p.created_by,
                'created_at', p.created_at,
                'updated_at', p.updated_at
            )
        FROM repair_order_pickups p
        WHERE p.repair_order_id = ro.id AND p.status = 'Open'
        LIMIT 1
    ), '{}'::jsonb) AS pickups,
    COALESCE((
        SELECT jsonb_build_object(
            'id', d.id,
            'lat', d.lat,
            'long', d.long,
            'description', d.description,
            'is_main', d.is_main,
            'courier', COALESCE((
                SELECT jsonb_build_object(
                    'id', aa.id,
                    'first_name', aa.first_name,
                    'last_name', aa.last_name,
                    'phone_number', aa.phone_number
                )
                FROM admins aa
                WHERE aa.id = d.courier_id
                LIMIT 1
            ), '{}'::jsonb),
            'created_by', d.created_by,
            'created_at', d.created_at,
            'updated_at', d.updated_at
        )
        FROM repair_order_deliveries d
        WHERE d.repair_order_id = ro.id and d.status = 'Open'
        LIMIT 1
    ), '{}'::jsonb) AS delivery,
    COALESCE((
        SELECT jsonb_build_object(
            'id', rp.id,
            'rental_phone_id', rp.rental_phone_device_id,
            'is_free', rp.is_free,
            'price', rp.price,
            'currency', rp.currency,
            'status', rp.status,
            'rented_at', rp.rented_at,
            'returned_at', rp.returned_at,
            'notes', rp.notes,
            'created_by', rp.created_by,
            'created_at', rp.created_at,
            'updated_at', rp.updated_at,
            'rental_phone_device', CASE
                WHEN rpd.id IS NULL THEN NULL
                ELSE jsonb_build_object(
                    'id', rpd.id,
                    'name', rpd.name,
                    'imei', rpd.imei,
                    'currency', rpd.currency,
                    'is_available', rpd.is_available,
                    'status', rpd.status,
                    'created_at', rpd.created_at,
                    'updated_at', rpd.updated_at
                )
            END
        )
        FROM repair_order_rental_phones rp
        LEFT JOIN rental_phone_devices rpd
            ON rpd.id = rp.rental_phone_device_id
        WHERE rp.repair_order_id = ro.id AND rp.status IN ('Pending', 'Active')
        ORDER BY rp.created_at DESC
        LIMIT 1
    ), '{}'::jsonb) AS rental_phone
FROM repair_orders ro
    LEFT JOIN users u ON ro.user_id = u.id
    LEFT JOIN admins ca ON ro.created_by = ca.id
    LEFT JOIN branches b ON ro.branch_id = b.id
    LEFT JOIN phone_categories pc ON ro.phone_category_id = pc.id
    LEFT JOIN repair_order_reject_causes rc ON ro.reject_cause_id = rc.id
    LEFT JOIN repair_order_regions ror ON ro.region_id = ror.id
    LEFT JOIN repair_order_statuses s ON ro.status_id = s.id
WHERE ro.id = :orderId
    LIMIT 1;
