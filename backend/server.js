// server.js - Backend API for Book Spine Scanner
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const redis = require('redis');
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');
const Papa = require('papaparse');
const multer = require('multer');
const mariadb = require('mariadb');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy - needed for Railway/Heroku/etc to get real IP addresses
app.set('trust proxy', 1);

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
);

// Configure multer for file uploads (in-memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// Redis client setup
let redisClient;
let isRedisReady = false;

(async () => {
  try {
    console.log('🔌 Initializing Redis connection...');
    // Redis connection - works with Upstash Redis or local Redis
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        keepAlive: 30000,
        connectTimeout: 10000,
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.log('❌ Redis: Too many retries, giving up');
            return new Error('Too many retries');
          }
          const delay = Math.min(Math.pow(2, retries) * 1000, 30000);
          console.log(`🔄 Redis: Reconnecting in ${delay}ms (attempt ${retries + 1}/10)`);
          return delay;
        }
      }
    });

    redisClient.on('error', (err) => {
      console.error('❌ Redis Client Error:', err.message);
      isRedisReady = false;
    });

    redisClient.on('ready', () => {
      console.log('✅ Redis: Connected and ready');
      isRedisReady = true;
    });

    redisClient.on('reconnecting', () => {
      console.log('🔄 Redis: Attempting to reconnect...');
      isRedisReady = false;
    });

    redisClient.on('end', () => {
      console.log('⚠️  Redis: Connection ended');
      isRedisReady = false;
    });

    redisClient.on('connect', () => {
      console.log('🔌 Redis: Socket connected');
    });

    await redisClient.connect();

    setInterval(async () => {
      if (isRedisReady) {
        try {
          await redisClient.ping();
          console.log('🏓 Redis: Keepalive ping successful');
        } catch (err) {
          console.error('⚠️  Redis: Keepalive ping failed:', err.message);
        }
      }
    }, 4 * 60 * 60 * 1000);
  } catch (err) {
    console.warn('⚠️  Redis not available, caching disabled:', err.message);
    isRedisReady = false;
  }
})();
let mariaPool;
let isMariaReady = false;

(async () => {
  try {
    console.log('🔌 Initializing MariaDB connection...');
    mariaPool = mariadb.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME || 'Goodreads',
      port: process.env.DB_PORT,
      connectionLimit: 50,
      acquireTimeout: 30000,
      connectTimeout: 15000,
      idleTimeout: 300000,
      minPoolSize: 5,
      leakDetectionTimeout: 30000
    });

    const conn = await mariaPool.getConnection();
    await conn.ping()
    conn.release();

    isMariaReady = true;
    console.log('✅ MariaDB: Connected and ready');

    {/*setInterval(async () => {
      if (!mariaPool) return;
      try {
        const conn = await mariaPool.getConnection();
        await conn.ping();
        conn.release();
        if (!isMariaReady) {
          isMariaReady = true;
          console.log('✅ MariaDB: Reconnected');
        }
      } catch(err) {
        console.error('⚠️ MariaDB health check failed:', err.message);
        isMariaReady = false;
      }
    }, 60000);  */}
  } catch (err) {
    console.warn('⚠️  MariaDB not available, Goodreads ratings disabled:', err.message);
    isMariaReady = false;
  }
})();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'https://shelfscan.xyz',
    'capacitor://localhost',
    'ionic://localhost',
    'http://localhost',
    'https://localhost',
    'http://localhost:3000',
  ],
  credentials: true
}));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Rate limiting - 10 requests per 15 minutes per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to scan endpoint
app.use('/api/scan', apiLimiter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  let mariaStats = null;
  if (mariaPool) {
    mariaStats = {
      activeConnections: mariaPool.activeConnections(),
      totalConnections: mariaPool.totalConnections(),
      idleConnections: mariaPool.idleConnections(),
      taskQueueSize: mariaPool.taskQueueSize()
    };
  }

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    redis: isRedisReady ? 'connected' : 'disconnected',
    mariadb: isMariaReady ? 'connected' : 'disconnected',
    mariadbPool: mariaStats
  });
});

// Helper function to get from cache
async function getFromCache(key) {
  if (!isRedisReady || !redisClient) {
    return null;
  }
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error('Redis GET error:', err.message);
    return null;
  }
}

// Helper function to set cache (30 days expiry)
async function setCache(key, value, expirySeconds = 2592000) {
  if (!isRedisReady || !redisClient) {
    return;
  }

  try {
    await redisClient.setEx(key, expirySeconds, JSON.stringify(value));
  } catch (err) {
    console.error('Redis SET error:', err.message);
  }
}

