CREATE TABLE system_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO system_config (key, value) VALUES ('borrow_request_expiry_hours', '48');

CREATE TABLE borrow_requests (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id                UUID NOT NULL REFERENCES books(id),
  requester_id           UUID NOT NULL REFERENCES users(id),
  status                 TEXT NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','accepted','declined','expired','returned')),
  due_date               DATE,
  proposed_due_date      DATE,
  extension_proposed_by  UUID REFERENCES users(id),
  request_expires_at     TIMESTAMPTZ NOT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX borrow_requests_book_idx      ON borrow_requests (book_id);
CREATE INDEX borrow_requests_requester_idx ON borrow_requests (requester_id);
CREATE INDEX borrow_requests_expiry_idx    ON borrow_requests (request_expires_at) WHERE status = 'pending';
