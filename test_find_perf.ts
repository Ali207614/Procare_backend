const n = 1000;
const permissions = Array.from({length: n}, (_, i) => ({ status_id: `id-${i}`, perm: true }));
const statuses = Array.from({length: n}, (_, i) => ({ id: `id-${i}` }));

console.time('find');
const merged = statuses.map((status) => ({
  ...status,
  permissions: permissions.find((p) => p.status_id === status.id)
}));
console.timeEnd('find');

console.time('map');
const permMap = new Map(permissions.map(p => [p.status_id, p]));
const mergedMap = statuses.map((status) => ({
  ...status,
  permissions: permMap.get(status.id)
}));
console.timeEnd('map');
