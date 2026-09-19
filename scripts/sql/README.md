# Account Sync Database Contract

`typewords-account-schema.sql` bootstraps an empty Supabase project. It is not a
legacy-table migration and intentionally fails if `public.typewords_data` exists.
Inspect existing objects and data before applying it. Never drop an existing
table to make this script succeed.

The account key is `(user_id, type)`. Authenticated clients must supply the
current user's ID on every write and use `onConflict: 'user_id,type'`. Reads
should filter by the same ID. RLS enforces ownership independently of those
client filters. Only SELECT, INSERT and UPDATE are granted; anonymous access and
client DELETE are not supported. The primary key also indexes the ownership
predicate. No privileged RPC, view, trigger, or extra schema is introduced.

Rows require a positive integer version and finite timestamp supplied by the
client. Dictionary and settings data must be JSON objects; practice caches may
also be null. Application payload validation remains necessary. An empty account
has zero rows, not four unversioned placeholder objects. Initial upload must be
an explicit user choice after login and backup, never a side effect of checking
credentials or signing in.

The current frontend still uses the old unauthenticated contract and is NOT
compatible yet. Do not enable real learning-data sync until login/logout,
session/account-change guards, all query/upsert paths, and first-sync UI are
adapted and verified. Preserve local IndexedDB and ZIP formats.

## Verification

`tests/desktop/sql/account-rls.sql` is an explicit management-SQL integration
test, not part of the default offline Node tests. Run it only in the authorized
test project. It refuses a nonempty table and requires exactly one confirmed,
password-enabled, non-anonymous account. It reads that account's ID internally,
does not return it, and never reads the password hash.

All synthetic writes occur in a transaction ending in ROLLBACK. The test changes
the transaction-local Postgres role and JWT claims to exercise RLS. This verifies
actual database enforcement, but does NOT verify password login, JWT signature
validation, REST grants/schema-cache behavior, a second real account, or
Web/Desktop UI. After running, independently check that the table is empty and
inspect policies, grants, and Supabase security advisors.
