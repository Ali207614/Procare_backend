## 2023-10-25 - Parallelizing PDF page generation
**Learning:** Found sequential page rendering using Puppeteer within `src/pdf/pdf.service.ts` using `for...of` loops and `await`. Puppeteer tabs (pages) can be generated in parallel within the same browser instance, yielding massive speed improvements, especially when multiple heavy pages are rendered.
**Action:** Used `Promise.all` alongside `.map()` to render tabs in parallel, storing output buffers in arrays to maintain correct page order for merging into the final document.
## 2024-05-10 - Optimizing N+1 Database Queries

**Learning:** When dealing with functions that process arrays of identifiers using `Promise.all(ids.map(id => fetchById(id)))`, there is often an N+1 query vulnerability if the individual `fetchById` function queries the database per invocation. Batch querying using `knex.whereIn` followed by cache pre-filling is an effective way to optimize these patterns while preserving existing logic and caching mechanisms.

**Action:** Before executing `Promise.all` over an array of IDs, filter out IDs already present in a local lookup cache, run a single `whereIn` database query for the missing IDs, populate the local cache with the results (including nulls for missing records), and then proceed with the original `Promise.all` which will now hit the cache instantly instead of generating multiple database queries.
## 2026-05-12 - Prevent N+1 loops using Map caching
**Learning:** Found O(N^2) complexity bottlenecks in `repair-order-history-comment-manager.ts` and `repair-order-statuses.service.ts` where an array was mapped/looped over and `Array.prototype.find()` was used inside to look up related records.
**Action:** Always pre-compute a `Map` of related records mapped by ID before the loop when joining arrays in memory, so the lookup within the loop is O(1) instead of O(N). This reduces the total time complexity from O(N^2) to O(N).