// Helper function to search Open Library
async function searchOpenLibrary(title, author) {
  try {
    const query = encodeURIComponent(`${title} ${author}`);
    const response = await fetch(
        `https://openlibrary.org/search.json?q=${query}&limit=1`
    );

    if (!response.ok) return null;

    const data = await response.json();

    if (data.docs && data.docs.length > 0) {
      const book = data.docs[0];

      // Open Library uses a rating system, try to get ratings
      let rating = 0;
      let ratingsCount = 0;

      // Get work key to fetch ratings
      if (book.key) {
        try {
          const workKey = book.key.replace('/works/', '');
          const ratingsResponse = await fetch(
              `https://openlibrary.org${book.key}/ratings.json`
          );

          if (ratingsResponse.ok) {
            const ratingsData = await ratingsResponse.json();
            if (ratingsData.summary && ratingsData.summary.average) {
              rating = ratingsData.summary.average;
              ratingsCount = ratingsData.summary.count || 0;
            }
          }
        } catch (e) {
          console.log('Could not fetch Open Library ratings');
        }
      }
      let thumbnail = book.cover_i
          ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`
          : null;

      return {
        title: book.title || title,
        author: book.author_name?.[0] || author,
        rating: rating,
        ratingsCount: ratingsCount,
        description: book.first_sentence?.[0] || '',
        thumbnail: thumbnail,
        isbn: book.isbn?.[0] || null,
        publishYear: book.first_publish_year || null,
        source: 'openlibrary'
      };
    }

    return null;
  } catch (error) {
    console.error('Open Library API error:', error.message);
    return null;
  }
}

// Helper function to search Google Books
async function searchGoogleBooks(title, author) {
  try {
    const query = encodeURIComponent(`${title} ${author}`);
    const response = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=1`
    );

    if (!response.ok) return null;

    const data = await response.json();

    if (data.items && data.items.length > 0) {
      const bookInfo = data.items[0].volumeInfo;

      // Get ISBN (prefer ISBN-13 over ISBN-10)
      let isbn = null;
      if (bookInfo.industryIdentifiers) {
        const isbn13 = bookInfo.industryIdentifiers.find(id => id.type === 'ISBN_13');
        const isbn10 = bookInfo.industryIdentifiers.find(id => id.type === 'ISBN_10');
        isbn = isbn13?.identifier || isbn10?.identifier || null;
      }

      let thumbnail = bookInfo.imageLinks?.thumbnail || null;
      if (thumbnail) {
        thumbnail = thumbnail.replace('http://', 'https://');
      }

      return {
        title: bookInfo.title || title,
        author: bookInfo.authors?.[0] || author,
        rating: bookInfo.averageRating || 0,
        ratingsCount: bookInfo.ratingsCount || 0,
        description: bookInfo.description || '',
        thumbnail: thumbnail,
        infoLink: bookInfo.infoLink || null,
        isbn: isbn,
        publishYear: bookInfo.publishedDate ? parseInt(bookInfo.publishedDate.substring(0, 4)) : null,
        source: 'google'
      };
    }
    return null;
  } catch (error) {
    console.error('Google Books API error:', error.message);
    return null;
  }
}
async function getMariaConnection(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await mariaPool.getConnection();
    } catch (err) {
      console.warn(`⚠️ MariaDB connection attempt ${i + 1}/${retries} failed: ${err.message}`);
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 1000 * (i+1)));
    }
  }
}
async function searchGoodreadsDB(isbn) {
  if (!isbn) return null;

  const cleanIsbn = isbn.replace(/[-\s]/g, '');
  const isbnVariants = [cleanIsbn];

  if (cleanIsbn.length === 13) {
    const isbn10 = isbn13to10(cleanIsbn);
    if (isbn10) isbnVariants.push(isbn10);
  } else if (cleanIsbn.length === 10) {
    const isbn13 = isbn10to13(cleanIsbn);
    if (isbn13) isbnVariants.push(isbn13);
  }

// Check Redis cache first (populated by warm-cache.js)
  if (isRedisReady) {
    for (const variant of isbnVariants) {
      const cached = await getFromCache(`goodreads:${variant}`);
      if (cached) {
        console.log(`✅ Goodreads cache hit: ${variant}`);
        return cached;
      }
    }
  }

  if (!isMariaReady || !mariaPool) {
    console.log('⚠️  MariaDB not available, skipping Goodreads lookup');
    return null;
  }

  let conn;
  try {
    conn = await getMariaConnection();

    const query = 'SELECT star_rating, num_ratings FROM Scrape WHERE isbn IN (?) LIMIT 1';
    const rows = await conn.query(query, [isbnVariants]);

    if (rows.length > 0) {
      const row = rows[0];
      const result = {
        rating: parseFloat(row.star_rating) || 0,
        ratingsCount: parseInt(row.num_ratings) || 0,
        source: 'goodreads'
      };

      if (isRedisReady) {
        await setCache(`goodreads:${cleanIsbn}`, result, 86400 * 90);
      }
      console.log(`✅ Goodreads DB hit: ${cleanIsbn} - ${result.rating}★`);
      return result;
    }


    {/* if (title && author) {
      const query = 'SELECT star_rating, num_ratings FROM Scrape WHERE name = ? AND author =? LIMIT 1';
      let rows = await conn.query(query, [title, author]);

      if (rows.length === 0) {
        const fuzzyQuery = 'SELECT star_rating, num_ratings FROM Scrape WHERE name LIKE ? AND author LIKE ? LIMIT 1';
        rows = await conn.query(fuzzyQuery, [`%${title}%`, `%${author}%`]);
      }

      if (rows.length > 0) {
        const row = rows[0];
        console.log(`✅ Goodreads DB match by title/author: "${title}" - Rating: ${row.star_rating}`);
        return {
          rating: parseFloat(row.star_rating) || 0,
          ratingsCount: parseInt(row.num_ratings) || 0,
          source: 'goodreads'
        };
      }
    }*/}
    console.log(`❌ No Goodreads match for: "${cleanIsbn}`);
    return null;

  } catch (err) {
    console.error("Error occurred with Goodreads Rating Retrieval:", err.message);
    return null;
  } finally {
    if (conn) {
      conn.release();
    }
  }
}
function isbn10to13(isbn10) {
  if (!isbn10 || isbn10.length !==10) return null;
  const base = '978' + isbn10.substring(0,9);

  let sum = 0;
  for (let i = 0; i < 12; i ++) {
    sum += parseInt(base[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const checksum = (10 - (sum % 10)) % 10;
  return base + checksum.toString();
}




// Helper function to merge book data from multiple sources
// Helper function to convert ISBN-13 to ISBN-10
function isbn13to10(isbn13) {
  if (!isbn13 || isbn13.length !== 13) return null;

  // ISBN-10 can only be converted from ISBN-13 starting with 978
  if (!isbn13.startsWith('978')) return null;

  // Remove the 978 prefix and last digit (checksum)
  const base = isbn13.substring(3, 12);

  // Calculate ISBN-10 checksum
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(base[i]) * (10 - i);
  }
  let checksum = (11 - (sum % 11)) % 11;
  checksum = checksum === 10 ? 'X' : checksum.toString();

  return base + checksum;
}

// Helper function to merge book data from multiple sources
function mergeBookData(googleBook, openLibBook, goodreadsRating, originalTitle, originalAuthor) {
  // If we have no data from any source, return null
  if (!googleBook && !openLibBook) return null;

  // Priority: Google Books > Open Library for ratings
  let rating = 0;
  let ratingsCount = 0;
  let ratingSource = 'No ratings available';

  if (goodreadsRating?.rating > 0) {
    rating = goodreadsRating.rating;
    ratingsCount = goodreadsRating.ratingsCount;
    ratingSource = `Goodreads (${ratingsCount.toLocaleString()} ratings)`;
  } else if (googleBook?.rating > 0) {
    rating = googleBook.rating;
    ratingsCount = googleBook.ratingsCount;
    ratingSource = `Google Books (${ratingsCount.toLocaleString()} reviews)`;
  } else if (openLibBook?.rating > 0) {
    rating = openLibBook.rating;
    ratingsCount = openLibBook.ratingsCount;
    ratingSource = `Open Library (${ratingsCount.toLocaleString()} reviews)`;
  }

  // Use Google Books as primary for other data (most complete)
  const primary = googleBook || openLibBook || {};
  const secondary = openLibBook || googleBook || {};

  // Get ISBN for links
  const isbn = primary.isbn || secondary.isbn;

  // *** AMAZON AFFILIATE INTEGRATION ***
  const AMAZON_AFFILIATE_TAG = process.env.AMAZON_AFFILIATE_TAG || 'shelfscan05-20';

  // Create Amazon URL with affiliate tag
  let amazonUrl;
  if (isbn) {
    // Clean ISBN (remove hyphens and spaces)
    const cleanIsbn = isbn.replace(/[-\s]/g, '');

    // Try to use ISBN-10 for Amazon /dp/ links (they work better)
    let amazonIsbn = cleanIsbn;

    // If it's ISBN-13, try to convert to ISBN-10
    if (cleanIsbn.length === 13) {
      const isbn10 = isbn13to10(cleanIsbn);
      if (isbn10) {
        amazonIsbn = isbn10;
        console.log(`Converted ISBN-13 ${cleanIsbn} to ISBN-10 ${isbn10}`);
      }
    }

    // Use direct product link if we have ISBN-10, otherwise use search
    if (amazonIsbn.length === 10) {
      //amazonUrl = `https://www.amazon.com/dp/${amazonIsbn}?tag=${AMAZON_AFFILIATE_TAG}`;
        amazonUrl = `https://www.amazon.com/dp/${amazonIsbn}`;
    } else {
      // ISBN-13 or unexpected format - use search with ISBN
      const searchQuery = encodeURIComponent(`${originalTitle} ${originalAuthor} ISBN ${cleanIsbn}`);
      amazonUrl = `https://www.amazon.com/s?k=${searchQuery}`;
      console.log(`Using search URL for ISBN: ${cleanIsbn}`);
    }
  } else {
    // No ISBN available, create a search link
    const searchQuery = encodeURIComponent(`${originalTitle} ${originalAuthor}`);
    //amazonUrl = `https://www.amazon.com/s?k=${searchQuery}&tag=${AMAZON_AFFILIATE_TAG}`;
    amazonUrl = `https://www.amazon.com/s?k=${searchQuery}`;

    console.log(`No ISBN - using title/author search for: ${originalTitle}`);
  }
  console.log(`📚 ${originalTitle}: Amazon URL = ${amazonUrl}`);

  return {
    title: primary.title || originalTitle,
    author: primary.author || originalAuthor,
    rating: rating,
    ratingsCount: ratingsCount,
    ratingSource: ratingSource,
    description: (primary.description?.length > (secondary.description?.length || 0))
        ? primary.description
        : (secondary.description || primary.description || 'No description available'),
    thumbnail: primary.thumbnail || secondary.thumbnail || null,
    infoLink: googleBook?.infoLink || null,
    isbn: isbn,
    publishYear: primary.publishYear || secondary.publishYear || null,
    goodreadsUrl: isbn ? `https://www.goodreads.com/book/isbn/${isbn}` :
        `https://www.goodreads.com/search?q=${encodeURIComponent(`${originalTitle} ${originalAuthor}`)}`,
    // *** Amazon Affiliate Link ***
    amazonUrl: amazonUrl,
    sources: [
      googleBook ? 'Google Books' : null,
      openLibBook ? 'Open Library' : null
    ].filter(Boolean)
  };
}
// Helper function to check if book is in reading list
function checkReadingList(book, readingList) {
  if (!readingList || readingList.length === 0) return null;

  const normalizeString = (str) => {
    if (!str) return '';
    return str.toLowerCase().trim().replace(/[^\w\s]/g, '');
  };

  const bookTitle = normalizeString(book.title);
  const bookAuthor = normalizeString(book.author);
  const bookIsbn = book.isbn?.replace(/[^\d]/g, '');

  // Try to find match in reading list
  for (const listItem of readingList) {
    const listTitle = normalizeString(listItem.title);
    const listAuthor = normalizeString(listItem.author);
    const listIsbn = listItem.isbn?.replace(/[^\d]/g, '');
    const listIsbn13 = listItem.isbn13?.replace(/[^\d]/g, '');

    // Match by ISBN (most reliable)
    if (bookIsbn && (bookIsbn === listIsbn || bookIsbn === listIsbn13)) {
      return {
        matched: true,
        matchType: 'isbn',
        shelf: listItem.exclusive_shelf,
        myRating: listItem.my_rating,
        dateRead: listItem.date_read,
        dateAdded: listItem.date_added
      };
    }

    // Match by title + author
    if (bookTitle && listTitle && bookTitle === listTitle) {
      if (bookAuthor && listAuthor &&
          (bookAuthor === listAuthor ||
              bookAuthor.includes(listAuthor) ||
              listAuthor.includes(bookAuthor))) {
        return {
          matched: true,
          matchType: 'title-author',
          shelf: listItem.exclusive_shelf,
          myRating: listItem.my_rating,
          dateRead: listItem.date_read,
          dateAdded: listItem.date_added
        };
      }
    }
  }

  return null;
}
app.get('/api/debug-db', async (req, res) => {
  try {
    const conn = await mariadb.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME || 'Goodreads',
      port: parseInt(process.env.DB_PORT),
      connectTimeout: 10000
    });
    await conn.ping();
    await conn.end();
    res.json({ status: 'ok' });
  } catch (err) {
    res.json({
      error: err.message,
      code: err.code,
      host: process.env.DB_HOST,
      port: process.env.DB_PORT
    });
  }
});

