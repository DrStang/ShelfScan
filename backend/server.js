// server.js - Backend API for Book Spine Scanner
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const redis = require('redis');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy - needed for Railway/Heroku/etc to get real IP addresses
app.set('trust proxy', 1);

// Redis client setup
let redisClient;
let isRedisReady = false;

(async () => {
  try {
    // Redis connection - works with Upstash Redis or local Redis
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            console.log('❌ Redis: Too many retries, giving up');
            return new Error('Too many retries');
          }
          return retries * 1000;
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

    await redisClient.connect();
  } catch (err) {
    console.warn('⚠️  Redis not available, caching disabled:', err.message);
    isRedisReady = false;
  }
})();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
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
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    redis: isRedisReady ? 'connected' : 'disconnected'
  });
});

// Helper function to get from cache
async function getFromCache(key) {
  if (!isRedisReady) return null;
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
  if (!isRedisReady) return;
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
      
      return {
        title: book.title || title,
        author: book.author_name?.[0] || author,
        rating: rating,
        ratingsCount: ratingsCount,
        description: book.first_sentence?.[0] || '',
        thumbnail: book.cover_i 
          ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`
          : null,
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
      
      return {
        title: bookInfo.title || title,
        author: bookInfo.authors?.[0] || author,
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
    console.error('Google Books API error:', error.message);
    return null;
  }
}

// Helper function to merge book data from multiple sources
function mergeBookData(googleBook, openLibBook, originalTitle, originalAuthor) {
  // If we have no data from any source, return null
  if (!googleBook && !openLibBook) return null;
  
  // Priority: Google Books > Open Library for ratings
  let rating = 0;
  let ratingsCount = 0;
  let ratingSource = 'No ratings available';

  if (googleBook?.rating > 0) {
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
  
  // Get ISBN for Goodreads link
  const isbn = primary.isbn || secondary.isbn;
  
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
    // Add Goodreads link (no scraping, just a link)
    goodreadsUrl: isbn ? `https://www.goodreads.com/book/isbn/${isbn}` : 
                  `https://www.goodreads.com/search?q=${encodeURIComponent(`${originalTitle} ${originalAuthor}`)}`,
    sources: [
      googleBook ? 'Google Books' : null,
      openLibBook ? 'Open Library' : null
    ].filter(Boolean)
  };
}

// Main scan endpoint
app.post('/api/scan', async (req, res) => {
  try {
    const { image } = req.body;

    // Validation
    if (!image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    if (!image.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Invalid image format' });
    }

    // Check OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY not configured');
      return res.status(500).json({ error: 'Server configuration error' });
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
    
    // Parse extracted books
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
        // Create cache key based on title + author
        const cacheKey = `book:${book.title.toLowerCase()}:${book.author.toLowerCase()}`;
        
        // Check cache first
        const cached = await getFromCache(cacheKey);
        if (cached) {
          console.log(`✅ Cache hit: ${book.title}`);
          return cached;
        }
        
        // Query Google Books and Open Library in parallel
        const [googleBook, openLibBook] = await Promise.all([
          searchGoogleBooks(book.title, book.author),
          searchOpenLibrary(book.title, book.author)
        ]);
        
        // Merge the data from both sources
        const mergedData = mergeBookData(googleBook, openLibBook, book.title, book.author);
        
        // Cache the result
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
      totalProcessed: validBooks.length
    });

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ 
      error: 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
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

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  if (redisClient) {
    await redisClient.quit();
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
