-- DigitalOcean Postgres schema for migrating off Firebase Firestore.
-- Paths match Firestore document paths (including subcollections), e.g.:
--   orders/{id}, items/{id}, configurator_parts/{id}/options/{optId}, admin_settings/{docId}, ...

BEGIN;

CREATE TABLE IF NOT EXISTS documents (
    path TEXT PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS documents_data_status ON documents ((data ->> 'status')) WHERE path LIKE 'orders/%';
CREATE INDEX IF NOT EXISTS documents_orders_created ON documents (
    COALESCE(
        created_at,
        CASE
            WHEN jsonb_typeof(data -> 'createdAt') = 'string'
            THEN (data ->> 'createdAt')::timestamptz
            ELSE NULL
        END
    )
) WHERE path LIKE 'orders/%';

CREATE INDEX IF NOT EXISTS documents_discount_codes_upper ON documents (path)
    WHERE path LIKE 'discount_codes/%';

CREATE INDEX IF NOT EXISTS documents_items_itemnumber ON documents ((data ->> 'itemNumber'))
    WHERE path LIKE 'items/%';

CREATE INDEX IF NOT EXISTS documents_items_barcode ON documents ((data ->> 'barcode'))
    WHERE path LIKE 'items/%';

CREATE INDEX IF NOT EXISTS documents_abandoned_status ON documents ((data ->> 'status'))
    WHERE path LIKE 'abandoned_carts/%';

CREATE INDEX IF NOT EXISTS documents_abandoned_email ON documents ((lower(data ->> 'email')))
    WHERE path LIKE 'abandoned_carts/%';

-- Admin UI auth (Firebase Auth passwords are not exportable; create a new user after migration)
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;