// Main scan endpoint
app.post('/api/scan', async (req, res) => {
  try {
    const { image, userId } = req.body;  // ADD userId parameter

    // Validation
    if (!image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    if (!image.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Invalid image format' });
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY not configured');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // NEW: Load user's reading list if userId provided
    let readingList = [];
    if (userId) {
      try {
        const { data, error } = await supabase
            .from('reading_list')
            .select('*')
            .eq('user_id', userId);

        if (!error && data) {
          readingList = data;
          console.log(`Loaded ${readingList.length} books from reading list for cross-reference`);
        }
      } catch (err) {
        console.error('Error loading reading list:', err);
        // Continue without reading list
      }
    }

    // Step 1: Extract books using OpenAI Vision
    console.log('Calling OpenAI Vision API...');
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this image of book spines. Extract the title and author of each book you can identify. Return ONLY a valid JSON array with this exact format: [{"title": "Book Title", "author": "Author Name"}]. Do not include any other text, explanations, or markdown formatting. If you cannot identify any books, return an empty array [].'
              },
              {
                type: 'image_url',
                image_url: { url: image }
              }
            ]
          }
        ],
        max_tokens: 1000
      })
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json().catch(() => ({}));
      console.error('OpenAI API error:', errorData);
      return res.status(500).json({
        error: 'Failed to analyze image',
        details: errorData.error?.message || 'Unknown error'
      });
    }

    const openaiData = await openaiResponse.json();

    let extractedBooks = [];
    try {
      const responseText = openaiData.choices[0].message.content.trim();
      const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      extractedBooks = JSON.parse(cleanedText);
    } catch (e) {
      console.error('Failed to parse OpenAI response:', e);
      return res.status(500).json({ error: 'Failed to parse book data from image' });
    }

    if (!Array.isArray(extractedBooks) || extractedBooks.length === 0) {
      return res.status(404).json({ error: 'No books found in the image' });
    }

    console.log(`Found ${extractedBooks.length} books, fetching ratings...`);

    // Step 2: Get data from Google Books and Open Library (with caching)
    const bookPromises = extractedBooks.map(async (book) => {
      try {
        const cacheKey = `book:${book.title.toLowerCase()}:${book.author.toLowerCase()}`;

        const cached = await getFromCache(cacheKey);
        if (cached) {
          console.log(`✅ Cache hit: ${book.title}`);
          return cached;
        }

        const [googleBook, openLibBook] = await Promise.all([
          searchGoogleBooks(book.title, book.author),
          searchOpenLibrary(book.title, book.author)
        ]);
        const isbn = googleBook?.isbn || openLibBook?.isbn;
        const goodreadsRating = isbn ? await searchGoodreadsDB(isbn) : null;

        const mergedData = mergeBookData(googleBook, openLibBook, goodreadsRating, book.title, book.author);

        if (mergedData) {
          await setCache(cacheKey, mergedData);
          console.log(`✅ Fetched and cached: ${book.title}`);
        }

        return mergedData;
      } catch (e) {
        console.error(`Error fetching book info for "${book.title}":`, e.message);
        return null;
      }
    });

    const bookResults = await Promise.all(bookPromises);
    const validBooks = bookResults.filter(book => book !== null);

    if (validBooks.length === 0) {
      return res.status(404).json({
        error: 'Could not find rating information for any books',
        extractedBooks: extractedBooks
      });
    }

    // NEW: Cross-reference with reading list
    let matchedCount = 0;
    if (readingList.length > 0) {
      console.log(`Cross-referencing ${validBooks.length} books with reading list...`);

      validBooks.forEach(book => {
        const match = checkReadingList(book, readingList);
        if (match) {
          book.inReadingList = true;
          book.readingListInfo = match;
          matchedCount++;
          console.log(`✅ Match found: "${book.title}" - Shelf: ${match.shelf}`);
        }
      });

      console.log(`Found ${matchedCount} matches in reading list`);
    }

    // Sort by rating (and number of ratings as tiebreaker)
    validBooks.sort((a, b) => {
      if (b.rating !== a.rating) {
        return b.rating - a.rating;
      }
      return b.ratingsCount - a.ratingsCount;
    });

    console.log(`Successfully processed ${validBooks.length} books`);

    res.json({
      success: true,
      books: validBooks,
      totalFound: extractedBooks.length,
      totalProcessed: validBooks.length,
      matchedInReadingList: matchedCount  // NEW: return match count
    });

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({
      error: 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});
