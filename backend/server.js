// server.js - Backend API for Book Spine Scanner
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const redis = require('redis');
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');
const Papa = require('papaparse');
const multer = require('multer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy - needed for Railway/Heroku/etc to get real IP addresses
app.set('trust proxy', 1);

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
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
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000', 
    'https://shelfscan.xyz',
    'capacitor://localhost',
    'ionic://localhost',
    'http://localhost',
    'https://localhost'
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
      amazonUrl = `https://www.amazon.com/dp/${amazonIsbn}?tag=${AMAZON_AFFILIATE_TAG}`;
    } else {
      // ISBN-13 or unexpected format - use search with ISBN
      const searchQuery = encodeURIComponent(`${originalTitle} ${originalAuthor} ISBN ${cleanIsbn}`);
      amazonUrl = `https://www.amazon.com/s?k=${searchQuery}&tag=${AMAZON_AFFILIATE_TAG}`;
      console.log(`Using search URL for ISBN: ${cleanIsbn}`);
    }
  } else {
    // No ISBN available, create a search link
    const searchQuery = encodeURIComponent(`${originalTitle} ${originalAuthor}`);
    amazonUrl = `https://www.amazon.com/s?k=${searchQuery}&tag=${AMAZON_AFFILIATE_TAG}`;
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
        
        const mergedData = mergeBookData(googleBook, openLibBook, book.title, book.author);
        
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
