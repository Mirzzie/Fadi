-- D1 schema for the Fadi portfolio collector.
-- No visitor identity is stored: `visitor` is a salted hash that changes daily.
create table if not exists events (
  id         integer primary key autoincrement,
  handle     text not null,
  type       text not null,
  visitor    text not null,
  automated  integer not null default 0,
  self       integer not null default 0,
  item_id    text,
  title      text,
  role       text,
  interest   text,
  created_at text not null,
  -- Edge context as JSON: country, city, region, timezone, network, device class,
  -- the referring hostname, and which kind of contact was clicked. One column so a
  -- new signal never needs another migration against a live database.
  context    text
);

-- The export drain reads strictly by id, so this is the only index that matters.
create index if not exists events_handle_idx on events (handle, id);

-- Visitor feedback on the portfolio and the work it shows. Separate from `events`
-- because it carries free text a person wrote, not a counted interaction: it needs
-- length, it needs reading, and it must never be summed into a statistic.
create table if not exists feedback (
  id         integer primary key autoincrement,
  handle     text not null,
  kind       text not null,
  message    text not null,
  from_name  text,
  contact    text,
  visitor    text,
  created_at text not null
);
create index if not exists feedback_handle_idx on feedback (handle, id);

-- Alert cooldowns. Not analytics: the only thing recorded is when this Worker last
-- interrupted the owner about a given kind of event, so one visitor clicking twice
-- does not send two notifications.
create table if not exists alerts (
  handle    text not null,
  kind      text not null,
  last_sent text not null,
  primary key (handle, kind)
);
