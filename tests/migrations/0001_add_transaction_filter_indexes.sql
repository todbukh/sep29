\set ON_ERROR_STOP on

DROP SCHEMA IF EXISTS migration_test_0001 CASCADE;
CREATE SCHEMA migration_test_0001;
SET search_path TO migration_test_0001;

CREATE TABLE transactions (
  transaction_id bigint PRIMARY KEY,
  user_id bigint NOT NULL,
  transaction_date date NOT NULL,
  category_id bigint
);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_user_date_desc
  ON transactions (user_id, transaction_date DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_user_category
  ON transactions (user_id, category_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'migration_test_0001'
      AND indexname = 'idx_transactions_user_date_desc'
      AND indexdef LIKE '%(user_id, transaction_date DESC)%'
  ) THEN
    RAISE EXCEPTION 'date index is missing or has the wrong definition';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'migration_test_0001'
      AND indexname = 'idx_transactions_user_category'
      AND indexdef LIKE '%(user_id, category_id)%'
  ) THEN
    RAISE EXCEPTION 'category index is missing or has the wrong definition';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_index
    WHERE indrelid = 'migration_test_0001.transactions'::regclass
      AND NOT (indisready AND indisvalid)
  ) THEN
    RAISE EXCEPTION 'transaction filter index is not ready and valid';
  END IF;
END
$$;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_user_date_desc
  ON transactions (user_id, transaction_date DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_user_category
  ON transactions (user_id, category_id);

DO $$
BEGIN
  IF (
    SELECT count(*)
    FROM pg_indexes
    WHERE schemaname = 'migration_test_0001'
      AND indexname IN (
        'idx_transactions_user_date_desc',
        'idx_transactions_user_category'
      )
  ) <> 2 THEN
    RAISE EXCEPTION 'rerunning the up migration did not remain idempotent';
  END IF;
END
$$;

DROP INDEX CONCURRENTLY IF EXISTS idx_transactions_user_category;
DROP INDEX CONCURRENTLY IF EXISTS idx_transactions_user_date_desc;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'migration_test_0001'
      AND indexname IN (
        'idx_transactions_user_date_desc',
        'idx_transactions_user_category'
      )
  ) THEN
    RAISE EXCEPTION 'down migration did not remove both indexes';
  END IF;
END
$$;

DROP SCHEMA migration_test_0001 CASCADE;