-- Adds the per-event context column to an ALREADY DEPLOYED collector.
--
-- schema.sql uses `create table if not exists`, which does nothing to a table that
-- already exists — so a new column has to be added explicitly. SQLite has no
-- `add column if not exists`, so re-running this errors with "duplicate column name".
-- That error is harmless and means the column is already there.
--
-- One JSON column rather than one column per signal: this is an append-only event log,
-- and adding a signal later must not mean migrating a live database again.
alter table events add column context text;
