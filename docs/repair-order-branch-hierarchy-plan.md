# Repair Order Branch Hierarchy Plan

## Agreed Rules

1. There is exactly one Mother Branch in the system.
2. The existing protected system branch is the Mother Branch:
   `00000000-0000-4000-8000-000000000000`.
3. Every other active branch is a child of the Mother Branch.
4. Automatically created repair orders, including OnlinePBX and public web leads, are stored only in the Mother Branch.
5. Child branches can take repair orders only from the Mother Branch.
6. Taking an order moves the order to the child branch. The source branch should be preserved in history, not as a required permanent ownership column.
7. A child branch has read-only access to Mother Branch orders until it takes the order.
8. Returning an order back to Mother is not supported.
9. Admins can change a repair order branch from one child to another only across branches they are allowed to view.
10. Manual repair order branch assignment is accepted only for child branches.
11. The Mother Branch can view all repair orders from Mother and all child branches.
12. Child branches can view their own repair orders in Kanban. Mother orders that are available to take can be visible as read-only.
13. Search works across all branches visible to the current admin.
14. Super Admin has access to everything across Mother and all child branches.
15. Child-hidden statuses are still shown, but must be marked as hidden/disabled for that child branch.
16. Repair order status transitions are role-based only. Branch should not affect transition availability.

## Current Architecture Conflict

The current backend treats branches as independent status owners:

- `repair_order_statuses.branch_id` means each branch owns its own status list.
- `repair_order_status_permissions.branch_id` scopes status permissions to one branch.
- Kanban SQL filters a single branch with `ro.branch_id = :branchId`.
- Direct order access checks permissions against the order branch only.
- Branch creation currently creates default statuses per new branch.

The new model keeps `repair_orders.branch_id` as the current owner branch, but makes the Mother Branch the canonical status owner.

## Data Model Plan

### Branch Hierarchy

Add `branches.parent_branch_id`:

- Mother: `parent_branch_id = NULL`.
- All children: `parent_branch_id = '00000000-0000-4000-8000-000000000000'`.
- Add an index on `branches.parent_branch_id`.
- Add a check or service-level guard preventing nested children.

Migration behavior:

- Ensure the protected system branch exists and remains active.
- Set every non-mother branch parent to the Mother Branch.
- Keep existing branch IDs stable.

### Status Ownership

Use Mother Branch statuses as the canonical repair order status list:

- New repair orders in child branches use Mother status IDs.
- New child branches should not receive their own default status rows.
- Existing child status rows should be migrated or phased out after mapping orders to matching Mother statuses.
- `repair_order_statuses.branch_id` can remain for compatibility, but the application should resolve status scope through the Mother Branch.

Status migration risk:

- Existing child orders may reference child-specific status IDs. We need a mapping by protected type first, then by normalized names.
- If a child status cannot be mapped to a Mother status, migration should stop and report the unmapped rows.

### Status Permissions

Keep `repair_order_status_permissions.branch_id` as the viewing/admin-context branch:

- Mother permissions apply when acting in Mother scope.
- Child permissions apply when acting in that child branch.
- `status_id` points to Mother status IDs.
- Hidden statuses are included in responses but marked, for example:
  `is_hidden_for_branch: true` or `permissions.can_view: false`.

Transition rules:

- Remove branch-dependent transition resolution.
- Resolve transitions by `role_id` only, with fallback to global role-null transitions if that existing fallback remains required.

## Service Refactor Plan

Create a central branch visibility helper/service before changing endpoints:

- `getMotherBranchId()` returns the protected Mother ID.
- `isMotherBranch(branchId)`.
- `getChildBranchIds()`.
- `getAdminAssignedBranchIds(adminId)`.
- `getVisibleBranchIds(admin)`:
  - Super Admin: Mother + all children.
  - Mother admin: Mother + all children.
  - Child admin: assigned child branches plus Mother for read-only/take search.
- `getWritableBranchIds(admin)`:
  - Super Admin: all child branches plus Mother only for auto/system flows.
  - Mother admin: child branches for manual assignment, Mother for internal/system flows.
  - Child admin: assigned child branches only.
- `getCanonicalStatusBranchId()` returns Mother ID.
- `getBranchStatusPermissions(admin, viewerBranchId)` loads permissions for Mother status IDs in that viewer branch context.

All repair-order read/write paths should use this helper instead of directly trusting request `branch_id`.

