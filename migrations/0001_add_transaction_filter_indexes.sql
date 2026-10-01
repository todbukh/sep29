-- up
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class index_class
    JOIN pg_namespace index_schema ON index_schema.oid = index_class.relnamespace
    JOIN pg_index index_metadata ON index_metadata.indexrelid = index_class.oid
    WHERE index_schema.nspname = current_schema()
      AND index_class.relname = 'idx_transactions_user_date_desc'
      AND NOT index_metadata.indisvalid
  ) THEN
    RAISE EXCEPTION 'invalid index idx_transactions_user_date_desc exists; drop it with DROP INDEX CONCURRENTLY before retrying';
  END IF;
END
$$;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_user_date_desc
  ON transactions (user_id, transaction_date DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class index_class
    JOIN pg_namespace index_schema ON index_schema.oid = index_class.relnamespace
    JOIN pg_index index_metadata ON index_metadata.indexrelid = index_class.oid
    WHERE index_schema.nspname = current_schema()
      AND index_class.relname = 'idx_transactions_user_category'
      AND NOT index_metadata.indisvalid
  ) THEN
    RAISE EXCEPTION 'invalid index idx_transactions_user_category exists; drop it with DROP INDEX CONCURRENTLY before retrying';
  END IF;
END
$$;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_user_category
  ON transactions (user_id, category_id);

-- down
DROP INDEX CONCURRENTLY IF EXISTS idx_transactions_user_category;
DROP INDEX CONCURRENTLY IF EXISTS idx_transactions_user_date_desc;
