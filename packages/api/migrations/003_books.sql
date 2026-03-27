CREATE TABLE books (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL REFERENCES users(id),
  isbn        TEXT,
  title       TEXT NOT NULL,
  author      TEXT,
  genre       TEXT,
  cover_url   TEXT,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'available'
                CHECK (status IN ('available','pending','lent_out','unavailable')),
  is_lendable BOOLEAN NOT NULL DEFAULT true,
  visibility  TEXT NOT NULL DEFAULT 'radius'
                CHECK (visibility IN ('radius','community','both','private')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX books_owner_idx ON books (owner_id);

CREATE TABLE book_communities (
  book_id      UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  community_id UUID NOT NULL,   -- FK to communities added in phase 4 migration
  PRIMARY KEY (book_id, community_id)
);