// Goodreads CSV Import endpoint
app.post('/api/import-goodreads', upload.single('file'), async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`Processing Goodreads CSV for user: ${user.id}`);

    // Parse CSV
    const csvText = req.file.buffer.toString('utf-8');
    const parseResult = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim()
    });

    if (parseResult.errors.length > 0) {
      console.error('CSV parse errors:', parseResult.errors);
      return res.status(400).json({
        error: 'Failed to parse CSV',
        details: parseResult.errors[0].message
      });
    }

    const books = parseResult.data;
    console.log(`Parsed ${books.length} books from CSV`);

    // Clear existing reading list for this user
    const { error: deleteError } = await supabase
        .from('reading_list')
        .delete()
        .eq('user_id', user.id);

    if (deleteError) {
      console.error('Error clearing reading list:', deleteError);
      return res.status(500).json({ error: 'Failed to clear existing reading list' });
    }

    // Transform and insert books
    const booksToInsert = books
        .filter(book => book.Title && book.Title.trim()) // Only books with titles
        .map(book => ({
          user_id: user.id,
          title: book.Title?.trim() || '',
          author: book.Author?.trim() || null,
          isbn: book.ISBN?.replace(/[="]/g, '').trim() || null,
          isbn13: book.ISBN13?.replace(/[="]/g, '').trim() || null,
          goodreads_book_id: book['Book Id']?.trim() || null,
          my_rating: book['My Rating'] ? parseFloat(book['My Rating']) : null,
          average_rating: book['Average Rating'] ? parseFloat(book['Average Rating']) : null,
          date_added: book['Date Added'] ? new Date(book['Date Added']).toISOString() : null,
          date_read: book['Date Read'] ? new Date(book['Date Read']).toISOString() : null,
          bookshelves: book.Bookshelves ? book.Bookshelves.split(',').map(s => s.trim()) : [],
          exclusive_shelf: book['Exclusive Shelf']?.trim() || null,
          publisher: book.Publisher?.trim() || null,
          binding: book.Binding?.trim() || null,
          number_of_pages: book['Number of Pages'] ? parseInt(book['Number of Pages']) : null,
          year_published: book['Year Published'] ? parseInt(book['Year Published']) : null,
          original_publication_year: book['Original Publication Year'] ? parseInt(book['Original Publication Year']) : null
        }));

    // Insert in batches of 100
    const batchSize = 100;
    let insertedCount = 0;

    for (let i = 0; i < booksToInsert.length; i += batchSize) {
      const batch = booksToInsert.slice(i, i + batchSize);
      const { error: insertError } = await supabase
          .from('reading_list')
          .insert(batch);

      if (insertError) {
        console.error('Error inserting batch:', insertError);
        return res.status(500).json({
          error: 'Failed to import books',
          details: insertError.message,
          importedSoFar: insertedCount
        });
      }

      insertedCount += batch.length;
      console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}, total: ${insertedCount}`);
    }

    console.log(`Successfully imported ${insertedCount} books`);

    res.json({
      success: true,
      imported: insertedCount,
      message: `Successfully imported ${insertedCount} books`
    });

  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({
      error: 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});
app.post('/api/import-goodreads-text', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { csvText } = req.body;

    if (!csvText || typeof csvText !== 'string') {
      return res.status(400).json({ error: 'No CSV text provided' });
    }

    if (csvText.length < 100) {
      return res.status(400).json({
        error: 'CSV text too short',
        details: 'Please paste the complete CSV data'
      });
    }

    console.log(`Processing pasted CSV for user: ${user.id}`);
    console.log(`CSV length: ${csvText.length} characters`);

    // Auto-detect delimiter by checking first line
    const firstLine = csvText.split('\n')[0];
    const tabCount = (firstLine.match(/\t/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;

    // If there are more tabs than commas, it's TSV (tab-separated)
    const delimiter = tabCount > commaCount ? '\t' : ',';
    const format = delimiter === '\t' ? 'TSV (Tab-separated)' : 'CSV (Comma-separated)';

    console.log(`Detected format: ${format} (tabs: ${tabCount}, commas: ${commaCount})`);
    console.log(`First 200 chars: ${csvText.substring(0, 200)}`);

    // Parse with detected delimiter
    const parseResult = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      trimHeaders: true,
      transformHeader: (header) => header.trim(),
      delimiter: delimiter,
      quoteChar: '"',
      escapeChar: '"',
    });

    console.log(`Parsed ${parseResult.data.length} rows with ${parseResult.errors.length} errors`);

    if (parseResult.errors.length > 0) {
      console.warn('Parse errors (first 3):', parseResult.errors.slice(0, 3));

      // Only fail on critical errors, ignore TooManyFields
      const criticalErrors = parseResult.errors.filter(e =>
          e.type === 'Quotes' || e.type === 'Delimiter'
      );

      if (criticalErrors.length > 0) {
        return res.status(400).json({
          error: 'CSV parsing failed',
          details: criticalErrors[0].message
        });
      }
    }

    const books = parseResult.data;

    if (books.length > 0) {
      console.log('Sample row keys:', Object.keys(books[0]));
      console.log('Sample row:', JSON.stringify(books[0]).substring(0, 200));
    }

    // Filter valid books
    const validBooks = books.filter(book => {
      const titleKey = Object.keys(book).find(k => k.toLowerCase() === 'title');
      if (!titleKey) return false;
      const title = book[titleKey];
      return title && typeof title === 'string' && title.trim().length > 0;
    });

    console.log(`Valid books: ${validBooks.length} out of ${books.length}`);

    if (validBooks.length === 0) {
      console.error('No valid books found after filtering');
      if (books.length > 0) {
        console.error('Sample book that failed:', JSON.stringify(books[0]));
      }
      return res.status(400).json({
        error: 'No valid books found',
        details: `Parsed ${books.length} rows but none had valid titles. Make sure you copied the complete CSV including headers.`
      });
    }

    // Clear existing reading list
    const { error: deleteError } = await supabase
        .from('reading_list')
        .delete()
        .eq('user_id', user.id);

    if (deleteError) {
      console.error('Error clearing reading list:', deleteError);
      return res.status(500).json({ error: 'Failed to clear existing reading list' });
    }

    // Transform books - use case-insensitive field lookup
    const booksToInsert = validBooks.map(book => {
      const getField = (fieldName) => {
        const key = Object.keys(book).find(k => k.toLowerCase() === fieldName.toLowerCase());
        return key ? book[key] : null;
      };

      return {
        user_id: user.id,
        title: getField('Title')?.trim() || '',
        author: getField('Author')?.trim() || null,
        isbn: getField('ISBN')?.replace(/[="]/g, '').trim() || null,
        isbn13: getField('ISBN13')?.replace(/[="]/g, '').trim() || null,
        goodreads_book_id: getField('Book Id')?.trim() || null,
        my_rating: getField('My Rating') ? parseFloat(getField('My Rating')) : null,
        average_rating: getField('Average Rating') ? parseFloat(getField('Average Rating')) : null,
        date_added: getField('Date Added') ? new Date(getField('Date Added')).toISOString() : null,
        date_read: getField('Date Read') ? new Date(getField('Date Read')).toISOString() : null,
        bookshelves: getField('Bookshelves') ? getField('Bookshelves').split(',').map(s => s.trim()) : [],
        exclusive_shelf: getField('Exclusive Shelf')?.trim() || null,
        publisher: getField('Publisher')?.trim() || null,
        binding: getField('Binding')?.trim() || null,
        number_of_pages: getField('Number of Pages') ? parseInt(getField('Number of Pages')) : null,
        year_published: getField('Year Published') ? parseInt(getField('Year Published')) : null,
        original_publication_year: getField('Original Publication Year') ? parseInt(getField('Original Publication Year')) : null
      };
    });

    console.log(`Prepared ${booksToInsert.length} books for insertion`);

    // Batch insert
    const BATCH_SIZE = 1000;
    let totalInserted = 0;

    for (let i = 0; i < booksToInsert.length; i += BATCH_SIZE) {
      const batch = booksToInsert.slice(i, i + BATCH_SIZE);
      const { error: insertError } = await supabase
          .from('reading_list')
          .insert(batch);

      if (insertError) {
        console.error('Error inserting books:', insertError);
        return res.status(500).json({
          error: 'Failed to save books',
          details: insertError.message
        });
      }

      totalInserted += batch.length;
    }

    console.log(`✅ Successfully imported ${totalInserted} books for user: ${user.id}`);

    res.json({
      success: true,
      imported: totalInserted,
      message: `Successfully imported ${totalInserted} books!`
    });

  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({
      error: 'Failed to import books',
      details: error.message
    });
  }
});

app.post('/api/scan-isbn', async (req, res) => {
  try {
    const { isbn, userId } = req.body;

    if (!isbn) {
      return res.status(400).json({ error: 'No ISBN provided' });
    }
    const cleanIsbn = isbn.replace(/[-\s]/g, '');

    console.log(`Looking up ISBN: ${cleanIsbn}`);

    const cacheKey = `isbn:${cleanIsbn}`;
    const cached = await getFromCache(cacheKey);
    if (cached) {
      console.log(`✅ Cache hit for ISBN: ${cleanIsbn}`);

      if (userId) {
        const { data: readingList } = await supabase
            .from('reading_list')
            .select('*')
            .eq('user_id', userId);

        if (readingList) {
          const match = checkReadingList(cached, readingList);
          if (match) {
            cached.inReadingList = true;
            cached.readingListInfo = match;
          }
        }
      }
      return res.json({ success: true, book: cached });

    }
    // Query both APIs in parallel for fastest response
    const [googleBook, openLibBook] = await Promise.all([
      searchGoogleBooksByISBN(cleanIsbn),
      searchOpenLibraryByISBN(cleanIsbn)
    ]);

    if (!googleBook && !openLibBook) {
      return res.status(404).json({
        error: 'Book not found',
        isbn: cleanIsbn
      });
    }

    // Merge data from both sources
    const bookData = mergeBookData(
        googleBook,
        openLibBook,
        googleBook?.title || openLibBook?.title || 'Unknown',
        googleBook?.author || openLibBook?.author || 'Unknown'
    );

    if (!bookData) {
      return res.status(404).json({ error: 'Could not retrieve book data' });
    }

    // Cache the result (30 days)
    await setCache(cacheKey, bookData);

    // Check reading list if userId provided
    if (userId) {
      const { data: readingList } = await supabase
          .from('reading_list')
          .select('*')
          .eq('user_id', userId);

      if (readingList) {
        const match = checkReadingList(bookData, readingList);
        if (match) {
          bookData.inReadingList = true;
          bookData.readingListInfo = match;
        }
      }
    }

    console.log(`✅ Successfully fetched book by ISBN: ${bookData.title}`);

    res.json({
      success: true,
      book: bookData
    });

  } catch (error) {
    console.error('ISBN scan error:', error);
    res.status(500).json({
      error: 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Helper function to search Google Books by ISBN
async function searchGoogleBooksByISBN(isbn) {
  try {
    const response = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`
    );

    if (!response.ok) return null;

    const data = await response.json();

    if (data.items && data.items.length > 0) {
      const bookInfo = data.items[0].volumeInfo;

      return {
        title: bookInfo.title,
        author: bookInfo.authors?.[0],
        rating: bookInfo.averageRating || 0,
        ratingsCount: bookInfo.ratingsCount || 0,
        description: bookInfo.description || '',
        thumbnail: bookInfo.imageLinks?.thumbnail || null,
        infoLink: bookInfo.infoLink || null,
        isbn: isbn,
        publishYear: bookInfo.publishedDate ? parseInt(bookInfo.publishedDate.substring(0, 4)) : null,
        source: 'google'
      };
    }
    return null;
  } catch (error) {
    console.error('Google Books ISBN lookup error:', error.message);
    return null;
  }
}

// Helper function to search Open Library by ISBN
async function searchOpenLibraryByISBN(isbn) {
  try {
    const response = await fetch(
        `https://openlibrary.org/isbn/${isbn}.json`
    );

    if (!response.ok) return null;

    const book = await response.json();

    // Get author name if available
    let authorName = 'Unknown';
    if (book.authors && book.authors.length > 0) {
      try {
        const authorResponse = await fetch(
            `https://openlibrary.org${book.authors[0].key}.json`
        );
        if (authorResponse.ok) {
          const authorData = await authorResponse.json();
          authorName = authorData.name;
        }
      } catch (e) {
        console.log('Could not fetch author name');
      }
    }

    // Try to get ratings
    let rating = 0;
    let ratingsCount = 0;

    if (book.works && book.works.length > 0) {
      try {
        const workKey = book.works[0].key;
        const ratingsResponse = await fetch(
            `https://openlibrary.org${workKey}/ratings.json`
        );

        if (ratingsResponse.ok) {
          const ratingsData = await ratingsResponse.json();
          if (ratingsData.summary && ratingsData.summary.average) {
            rating = ratingsData.summary.average;
            ratingsCount = ratingsData.summary.count || 0;
          }
        }
      } catch (e) {
        console.log('Could not fetch Open Library ratings');
      }
    }

    return {
      title: book.title,
      author: authorName,
      rating: rating,
      ratingsCount: ratingsCount,
      description: book.description?.value || book.description || '',
      thumbnail: book.covers?.[0]
          ? `https://covers.openlibrary.org/b/id/${book.covers[0]}-M.jpg`
          : null,
      isbn: isbn,
      publishYear: book.publish_date ? parseInt(book.publish_date) : null,
      source: 'openlibrary'
    };
  } catch (error) {
    console.error('Open Library ISBN lookup error:', error.message);
    return null;
  }
}

// Get reading list endpoint
app.get('/api/reading-list', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { data: books, error } = await supabase
        .from('reading_list')
        .select('*')
        .eq('user_id', user.id)
        .order('date_added', { ascending: false });

    if (error) {
      console.error('Error fetching reading list:', error);
      return res.status(500).json({ error: 'Failed to fetch reading list' });
    }

    res.json({
      success: true,
      books: books || [],
      count: books?.length || 0
    });

  } catch (error) {
    console.error('Reading list fetch error:', error);
    res.status(500).json({ error: 'An unexpected error occurred' });
  }
});

