-- Full-text search vector on books
ALTER TABLE books ADD COLUMN IF NOT EXISTS search_vector TSVECTOR;

UPDATE books SET search_vector =
  to_tsvector('english', coalesce(title,'') || ' ' || coalesce(author,'') || ' ' || coalesce(genre,''));

CREATE INDEX books_search_idx ON books USING GIN (search_vector);

-- Auto-update search_vector on insert/update
CREATE OR REPLACE FUNCTION books_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    to_tsvector('english', coalesce(NEW.title,'') || ' ' || coalesce(NEW.author,'') || ' ' || coalesce(NEW.genre,''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER books_search_vector_trigger
  BEFORE INSERT OR UPDATE ON books
  FOR EACH ROW EXECUTE FUNCTION books_search_vector_update();
