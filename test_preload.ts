const missingIds = Array.from({length: 1000}, (_, i) => `id-${i}`);
const rows = Array.from({length: 1000}, (_, i) => ({ id: `id-${i}`, val: i }));

console.time('find');
let sum = 0;
for (const id of missingIds) {
  const row = rows.find((r) => r.id === id);
  if (row) sum += row.val;
}
console.timeEnd('find');

console.time('map');
let sum2 = 0;
const rowMap = new Map(rows.map(r => [r.id, r]));
for (const id of missingIds) {
  const row = rowMap.get(id);
  if (row) sum2 += row.val;
}
console.timeEnd('map');
