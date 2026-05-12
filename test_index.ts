const list = Array.from({length: 1000}, (_, i) => ({ id: `id-${i}` }));

console.time('find');
for (let i = 0; i < 1000; i++) {
  list.find(x => x.id === `id-${i}`);
}
console.timeEnd('find');

console.time('map');
const map = new Map(list.map(x => [x.id, x]));
for (let i = 0; i < 1000; i++) {
  map.get(`id-${i}`);
}
console.timeEnd('map');
