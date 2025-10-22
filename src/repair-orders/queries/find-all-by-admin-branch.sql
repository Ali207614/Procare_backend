SELECT
    ro.id,
    ro.number_id,
    ro.total,
    ro.imei,
    ro.delivery_method,
    ro.pickup_method,
    ro.sort,
    ro.priority,
    ro.created_at,
    COALESCE(
            jsonb_build_object(
                    'id', u.id,
                    'first_name', u.first_name,
                    'last_name', u.last_name,
                    'phone_number1', u.phone_number1,
                    'phone_number2', u.phone_number2
            ),
            '{}'::jsonb
    ) AS user,

    COALESCE(
        jsonb_build_object(
            'id', ca.id,
            'first_name', ca.first_name,
            'last_name', ca.last_name,
            'phone_number', ca.phone_number
        ),
        '{}'::jsonb
    ) AS created_by_admin,

    COALESCE(
        jsonb_build_object(
            'id', pc.id,
            'name_uz', pc.name_uz,
            'name_ru', pc.name_ru,
            'name_en', pc.name_en
        ),
        '{}'::jsonb
    ) AS phone_category,

    COALESCE(
        jsonb_build_object(
            'id', s.id,
            'name_uz', s.name_uz,
            'name_ru', s.name_ru,
            'name_en', s.name_en,
            'transitions', COALESCE((
                SELECT json_agg(
                    jsonb_build_object(
                        'id', t.id,
                        'to_status_id', t.to_status_id
                    )
                )
                FROM repair_order_status_transitions t
                WHERE t.from_status_id = s.id
            ), '[]'::json)
        ),
        '{}'::jsonb
    ) AS repair_order_status,

    COALESCE(
        jsonb_build_object(
            'id', b.id,
            'name_uz', b.name_uz,
            'name_ru', b.name_ru,
            'name_en', b.name_en
        ),
        '{}'::jsonb
    ) AS branch,

    /* === Assigned Admins === */
    COALESCE((
        SELECT json_agg(
            jsonb_build_object(
                'id', aa.admin_id,
                'first_name', a.first_name,
                'last_name', a.last_name,
                'phone_number', a.phone_number,
                'created_at', aa.created_at
            )
        )
        FROM repair_order_assign_admins aa
        INNER JOIN admins a ON aa.admin_id = a.id
        WHERE aa.repair_order_id = ro.id
    ), '[]'::json) AS assigned_admins,

    COALESCE((
        SELECT jsonb_build_object(
            'id', rp.id,
            'rental_phone_device_id', rp.rental_phone_device_id,
            'sap_order_id', rp.sap_order_id,
            'is_free', rp.is_free,
            'price', rp.price,
            'currency', rp.currency,
            'status', rp.status,
            'rented_at', rp.rented_at,
            'returned_at', rp.returned_at,
            'notes', rp.notes,
            'created_by', rp.created_by,
            'created_at', rp.created_at,
            'updated_at', rp.updated_at
        )
        FROM repair_order_rental_phones rp
        WHERE rp.repair_order_id = ro.id AND rp.status != 'Cancelled'
        LIMIT 1
    ), '{}'::jsonb) AS rental_phone

FROM repair_orders ro
    LEFT JOIN users u ON ro.user_id = u.id
    LEFT JOIN admins ca ON ro.created_by = ca.id
    LEFT JOIN branches b ON ro.branch_id = b.id
    LEFT JOIN phone_categories pc ON ro.phone_category_id = pc.id
    LEFT JOIN repair_order_statuses s ON ro.status_id = s.id

WHERE ro.branch_id = :branchId
  AND ro.status = 'Open'
  AND ro.status_id = ANY(:statusIds)

/*ORDER_CLAUSE*/

    LIMIT :limit OFFSET :offset;
