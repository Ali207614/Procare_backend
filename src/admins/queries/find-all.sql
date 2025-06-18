SELECT
    a.*,
    COALESCE(json_agg(DISTINCT jsonb_build_object(
        'id', r.id,
        'name', r.name
    )) FILTER (WHERE r.id IS NOT NULL), '[]') AS roles,
    COALESCE(json_agg(DISTINCT jsonb_build_object(
        'id', b.id,
        'name_uz', b.name_uz,
        'name_ru', b.name_ru,
        'name_en', b.name_en
    )) FILTER (WHERE b.id IS NOT NULL), '[]') AS branches
FROM admins a
LEFT JOIN admin_roles ar ON ar.admin_id = a.id
LEFT JOIN roles r ON r.id = ar.role_id AND r.status = 'Open' AND r.is_active = true
LEFT JOIN admin_branches ab ON ab.admin_id = a.id
LEFT JOIN branches b ON b.id = ab.branch_id AND b.status = 'Open' AND b.is_active = true
WHERE
    (
        COALESCE(:search, '') = '' OR
        a.first_name ILIKE '%' || :search || '%' OR
        a.last_name ILIKE '%' || :search || '%' OR
        a.phone_number ILIKE '%' || :search || '%' OR
        a.passport_series ILIKE '%' || :search || '%' OR
        a.id_card_number ILIKE '%' || :search || '%'
    )
    AND (:status::text[] IS NULL OR a.status = ANY(:status::text[]))
    AND (
        :branch_ids::uuid[] IS NULL OR
        EXISTS (
            SELECT 1
            FROM admin_branches ab2
            WHERE ab2.admin_id = a.id
            AND ab2.branch_id = ANY(:branch_ids::uuid[])
        )
    )
    AND (
        :role_ids::uuid[] IS NULL OR
        EXISTS (
            SELECT 1
            FROM admin_roles ar2
            WHERE ar2.admin_id = a.id
            AND ar2.role_id = ANY(:role_ids::uuid[])
        )
    )
GROUP BY a.id
ORDER BY a.created_at DESC
LIMIT :limit OFFSET :offset;
