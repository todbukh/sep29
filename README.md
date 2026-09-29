# sep29

## Transaction filter indexes

Migration `/home/runner/work/sep29/sep29/migrations/0001_add_transaction_filter_indexes.sql` adds:

- `transactions (user_id, transaction_date DESC)` for user/date-range filtering
- `transactions (user_id, category_id)` for user/category filtering

`category_id` remains nullable to support uncategorized transactions; this migration only adds indexes and does not change column nullability.

If single-column indexes already exist on `user_id`, `transaction_date`, or `category_id`, review them after rollout because some may become redundant.