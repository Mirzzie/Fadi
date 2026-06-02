# @careeros/database

PostgreSQL-first database package for CareerOS AI.

This package owns:

- Drizzle schema definitions.
- PostgreSQL migrations.
- Database client creation.
- Repository modules for app-owned persistence.

Supabase Auth remains temporarily supported at the application boundary, but domain data should move toward this package.
