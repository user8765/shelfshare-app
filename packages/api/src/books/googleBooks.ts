interface BookMetadata {
  title: string;
  author: string | undefined;
  genre: string | undefined;
  coverUrl: string | undefined;
  description: string | undefined;
}

interface GoogleBooksResponse {
  items?: Array<{
    volumeInfo: {
      title?: string;
      authors?: string[];
      categories?: string[];
      description?: string;
      imageLinks?: { thumbnail?: string };
    };
  }>;
}

export async function lookupIsbn(isbn: string): Promise<BookMetadata | null> {
  const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`;
  const res = await fetch(url);
  const data = await res.json() as GoogleBooksResponse;

  const info = data.items?.[0]?.volumeInfo;
  if (!info) return null;

  return {
    title: info.title ?? '',
    author: info.authors?.[0],
    genre: info.categories?.[0],
    coverUrl: info.imageLinks?.thumbnail,
    description: info.description,
  };
}
