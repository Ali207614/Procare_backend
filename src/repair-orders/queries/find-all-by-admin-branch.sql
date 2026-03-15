WITH queue_problem_minutes AS (
    SELECT
        problem_rows.repair_order_id,
        COALESCE(SUM(problem_rows.estimated_minutes), 0)::integer AS total_estimated_minutes
    FROM (
        SELECT repair_order_id, estimated_minutes
        FROM repair_order_initial_problems
        UNION ALL
        SELECT repair_order_id, estimated_minutes
        FROM repair_order_final_problems
    ) AS problem_rows
    GROUP BY problem_rows.repair_order_id
),
queue_orders AS (
    SELECT
        ro.id,
        ro.branch_id,
        ro.status_id,
        ro.sort,
        ro.created_at,
        COALESCE(qpm.total_estimated_minutes, 0) AS total_estimated_minutes,
        GREATEST(
            COALESCE(qpm.total_estimated_minutes, 0)
                - FLOOR(EXTRACT(EPOCH FROM (NOW() - ro.created_at)) / 60)::integer,
            0
        ) AS remaining_minutes
    FROM repair_orders ro
        LEFT JOIN queue_problem_minutes qpm ON qpm.repair_order_id = ro.id
    WHERE ro.branch_id = :branchId
      AND ro.status = 'Open'
      AND ro.status_id = ANY(:statusIds)
),
queue_deadlines AS (
    SELECT
        qo.id,
        NOW()
            + (
                SUM(qo.remaining_minutes) OVER (
                    PARTITION BY qo.branch_id, qo.status_id
                    ORDER BY qo.sort
                    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
                ) * INTERVAL '1 minute'
            ) AS deadline_at
    FROM queue_orders qo
),
-- Assigns a per-status rank to every repair order that passes all active filters.
-- The main query INNER JOINs this CTE and slices [offset+1 .. offset+limit] per status.
per_status_ranked AS (
    SELECT
        ro.id,
        ROW_NUMBER() OVER (PARTITION BY ro.status_id /*ROW_NUMBER_ORDER*/) AS rn
    FROM repair_orders ro
        LEFT JOIN users u         ON ro.user_id          = u.id
        LEFT JOIN phone_categories pc ON ro.phone_category_id = pc.id
    WHERE ro.branch_id   = :branchId
      AND ro.status       = 'Open'
      AND ro.status_id    = ANY(:statusIds)
    /*ADDITIONAL_WHERE*/
)
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
    ro.phone_number,
    ro.source,
    ro.created_at,
    qd.deadline_at,
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
            'can_user_view', s.can_user_view,
            'transitions', COALESCE((
                SELECT json_agg(
                    jsonb_build_object(
                        'id', t.id,
                        'to_status_id', t.to_status_id
                    )
                )
                FROM "repair-order-status-transitions" t
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
            'updated_at', rp.updated_at
        )
        FROM repair_order_rental_phones rp
        WHERE rp.repair_order_id = ro.id AND rp.status != 'Cancelled'
        LIMIT 1
    ), '{}'::jsonb) AS rental_phone,

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
                            'id', rparts.id,
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
                            'quantity', rparts.quantity,
                            'part_price', rparts.part_price,
                            'created_by', rparts.created_by,
                            'created_at', rparts.created_at,
                            'updated_at', rparts.updated_at
                        )
                    )
                    FROM repair_order_parts rparts
                    LEFT JOIN repair_parts rp_part ON rparts.repair_part_id = rp_part.id
                    WHERE rparts.repair_order_initial_problem_id = ip.id
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
                            'id', rparts.id,
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
                            'quantity', rparts.quantity,
                            'part_price', rparts.part_price,
                            'created_by', rparts.created_by,
                            'created_at', rparts.created_at,
                            'updated_at', rparts.updated_at
                        )
                    )
                    FROM repair_order_parts rparts
                    LEFT JOIN repair_parts rp_part ON rparts.repair_part_id = rp_part.id
                    WHERE rparts.repair_order_final_problem_id = fp.id
                ), '[]'::json)
            )
        )
        FROM repair_order_final_problems fp
        LEFT JOIN problem_categories pc_fp ON fp.problem_category_id = pc_fp.id
        WHERE fp.repair_order_id = ro.id
    ), '[]'::json) AS final_problems

FROM repair_orders ro
    LEFT JOIN queue_deadlines     qd  ON qd.id              = ro.id
    -- INNER JOIN ensures only rows that passed filters AND fall within the requested
    -- per-status page window are returned.
    INNER JOIN per_status_ranked  psr ON psr.id             = ro.id
    LEFT JOIN users               u   ON ro.user_id         = u.id
    LEFT JOIN admins              ca  ON ro.created_by      = ca.id
    LEFT JOIN branches            b   ON ro.branch_id       = b.id
    LEFT JOIN phone_categories    pc  ON ro.phone_category_id = pc.id
    LEFT JOIN repair_order_statuses s ON ro.status_id       = s.id

WHERE ro.branch_id  = :branchId
  AND ro.status     = 'Open'
  AND ro.status_id  = ANY(:statusIds)
  -- Per-status pagination: offset/limit apply independently inside each status column
  AND psr.rn >  :offset
  AND psr.rn <= :endRow

/*ORDER_CLAUSE*/
