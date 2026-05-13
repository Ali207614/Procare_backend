
To fix the N+1 while retaining the early exit performance boost:

Instead of `Promise.all` across ALL candidate orders in `checkForRecentInvalidDuplicatesOrThrow` and losing the early exit, we can rewrite the loop slightly.
If we leave the loop as it is, we have N+1.
If we use `Promise.all` but throw as soon as one resolves, `Promise.all` doesn't do short-circuiting on success (it short-circuits on rejection). We can use `Promise.any` if we invert the logic? No, `Promise.any` resolves when ANY promise resolves successfully. `isInvalidRepairOrderReusable` returns `true` or `false` without throwing.
If we map them to promises that reject when true?

Wait! Why did the user say we can optimize this "using bulk operations or a single query with an IN clause"?
Because querying `getStatusDetails(order.status_id)` and `getInvalidStatusEntryInfo(order.id)` for *each* order inside `isInvalidRepairOrderReusable` is the real problem!
But wait!
In `checkForRecentInvalidDuplicatesOrThrow`, `candidateOrders` ALREADY has `invalidStatusIds.includes(order.status_id)`.
So `isInvalidStatus(status)` is ALWAYS true.
We could bypass `getStatusDetails(order.status_id)` entirely for these orders, because we literally just filtered them by `invalidStatusIds`!

If we look at `isInvalidRepairOrderReusable`:
```typescript
  private async isInvalidRepairOrderReusable(
    order: RepairOrder,
    trx?: Knex | Knex.Transaction,
  ): Promise<boolean> {
    const db = trx || this.knex;
    const status = await this.getStatusDetails(db, order.status_id);
    if (!status || !this.isInvalidStatus(status)) {
      return false;
    }

    const { count, latestDate } = await this.getInvalidStatusEntryInfo(order.id, db);

    const initialStatusIsInvalid =
      count === 0 &&
      (await db('repair_order_statuses').where({ id: order.status_id, type: 'Invalid' }).first());

    const totalInvalidEntries = count + (initialStatusIsInvalid ? 1 : 0);

    if (totalInvalidEntries >= 2) {
      return false;
    }

    if (latestDate) {
      return isWithinCalendarDays(latestDate, 3);
    }

    return isWithinCalendarDays(order.updated_at || order.created_at, 3);
  }
```

Wait, `getInvalidStatusEntryInfo(order.id)` queries `repair_order_change_histories` AND `repair_order_statuses` (to get invalidStatusIds again!).
In `checkForRecentInvalidDuplicatesOrThrow`, we already fetched `invalidStatusIds`!
We are repeating `invalidStatusIds` fetch for every candidate order!
And we are fetching `statusDetails` for every candidate order!
And we are fetching `initialStatusIsInvalid` for every candidate order!

So instead of calling `isInvalidRepairOrderReusable` which does all this redundant work, we can inline or pass `invalidStatusIds` to avoid querying it multiple times, AND we can do a single query to get the `count` and `latestDate` for ALL `candidateOrders` at once using an IN clause!

```typescript
    const orderIds = candidateOrders.map((o) => o.id);
    const historyEntries = await trx('repair_order_change_histories')
      .whereIn('repair_order_id', orderIds)
      .where({ field: 'status_id' })
      .whereIn(
        'new_value',
        invalidStatusIds.map((id) => JSON.stringify(id)),
      )
      .select('repair_order_id', 'created_at')
      .orderBy('created_at', 'desc');

    // For each order, we can check if it's reusable
    for (const order of candidateOrders) {
      const orderEntries = historyEntries.filter(e => e.repair_order_id === order.id);
      const count = orderEntries.length;
      const latestDate = count > 0 ? new Date(orderEntries[0].created_at) : null;

      const initialStatusIsInvalid = count === 0; // because we know order.status_id is in invalidStatusIds

      const totalInvalidEntries = count + (initialStatusIsInvalid ? 1 : 0);

      if (totalInvalidEntries >= 2) {
        continue; // not reusable, check next
      }

      const isReusable = latestDate
        ? isWithinCalendarDays(latestDate, 3)
        : isWithinCalendarDays(order.updated_at || order.created_at, 3);

      if (isReusable) {
        throw new BadRequestException({
          message: `Ushbu mijoz va telefon uchun oxirgi 3 kalendar kuni ichida "Sifatsiz" statusidagi buyurtma mavjud. Iltimos, keyinroq urinib ko'ring yoki mavjud buyurtmani tekshiring.`,
          location: 'phone_category_id',
        });
      }
    }

```

This is EXACTLY what the user wanted:
"Database operation inside a loop detected. Can likely be optimized using bulk operations or a single query with an IN clause."

Let's do this!