// Delete reading list endpoint
app.delete('/api/reading-list', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { error } = await supabase
        .from('reading_list')
        .delete()
        .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting reading list:', error);
      return res.status(500).json({ error: 'Failed to delete reading list' });
    }

    res.json({
      success: true,
      message: 'Reading list cleared successfully'
    });

  } catch (error) {
    console.error('Delete reading list error:', error);
    res.status(500).json({ error: 'An unexpected error occurred' });
  }
});
app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Use Supabase to authenticate
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Return token for the HTML page to use
    res.json({
      success: true,
      token: data.session.access_token
    });

  } catch (error) {
    console.error('Sign in error:', error);
    res.status(500).json({ error: 'An unexpected error occurred' });
  }
});
app.delete('/api/delete-account', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    console.log(`🗑️  Account deletion requested for user: ${user.id} (${user.email})`);

    // Step 1: Delete user's scans (including image URLs from storage if applicable)
    const { data: scans, error: fetchScansError } = await supabase
        .from('scans')
        .select('image_url')
        .eq('user_id', user.id);

    if (fetchScansError) {
      console.error('Error fetching scans for deletion:', fetchScansError);
    }

    // Delete images from storage if they exist
    if (scans && scans.length > 0) {
      const imageUrls = scans
          .map(scan => scan.image_url)
          .filter(url => url && url.includes('supabase'));

      for (const imageUrl of imageUrls) {
        try {
          // Extract the file path from the URL
          const urlParts = imageUrl.split('/storage/v1/object/public/');
          if (urlParts.length > 1) {
            const filePath = urlParts[1];
            const { error: deleteFileError } = await supabase.storage
                .from('scan-images')
                .remove([filePath]);

            if (deleteFileError) {
              console.error('Error deleting image:', deleteFileError);
            }
          }
        } catch (err) {
          console.error('Error processing image deletion:', err);
        }
      }
    }

    // Delete scans from database (CASCADE will handle this, but being explicit)
    const { error: deleteScansError } = await supabase
        .from('scans')
        .delete()
        .eq('user_id', user.id);

    if (deleteScansError) {
      console.error('Error deleting scans:', deleteScansError);
      return res.status(500).json({ error: 'Failed to delete scan history' });
    }

    // Step 2: Delete user's reading list
    const { error: deleteReadingListError } = await supabase
        .from('reading_list')
        .delete()
        .eq('user_id', user.id);

    if (deleteReadingListError) {
      console.error('Error deleting reading list:', deleteReadingListError);
      return res.status(500).json({ error: 'Failed to delete reading list' });
    }

    // Step 3: Delete the user account from Supabase Auth
    // Note: This requires admin privileges, so we'll use the service role
    const { error: deleteUserError } = await supabase.auth.admin.deleteUser(user.id);

    if (deleteUserError) {
      console.error('Error deleting user account:', deleteUserError);
      return res.status(500).json({ error: 'Failed to delete account' });
    }

    console.log(`✅ Account successfully deleted for user: ${user.id} (${user.email})`);

    res.json({
      success: true,
      message: 'Account and all associated data have been successfully deleted'
    });

  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({
      error: 'An unexpected error occurred while deleting the account',
      details: error.message
    });
  }
});
app.delete('/api/scans/:scanId', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { scanId } = req.params;

    if (!scanId) {
      return res.status(400).json({ error: 'Scan ID is required' });
    }

    console.log(`🗑️  Deleting scan ${scanId} for user ${user.id}`);

    // First, get the scan to check ownership and get image URL
    const { data: scan, error: fetchError } = await supabase
        .from('scans')
        .select('image_url, user_id')
        .eq('id', scanId)
        .single();

    if (fetchError) {
      console.error('Error fetching scan:', fetchError);
      return res.status(404).json({ error: 'Scan not found' });
    }

    // Verify the scan belongs to the requesting user
    if (scan.user_id !== user.id) {
      return res.status(403).json({ error: 'Forbidden: You can only delete your own scans' });
    }

    // Delete the image from storage if it exists
    if (scan.image_url && scan.image_url.includes('supabase')) {
      try {
        const urlParts = scan.image_url.split('/storage/v1/object/public/');
        if (urlParts.length > 1) {
          const filePath = urlParts[1];
          const { error: deleteFileError } = await supabase.storage
              .from('scan-images')
              .remove([filePath]);

          if (deleteFileError) {
            console.error('Error deleting scan image:', deleteFileError);
            // Continue with scan deletion even if image deletion fails
          } else {
            console.log(`✅ Image deleted: ${filePath}`);
          }
        }
      } catch (err) {
        console.error('Error processing image deletion:', err);
        // Continue with scan deletion even if image deletion fails
      }
    }

    // Delete the scan from database
    const { error: deleteScanError } = await supabase
        .from('scans')
        .delete()
        .eq('id', scanId)
        .eq('user_id', user.id); // Extra safety check

    if (deleteScanError) {
      console.error('Error deleting scan:', deleteScanError);
      return res.status(500).json({ error: 'Failed to delete scan' });
    }

    console.log(`✅ Scan ${scanId} successfully deleted`);

    res.json({
      success: true,
      message: 'Scan deleted successfully'
    });

  } catch (error) {
    console.error('Delete scan error:', error);
    res.status(500).json({
      error: 'An unexpected error occurred',
      details: error.message
    });
  }
});
// ============================================
// 1. SINGLE BOOK LOOKUP ENDPOINT
// Used when user manually adds or corrects a book
// ============================================

