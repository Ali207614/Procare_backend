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
WHERE a.id = :admin_id
GROUP BY a.id
LIMIT 1;
