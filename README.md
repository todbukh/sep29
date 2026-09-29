# sep29

## Transaction filter indexes

Migration `migrations/0001_add_transaction_filter_indexes.sql` adds:

- `transactions (user_id, transaction_date DESC)` for user/date-range filtering
- `transactions (user_id, category_id)` for user/category filtering

`category_id` remains nullable to support uncategorized transactions; this migration only adds indexes and does not change column nullability.

If single-column indexes already exist on `user_id`, `transaction_date`, or `category_id`, review them after rollout because some may become redundant.

Representative verification query:

```sql
EXPLAIN
SELECT *
FROM transactions
WHERE user_id = 42
  AND transaction_date BETWEEN DATE '2026-01-01' AND DATE '2026-01-31'
  AND (category_id = 9 OR category_id IS NULL)
ORDER BY transaction_date DESC
LIMIT 50;
```

Expected plan shape should include index usage, for example:

```text
Limit
  ->  Index Scan using idx_transactions_user_date_desc on transactions
        Index Cond: ((user_id = 42) AND (transaction_date >= '2026-01-01'::date) AND (transaction_date <= '2026-01-31'::date))
        Filter: ((category_id = 9) OR (category_id IS NULL))
```