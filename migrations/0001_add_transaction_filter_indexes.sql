-- up
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_user_date_desc
  ON transactions (user_id, transaction_date DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_user_category
  ON transactions (user_id, category_id);

-- down
DROP INDEX CONCURRENTLY IF EXISTS idx_transactions_user_category;
DROP INDEX CONCURRENTLY IF EXISTS idx_transactions_user_date_desc;
