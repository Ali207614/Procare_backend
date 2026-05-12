const n = 1000;
const statuses = Array.from({length: n}, (_, i) => ({ id: `id-${i}` }));
const permissions = Array.from({length: n}, (_, i) => ({ status_id: `id-${i}`, perm: true }));

console.time('find');
const merged = statuses.map((status) => ({
  ...status,
  permissions: permissions.find((p) => p.status_id === status.id)
}));
console.timeEnd('find');

console.time('map');
const permMap = permissions.reduce((acc, p) => {
  acc[p.status_id] = p;
  return acc;
}, {} as Record<string, any>);
const mergedMap = statuses.map((status) => ({
  ...status,
  permissions: permMap[status.id]
}));
console.timeEnd('map');