app.post('/api/lookup-book', async (req, res) => {
  try {
    const { title, author, isbn } = req.body;

    if(!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const searchTitle = title.trim();
    const searchAuthor = (author || '').trim();
    const searchIsbn = (isbn || '').trim();

    console.log(`📖 Looking up book: "${searchTitle}" by "${searchAuthor}"`);

    // Check cache first
    const cacheKey = `book:${searchTitle.toLowerCase()}:${searchAuthor.toLowerCase()}`;
    const cached = await getFromCache(cacheKey);
    if (cached) {
      console.log(`✅ Cache hit for lookup: ${searchTitle}`);
      return res.json({ success: true, book: cached });
    }

    // Search both sources in parallel
    const [googleBook, openLibBook] = await Promise.all([
      searchGoogleBooks(searchTitle, searchAuthor),
      searchOpenLibrary(searchTitle, searchAuthor)
    ]);
    const goodreadsRating = searchIsbn ? await searchGoodreadsDB(searchIsbn) : null;

    const mergedData = mergeBookData(googleBook, openLibBook, goodreadsRating, searchTitle, searchAuthor);

    if (!mergedData) {
      return res.status(404).json({
        error: 'Book not found',
        // Return a basic entry so user can still add it
        book: {
          title: searchTitle,
          author: searchAuthor,
          rating: 0,
          ratingsCount: 0,
          ratingSource: 'No ratings available',
          description: 'No description available',
          thumbnail: null,
          infoLink: null,
          isbn: null,
          publishYear: null,
          goodreadsUrl: `https://www.goodreads.com/search?q=${encodeURIComponent(`${searchTitle} ${searchAuthor}`)}`,
          amazonUrl: `https://www.amazon.com/s?k=${encodeURIComponent(`${searchTitle} ${searchAuthor}`)}&tag=${process.env.AMAZON_AFFILIATE_TAG || 'shelfscan05-20'}`,
          sources: [],
          manualEntry: true
        }
      });
    }

    // Cache the result
    await setCache(cacheKey, mergedData);
    console.log(`✅ Looked up and cached: ${searchTitle}`);

    // Optionally cross-reference with reading list if userId provided
    const userId = req.body.userId;
    if (userId) {
      try {
        const { data: readingList } = await supabase
            .from('reading_list')
            .select('*')
            .eq('user_id', userId);

        if (readingList && readingList.length > 0) {
          const match = checkReadingList(mergedData, readingList);
          if (match) {
            mergedData.inReadingList = true;
            mergedData.readingListInfo = match;
          }
        }
      } catch (e) {
        console.log('Could not check reading list:', e.message);
      }
    }

    res.json({ success: true, book: mergedData });

  } catch (error) {
    console.error('Lookup error:', error);
    res.status(500).json({
      error: 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============================================
// 2. UPDATE SCAN ENDPOINT
// Updates the books array in an existing scan
// ============================================
app.put('/api/scans/:scanId', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { scanId } = req.params;
    const { books } = req.body;

    if (!books || !Array.isArray(books)) {
      return res.status(400).json({ error: 'Books array is required' });
    }

    // Verify the scan belongs to this user
    const { data: existingScan, error: fetchError } = await supabase
        .from('scans')
        .select('id, user_id')
        .eq('id', scanId)
        .eq('user_id', user.id)
        .single();

    if (fetchError || !existingScan) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    // Update the scan
    const { error: updateError } = await supabase
        .from('scans')
        .update({ books: books })
        .eq('id', scanId)
        .eq('user_id', user.id);

    if (updateError) {
      console.error('Error updating scan:', updateError);
      return res.status(500).json({ error: 'Failed to update scan' });
    }

    console.log(`✅ Updated scan ${scanId} for user ${user.id} - ${books.length} books`);

    res.json({
      success: true,
      message: 'Scan updated successfully',
      bookCount: books.length
    });

  } catch (error) {
    console.error('Update scan error:', error);
    res.status(500).json({ error: 'An unexpected error occurred' });
  }
});

// ============================================================
// Phase 1: Shelves & User Books API Routes
// Add these routes to your server.js
// ============================================================
// Copy these into server.js BEFORE the error handling middleware
// (before the `app.use((err, req, res, next) => {` line)
// ============================================================

// ── Helper: Authenticate request and return user ──
const authenticateUser = async (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Unauthorized', status: 401 };
  }
  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return { error: 'Invalid token', status: 401 };
  }
  return { user };
};

// ── Helper: Extract books from scan and upsert into user_books ──
const extractBooksFromScan = async (userId, scanId, books) => {
  if (!books || books.length === 0) return { inserted: 0, skipped: 0 };

  let inserted = 0;
  let skipped = 0;

  for (const book of books) {
    if (!book.title || !book.title.trim()) {
      skipped++;
      continue;
    }

    const bookRow = {
      user_id: userId,
      title: book.title.trim(),
      author: book.author?.trim() || null,
      isbn: book.isbn || null,
      isbn13: book.isbn13 || null,
      rating: book.rating || null,
      ratings_count: book.ratingsCount || 0,
      description: book.description || null,
      thumbnail: book.thumbnail || null,
      sources: book.sources || [],
      scan_id: scanId,
    };

    const { error } = await supabase
        .from('user_books')
        .insert(bookRow);

    if (error) {
      if (error.code === '23505') {
        // Duplicate book - update with latest scan data instead
        const { error: updateError } = await supabase
            .from('user_books')
            .update({
              rating: bookRow.rating,
              ratings_count: bookRow.ratings_count,
              thumbnail: bookRow.thumbnail,
              sources: bookRow.sources,
              scan_id: scanId,
            })
            .eq('user_id', userId)
            .ilike('title', book.title.trim());

        if (!updateError) {
          skipped++; // counted as "already existed, updated"
        }
      } else {
        console.error(`Error inserting book "${book.title}":`, error.message);
        skipped++;
      }
    } else {
      inserted++;
    }
  }

  return { inserted, skipped };
};


// ================================================================
// SHELVES CRUD
// ================================================================

// GET /api/shelves - Get all shelves for the user
app.get('/api/shelves', async (req, res) => {
  try {
    const auth = await authenticateUser(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { data: shelves, error } = await supabase
        .from('shelves')
        .select(`
        *,
        book_shelves(count)
      `)
        .eq('user_id', auth.user.id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

    if (error) throw error;

    // Transform to include book count
    const result = (shelves || []).map(shelf => ({
      ...shelf,
      bookCount: shelf.book_shelves?.[0]?.count || 0,
      book_shelves: undefined, // clean up the nested object
    }));

    res.json({ success: true, shelves: result });
  } catch (error) {
    console.error('Error fetching shelves:', error);
    res.status(500).json({ error: 'Failed to fetch shelves' });
  }
});

// POST /api/shelves - Create a new shelf
app.post('/api/shelves', async (req, res) => {
  try {
    const auth = await authenticateUser(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { name, color, icon } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Shelf name is required' });
    }

    const { data: shelf, error } = await supabase
        .from('shelves')
        .insert({
          user_id: auth.user.id,
          name: name.trim(),
          color: color || '#6366f1',
          icon: icon || '📚',
        })
        .select()
        .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'A shelf with that name already exists' });
      }
      throw error;
    }

    res.json({ success: true, shelf: { ...shelf, bookCount: 0 } });
  } catch (error) {
    console.error('Error creating shelf:', error);
    res.status(500).json({ error: 'Failed to create shelf' });
  }
});

