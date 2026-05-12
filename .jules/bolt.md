## 2023-10-25 - Parallelizing PDF page generation
**Learning:** Found sequential page rendering using Puppeteer within `src/pdf/pdf.service.ts` using `for...of` loops and `await`. Puppeteer tabs (pages) can be generated in parallel within the same browser instance, yielding massive speed improvements, especially when multiple heavy pages are rendered.
**Action:** Used `Promise.all` alongside `.map()` to render tabs in parallel, storing output buffers in arrays to maintain correct page order for merging into the final document.
## 2024-05-10 - Optimizing N+1 Database Queries

**Learning:** When dealing with functions that process arrays of identifiers using `Promise.all(ids.map(id => fetchById(id)))`, there is often an N+1 query vulnerability if the individual `fetchById` function queries the database per invocation. Batch querying using `knex.whereIn` followed by cache pre-filling is an effective way to optimize these patterns while preserving existing logic and caching mechanisms.

**Action:** Before executing `Promise.all` over an array of IDs, filter out IDs already present in a local lookup cache, run a single `whereIn` database query for the missing IDs, populate the local cache with the results (including nulls for missing records), and then proceed with the original `Promise.all` which will now hit the cache instantly instead of generating multiple database queries.
## 2026-05-12 - Knex IN clause syntax
**Learning:** When using `trx.raw` in Knex to bind an array of IDs to a raw SQL string, using `WHERE id = ANY(?)` with an array binding `[orderIds]` results in a SQL syntax error because Knex automatically expands the array to a comma-separated list like `ANY('id1', 'id2')` instead of a single PostgreSQL array literal.
**Action:** Use standard SQL `WHERE id IN (?)` which properly expands the bound array into an `IN ('id1', 'id2')` structure inside `trx.raw`.