## Endpoint Behavior Plan

### Kanban List

`GET /repair-orders/viewable?branch_id=...`

Mother branch request:

- Includes repair orders where `branch_id IN (Mother + children)`.
- Uses Mother status list.
- Groups by Mother status IDs.

Child branch request:

- Includes own child orders.
- Also includes take-eligible Mother orders as read-only if product wants them on the same board.
- Uses Mother status list.
- Hidden statuses still appear with a marker.

Security:

- Requested `branch_id` must be in admin visible branch scope.
- Query must never rely on frontend branch ID alone.

### Search

Search must use visible branch IDs:

- Super Admin: all branches.
- Mother admin: Mother + children.
- Child admin: Mother + assigned child branches.

Returned records must include effective access flags:

- `can_take`
- `is_read_only`
- `is_hidden_status_for_branch`
- `current_owner_branch`

### Take Order

Add a dedicated endpoint:

`PATCH /repair-orders/:repair_order_id/take`

Rules:

- Only a child branch can take.
- Order must currently belong to Mother.
- Admin must be allowed to act in the target child branch.
- Target child branch must be active and under Mother.
- Use a transaction and row lock on the repair order.
- Update `repair_orders.branch_id` to the child branch.
- Preserve the old Mother branch in history via `branch_id` change log.
- Re-sort into the target child branch/status queue.
- Flush Mother and child caches.
- Notify Mother and child branch rooms.

Race protection:

- `SELECT ... FOR UPDATE` the order before checking `branch_id`.
- If branch is no longer Mother, return a conflict-style error.

### Transfer Branch

Rules:

- Manual target branch must be a child branch.
- Admin must be allowed to view/write both current and target branches.
- Super Admin can transfer across all child branches.
- No transfer back to Mother.
- Preserve branch changes in history.

### Create Repair Order

Manual admin create:

- `branch_id` must be child branch only.
- Status must be a Mother status.
- Permission context uses target child branch + Mother status ID.

Automatic create:

- OnlinePBX and public web leads always use Mother branch.
- Status must be a Mother status.
- No frontend/admin input can override this.

## Critical Security Checklist

1. Direct ID reads must check visibility against derived visible branch IDs.
2. Direct updates, moves, deletes, comments, attachments, pickup, delivery, rental phone, and problem edits must reject read-only Mother orders for child admins.
3. Child admins must not update Mother orders before taking them.
4. Child admins must not see other child orders by direct ID, list, search, comments, or attachments.
5. Hidden statuses must not disappear silently; they should be marked and their orders should remain governed by read/write permissions.
6. Cache keys must include admin ID, selected branch ID, visible branch IDs, status permission scope, filters, sort, limit, and offset.
7. Cache invalidation must clear Mother and affected child prefixes after take/transfer/move/update/create.
8. Notification targets must respect the effective branch scope.
9. Webhooks must not leak child branch URLs for Mother-only auto-created orders unless the order has been taken.
10. Status transition validation must not use branch-specific status ownership.
11. Existing child status IDs must be migrated safely before enforcing Mother-only statuses.
12. Every branch-changing operation must write history.

## Test Plan

Add or update tests for:

- Mother sees Mother and all child repair orders.
- Child sees own orders and read-only Mother orders.
- Child cannot see another child order by list/search/direct ID.
- Child cannot edit Mother order before taking.
- Child can take an untaken Mother order.
- Two children trying to take the same Mother order result in one success.
- Child cannot transfer order to Mother.
- Child can transfer only to viewable child branches.
- Manual create rejects Mother branch target.
- OnlinePBX/public web create always stores in Mother.
- Hidden statuses appear with a marker.
- Transitions are resolved by role only, not branch.
- Cache does not leak Mother/Super Admin results to child admin.

## Suggested Implementation Order

1. Add branch hierarchy migration and type/DTO support.
2. Add branch visibility helper and tests.
3. Migrate/create Mother status scope helpers.
4. Update status permissions to use Mother status IDs per viewer branch.
5. Rewrite Kanban/search SQL for visible branch IDs and hidden-status markers.
6. Harden direct order read and write authorization.
7. Add take endpoint with transactional lock.
8. Update transfer branch rules.
9. Update manual create and automatic create paths.
10. Update notifications, webhooks, cache keys, and invalidation.
11. Add migration/backfill tests and security regression tests.