// PUT /api/shelves/:id - Update a shelf
app.put('/api/shelves/:id', async (req, res) => {
  try {
    const auth = await authenticateUser(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { name, color, icon, sort_order } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (color !== undefined) updates.color = color;
    if (icon !== undefined) updates.icon = icon;
    if (sort_order !== undefined) updates.sort_order = sort_order;

    const { data: shelf, error } = await supabase
        .from('shelves')
        .update(updates)
        .eq('id', req.params.id)
        .eq('user_id', auth.user.id)
        .select()
        .single();

    if (error) throw error;
    if (!shelf) return res.status(404).json({ error: 'Shelf not found' });

    res.json({ success: true, shelf });
  } catch (error) {
    console.error('Error updating shelf:', error);
    res.status(500).json({ error: 'Failed to update shelf' });
  }
});

// DELETE /api/shelves/:id - Delete a shelf (books stay, just unlinked)
app.delete('/api/shelves/:id', async (req, res) => {
  try {
    const auth = await authenticateUser(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { error } = await supabase
        .from('shelves')
        .delete()
        .eq('id', req.params.id)
        .eq('user_id', auth.user.id);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting shelf:', error);
    res.status(500).json({ error: 'Failed to delete shelf' });
  }
});


// ================================================================
// SHELF ↔ BOOK ASSIGNMENTS
// ================================================================

// POST /api/shelves/:shelfId/books - Add books to a shelf
app.post('/api/shelves/:shelfId/books', async (req, res) => {
  try {
    const auth = await authenticateUser(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { bookIds } = req.body; // array of user_books IDs
    if (!bookIds || !Array.isArray(bookIds) || bookIds.length === 0) {
      return res.status(400).json({ error: 'bookIds array is required' });
    }

    // Verify the shelf belongs to the user
    const { data: shelf, error: shelfError } = await supabase
        .from('shelves')
        .select('id')
        .eq('id', req.params.shelfId)
        .eq('user_id', auth.user.id)
        .single();

    if (shelfError || !shelf) {
      return res.status(404).json({ error: 'Shelf not found' });
    }

    // Insert assignments (ignore duplicates)
    const assignments = bookIds.map(bookId => ({
      book_id: bookId,
      shelf_id: req.params.shelfId,
    }));

    const { error } = await supabase
        .from('book_shelves')
        .upsert(assignments, { onConflict: 'book_id,shelf_id', ignoreDuplicates: true });

    if (error) throw error;

    res.json({ success: true, added: bookIds.length });
  } catch (error) {
    console.error('Error adding books to shelf:', error);
    res.status(500).json({ error: 'Failed to add books to shelf' });
  }
});

// DELETE /api/shelves/:shelfId/books/:bookId - Remove a book from a shelf
app.delete('/api/shelves/:shelfId/books/:bookId', async (req, res) => {
  try {
    const auth = await authenticateUser(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { error } = await supabase
        .from('book_shelves')
        .delete()
        .eq('shelf_id', req.params.shelfId)
        .eq('book_id', req.params.bookId);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing book from shelf:', error);
    res.status(500).json({ error: 'Failed to remove book from shelf' });
  }
});


// ================================================================
// USER BOOKS (Collection)
// ================================================================

// GET /api/user-books - Full-text search with advanced filters
app.get('/api/user-books', async (req, res) => {
  try {
    const auth = await authenticateUser(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { shelfId, search, minRating, maxRating, sort, limit, offset, hasImage, unshelfed } = req.query;

    let query = supabase
        .from('user_books')
        .select(`
        *,
        book_shelves(shelf_id, shelves(id, name, color, icon))
      `, { count: 'exact' })
        .eq('user_id', auth.user.id);

    // Filter by shelf
    if (shelfId) {
      const { data: shelfBooks } = await supabase
          .from('book_shelves')
          .select('book_id')
          .eq('shelf_id', shelfId);

      if (shelfBooks && shelfBooks.length > 0) {
        query = query.in('id', shelfBooks.map(sb => sb.book_id));
      } else {
        return res.json({ success: true, books: [], total: 0 });
      }
    }

    // Filter for unshelved books (not on any shelf)
    if (unshelfed === 'true') {
      // Get all book IDs that ARE on a shelf
      const { data: shelvedBooks } = await supabase
          .from('book_shelves')
          .select('book_id');

      if (shelvedBooks && shelvedBooks.length > 0) {
        const shelvedIds = shelvedBooks.map(sb => sb.book_id);
        query = query.not('id', 'in', `(${shelvedIds.join(',')})`);
      }
    }

    // Full-text search (uses the search_vector column)
    if (search && search.trim()) {
      const term = search.trim();
      // Use full-text search for multi-word queries, ilike for short ones
      if (term.includes(' ') || term.length > 3) {
        query = query.textSearch('search_vector', term, {
          type: 'plain',
          config: 'english'
        });
      } else {
        // Short queries: use ilike for prefix matching (more intuitive)
        const likeTerm = `%${term}%`;
        query = query.or(`title.ilike.${likeTerm},author.ilike.${likeTerm}`);
      }
    }

    // Rating filters
    if (minRating) {
      query = query.gte('rating', parseFloat(minRating));
    }
    if (maxRating) {
      query = query.lte('rating', parseFloat(maxRating));
    }

    // Has thumbnail filter
    if (hasImage === 'true') {
      query = query.not('thumbnail', 'is', null);
    }

    // Sort
    switch (sort) {
      case 'rating':
        query = query.order('rating', { ascending: false, nullsFirst: false });
        break;
      case 'rating_asc':
        query = query.order('rating', { ascending: true, nullsFirst: false });
        break;
      case 'title':
        query = query.order('title', { ascending: true });
        break;
      case 'title_desc':
        query = query.order('title', { ascending: false });
        break;
      case 'author':
        query = query.order('author', { ascending: true, nullsFirst: false });
        break;
      case 'oldest':
        query = query.order('created_at', { ascending: true });
        break;
      case 'newest':
      default:
        query = query.order('created_at', { ascending: false });
    }

    // Pagination
    const pageLimit = Math.min(parseInt(limit) || 50, 200);
    const pageOffset = parseInt(offset) || 0;
    query = query.range(pageOffset, pageOffset + pageLimit - 1);

    const { data: books, error, count } = await query;

    if (error) throw error;

    // Flatten shelf data
    const result = (books || []).map(book => ({
      ...book,
      shelves: (book.book_shelves || []).map(bs => bs.shelves).filter(Boolean),
      book_shelves: undefined,
    }));

    res.json({ success: true, books: result, total: count || 0 });
  } catch (error) {
    console.error('Error fetching user books:', error);
    res.status(500).json({ error: 'Failed to fetch books' });
  }
});

// GET /api/user-books/stats - Enhanced collection statistics
app.get('/api/user-books/stats', async (req, res) => {
  try {
    const auth = await authenticateUser(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { data: books, error } = await supabase
        .from('user_books')
        .select('rating, author, created_at, thumbnail')
        .eq('user_id', auth.user.id);

    if (error) throw error;

    const total = books?.length || 0;
    const rated = books?.filter(b => b.rating > 0) || [];
    const avgRating = rated.length > 0
        ? (rated.reduce((sum, b) => sum + parseFloat(b.rating), 0) / rated.length).toFixed(1)
        : 0;
    const withCovers = books?.filter(b => b.thumbnail).length || 0;

    // Top authors by count
    const authorCounts = {};
    books?.forEach(b => {
      if (b.author) {
        authorCounts[b.author] = (authorCounts[b.author] || 0) + 1;
      }
    });
    const topAuthors = Object.entries(authorCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

    // Rating distribution
    const ratingDistribution = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    rated.forEach(b => {
      const bucket = Math.floor(parseFloat(b.rating));
      if (bucket >= 0 && bucket <= 5) {
        ratingDistribution[bucket]++;
      }
    });

    // Books added over time (last 6 months by month)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const monthlyAdded = {};
    books?.forEach(b => {
      if (b.created_at) {
        const date = new Date(b.created_at);
        if (date >= sixMonthsAgo) {
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          monthlyAdded[key] = (monthlyAdded[key] || 0) + 1;
        }
      }
    });

    // Count unshelved books
    const { data: shelvedBookIds } = await supabase
        .from('book_shelves')
        .select('book_id');

    const shelvedSet = new Set((shelvedBookIds || []).map(sb => sb.book_id));
    const unshelvedCount = books?.filter(b => !shelvedSet.has(b.id)).length || 0;

    // Check for duplicates
    const { data: dupes } = await supabase
        .from('user_books')
        .select('norm_key')
        .eq('user_id', auth.user.id);

    const normKeyCounts = {};
    dupes?.forEach(d => {
      if (d.norm_key) {
        normKeyCounts[d.norm_key] = (normKeyCounts[d.norm_key] || 0) + 1;
      }
    });
    const duplicateGroups = Object.values(normKeyCounts).filter(c => c > 1).length;

    res.json({
      success: true,
      stats: {
        totalBooks: total,
        avgRating: parseFloat(avgRating),
        ratedBooks: rated.length,
        withCovers,
        unshelvedCount,
        duplicateGroups,
        topAuthors,
        ratingDistribution,
        monthlyAdded,
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// DELETE /api/user-books/:id - Remove a book from collection
app.delete('/api/user-books/:id', async (req, res) => {
  try {
    const auth = await authenticateUser(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { error } = await supabase
        .from('user_books')
        .delete()
        .eq('id', req.params.id)
        .eq('user_id', auth.user.id);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting book:', error);
    res.status(500).json({ error: 'Failed to delete book' });
  }
});
// GET /api/user-books/duplicates - Find duplicate books
app.get('/api/user-books/duplicates', async (req, res) => {
  try {
    const auth = await authenticateUser(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    // Get all books for this user
    const { data: allBooks, error } = await supabase
        .from('user_books')
        .select(`
        id, title, author, isbn, isbn13, rating, ratings_count, 
        thumbnail, scan_id, created_at, norm_key,
        book_shelves(shelf_id, shelves(id, name, color, icon))
      `)
        .eq('user_id', auth.user.id)
        .order('created_at', { ascending: true });

    if (error) throw error;

    // Group by norm_key to find title+author duplicates
    const groups = {};
    (allBooks || []).forEach(book => {
      const key = book.norm_key;
      if (!key) return;
      if (!groups[key]) groups[key] = [];
      groups[key].push({
        ...book,
        shelves: (book.book_shelves || []).map(bs => bs.shelves).filter(Boolean),
        book_shelves: undefined,
      });
    });

    // Also check ISBN duplicates (different title but same ISBN = same book)
    const isbnGroups = {};
    (allBooks || []).forEach(book => {
      const isbn = book.isbn || book.isbn13;
      if (!isbn) return;
      if (!isbnGroups[isbn]) isbnGroups[isbn] = [];
      isbnGroups[isbn].push(book.id);
    });

    // Filter to only groups with 2+ books
    const duplicates = Object.entries(groups)
        .filter(([, books]) => books.length > 1)
        .map(([normKey, books]) => {
          // Recommend keeping the book with most metadata
          const scored = books.map(b => ({
            ...b,
            metadataScore: (b.rating > 0 ? 2 : 0) +
                (b.thumbnail ? 1 : 0) +
                (b.isbn ? 1 : 0) +
                (b.ratings_count > 0 ? 1 : 0) +
                (b.shelves?.length > 0 ? 1 : 0),
          }));
          scored.sort((a, b) => b.metadataScore - a.metadataScore);

          return {
            normKey,
            title: books[0].title,
            author: books[0].author,
            count: books.length,
            recommended_keep: scored[0].id,
            books: scored,
          };
        })
        .sort((a, b) => b.count - a.count);

    // Also flag ISBN-based duplicates that have different norm_keys
    const isbnDuplicates = Object.entries(isbnGroups)
        .filter(([, ids]) => ids.length > 1)
        .map(([isbn, ids]) => {
          const books = ids.map(id => allBooks.find(b => b.id === id)).filter(Boolean);
          // Only include if they have DIFFERENT norm_keys (different title/author but same ISBN)
          const uniqueKeys = new Set(books.map(b => b.norm_key));
          if (uniqueKeys.size <= 1) return null; // Same norm_key = already caught above
          return {
            isbn,
            count: books.length,
            books: books.map(b => ({ id: b.id, title: b.title, author: b.author })),
            type: 'isbn_match',
          };
        })
        .filter(Boolean);

    res.json({
      success: true,
      duplicates,
      isbnDuplicates,
      totalDuplicateGroups: duplicates.length + isbnDuplicates.length,
      totalDuplicateBooks: duplicates.reduce((sum, d) => sum + d.count - 1, 0),
    });
  } catch (error) {
    console.error('Error finding duplicates:', error);
    res.status(500).json({ error: 'Failed to find duplicates' });
  }
});

// POST /api/user-books/merge - Merge duplicate books
app.post('/api/user-books/merge', async (req, res) => {
  try {
    const auth = await authenticateUser(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { keepId, deleteIds } = req.body;

    if (!keepId || !deleteIds || !Array.isArray(deleteIds) || deleteIds.length === 0) {
      return res.status(400).json({ error: 'keepId and deleteIds array are required' });
    }

    // Verify all books belong to this user
    const allIds = [keepId, ...deleteIds];
    const { data: books, error: fetchError } = await supabase
        .from('user_books')
        .select('id')
        .eq('user_id', auth.user.id)
        .in('id', allIds);

    if (fetchError) throw fetchError;
    if (!books || books.length !== allIds.length) {
      return res.status(403).json({ error: 'Some books not found or not owned by you' });
    }

    // Move shelf assignments from duplicates to the kept book
    for (const deleteId of deleteIds) {
      const { data: shelfAssignments } = await supabase
          .from('book_shelves')
          .select('shelf_id')
          .eq('book_id', deleteId);

      if (shelfAssignments && shelfAssignments.length > 0) {
        const newAssignments = shelfAssignments.map(sa => ({
          book_id: keepId,
          shelf_id: sa.shelf_id,
        }));

        await supabase
            .from('book_shelves')
            .upsert(newAssignments, { onConflict: 'book_id,shelf_id', ignoreDuplicates: true });
      }
    }

    // Delete the duplicate books
    const { error: deleteError } = await supabase
        .from('user_books')
        .delete()
        .in('id', deleteIds)
        .eq('user_id', auth.user.id);

    if (deleteError) throw deleteError;

    console.log(`✅ Merged ${deleteIds.length} duplicates into ${keepId}`);

    res.json({
      success: true,
      merged: deleteIds.length,
      keptId: keepId,
    });
  } catch (error) {
    console.error('Error merging books:', error);
    res.status(500).json({ error: 'Failed to merge books' });
  }
});

// POST /api/user-books/merge-all - Auto-merge all duplicates
app.post('/api/user-books/merge-all', async (req, res) => {
  try {
    const auth = await authenticateUser(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    // Get all books
    const { data: allBooks, error } = await supabase
        .from('user_books')
        .select('id, title, author, isbn, rating, ratings_count, thumbnail, norm_key, created_at')
        .eq('user_id', auth.user.id)
        .order('created_at', { ascending: true });

    if (error) throw error;

    // Group by norm_key
    const groups = {};
    (allBooks || []).forEach(book => {
      const key = book.norm_key;
      if (!key) return;
      if (!groups[key]) groups[key] = [];
      groups[key].push(book);
    });

    let totalMerged = 0;

    for (const [, books] of Object.entries(groups)) {
      if (books.length <= 1) continue;

      // Score each book by metadata quality
      const scored = books.map(b => ({
        ...b,
        score: (b.rating > 0 ? 2 : 0) +
            (b.thumbnail ? 1 : 0) +
            (b.isbn ? 1 : 0) +
            (b.ratings_count > 0 ? 1 : 0),
      }));
      scored.sort((a, b) => b.score - a.score);

      const keepId = scored[0].id;
      const deleteIds = scored.slice(1).map(b => b.id);

      // Move shelf assignments
      for (const deleteId of deleteIds) {
        const { data: shelfAssignments } = await supabase
            .from('book_shelves')
            .select('shelf_id')
            .eq('book_id', deleteId);

        if (shelfAssignments && shelfAssignments.length > 0) {
          await supabase
              .from('book_shelves')
              .upsert(
                  shelfAssignments.map(sa => ({ book_id: keepId, shelf_id: sa.shelf_id })),
                  { onConflict: 'book_id,shelf_id', ignoreDuplicates: true }
              );
        }
      }

      // Delete duplicates
      await supabase
          .from('user_books')
          .delete()
          .in('id', deleteIds)
          .eq('user_id', auth.user.id);

      totalMerged += deleteIds.length;
    }

    console.log(`✅ Auto-merged ${totalMerged} duplicate books for user ${auth.user.id}`);

    res.json({
      success: true,
      merged: totalMerged,
      message: `Merged ${totalMerged} duplicate books`,
    });
  } catch (error) {
    console.error('Error auto-merging:', error);
    res.status(500).json({ error: 'Failed to auto-merge duplicates' });
  }
});



// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');

  if (redisClient && isRedisReady) {
    try {
      await redisClient.quit();
      console.log('✅ Redis connection closed');
    } catch (err) {
      console.error('Error closing Redis:', err);
    }
  }

  if (mariaPool) {
    try {
      await mariaPool.end();
      console.log('✅ MariaDB connection pool closed');
    } catch (err) {
      console.error('Error closing MariaDB:', err);
    }
  }

  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  if (redisClient && isRedisReady) {
    try {
      await redisClient.quit();
      console.log('✅ Redis connection closed');
    } catch (err) {
      console.error('Error closing Redis:', err);
    }
  }
  if (mariaPool) {
    try {
      await mariaPool.end();
      console.log('✅ MariaDB connection pool closed');
    } catch (err) {
      console.error('Error closing MariaDB:', err);
    }
  }
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✅ OpenAI API Key: ${process.env.OPENAI_API_KEY ? 'Configured' : '❌ MISSING'}`);
  console.log(`✅ Redis: ${isRedisReady ? 'Connected (caching enabled)' : 'Not configured (caching disabled)'}`);
});
