// server.js - Backend API for Book Spine Scanner
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const cheerio = require('cheerio');
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

// Goodreads scraping rate limiter - 5 requests per minute
const goodreadsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  skipSuccessfulRequests: false,
  message: { error: 'Goodreads rate limit reached. Please wait a moment.' }
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

// Debug endpoint for testing Goodreads scraping
app.get('/api/debug-goodreads/:isbn', async (req, res) => {
  const { isbn } = req.params;
  
  try {
    console.log(`\n=== DEBUG: Testing ISBN ${isbn} ===`);
    
    const url = `https://www.goodreads.com/book/isbn/${isbn}`;
    console.log(`Fetching: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    });
    
    if (!response.ok) {
      return res.json({
        error: `Goodreads returned ${response.status}`,
        url: url
      });
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Extract all the data we're looking for
    const debug = {
      url: url,
      statusCode: response.status,
      metaRating: $('meta[itemprop="ratingValue"]').attr('content'),
      metaCount: $('meta[itemprop="ratingCount"]').attr('content'),
      title: $('h1[data-testid="bookTitle"]').text().trim() || $('h1').first().text().trim(),
      author: $('[data-testid="name"]').first().text().trim() || $('a.authorName').first().text().trim(),
      htmlSnippet: html.substring(0, 2000),
      foundSelectors: {}
    };
    
    // Check all possible selectors
    const selectorsToTry = [
      'meta[itemprop="ratingValue"]',
      'span[itemprop="ratingValue"]',
      '.RatingStatistics__rating',
      '[data-testid="averageRating"]',
      'script[type="application/ld+json"]'
    ];
    
    selectorsToTry.forEach(selector => {
      const elem = $(selector);
      if (elem.length) {
        debug.foundSelectors[selector] = elem.first().text().trim() || elem.first().attr('content') || 'exists';
      }
    });
    
    // Try JSON-LD
    const scriptTags = $('script[type="application/ld+json"]');
    if (scriptTags.length) {
      debug.jsonLD = [];
      scriptTags.each((i, elem) => {
        try {
          debug.jsonLD.push(JSON.parse($(elem).html()));
        } catch (e) {
          debug.jsonLD.push({ error: 'Failed to parse' });
        }
      });
    }
    
    res.json(debug);
    
  } catch (error) {
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
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

// Helper function to scrape Goodreads
async function scrapeGoodreads(isbn, title, author) {
  if (!isbn && (!title || !author)) {
    console.log('Skipping Goodreads: No ISBN or title/author provided');
    return null;
  }

  // Check cache first
  const cacheKey = `goodreads:${isbn || `${title}:${author}`}`;
  const cached = await getFromCache(cacheKey);
  if (cached) {
    console.log(`✅ Goodreads cache hit for: ${title}`);
    return cached;
  }

  try {
    // Build search URL - prefer ISBN, fallback to title+author search
    let searchUrl;
    if (isbn) {
      // Try direct book page first (more reliable)
      searchUrl = `https://www.goodreads.com/book/isbn/${isbn}`;
    } else {
      searchUrl = `https://www.goodreads.com/search?q=${encodeURIComponent(`${title} ${author}`)}`;
    }

    console.log(`🔍 Scraping Goodreads: ${title} (${isbn ? 'ISBN: ' + isbn : 'Title/Author search'})`);

    // Add delay to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 1200));

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0'
      }
    });

    if (!response.ok) {
      console.warn(`Goodreads returned ${response.status} for: ${title}`);
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    let bookUrl = searchUrl;
    
    // If we searched (not direct ISBN), get first result link
    if (!isbn) {
      const firstResult = $('.bookTitle').first();
      if (!firstResult.length) {
        console.warn(`No Goodreads search results found for: ${title}`);
        return null;
      }
      const bookPath = firstResult.attr('href');
      if (!bookPath) return null;
      bookUrl = `https://www.goodreads.com${bookPath}`;
      
      // Fetch the actual book page
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      const bookResponse = await fetch(bookUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
      });

      if (!bookResponse.ok) {
        console.warn(`Failed to fetch book page: ${bookUrl}`);
        return null;
      }

      const bookHtml = await bookResponse.text();
      $ = cheerio.load(bookHtml);
    }

    // Extract rating - try multiple selectors (Goodreads changes layout frequently)
    let rating = 0;
    let ratingsCount = 0;

    // Debug: Log what we're looking for
    console.log(`Parsing HTML for: ${title}`);

    // Method 1: Try meta tags (most reliable)
    const ratingMeta = $('meta[itemprop="ratingValue"]').attr('content');
    const countMeta = $('meta[itemprop="ratingCount"]').attr('content');
    
    console.log(`Meta tags - rating: ${ratingMeta}, count: ${countMeta}`);

    if (ratingMeta) {
      rating = parseFloat(ratingMeta);
      if (countMeta) {
        ratingsCount = parseInt(countMeta.replace(/,/g, ''));
      }
    } else {
      // Method 2: Look for any element with rating data
      // Try to find the rating in JSON-LD structured data
      const scriptTags = $('script[type="application/ld+json"]');
      scriptTags.each((i, elem) => {
        try {
          const jsonData = JSON.parse($(elem).html());
          if (jsonData.aggregateRating) {
            rating = parseFloat(jsonData.aggregateRating.ratingValue) || 0;
            ratingsCount = parseInt(jsonData.aggregateRating.ratingCount) || 0;
            console.log(`Found in JSON-LD: ${rating}⭐ (${ratingsCount} ratings)`);
          }
        } catch (e) {
          // Skip invalid JSON
        }
      });

      // Method 3: Try various CSS selectors
      if (rating === 0) {
        const possibleRatingSelectors = [
          '.RatingStatistics__rating',
          '[class*="RatingStars__rating"]',
          '[data-testid="averageRating"]',
          '.average[itemprop="ratingValue"]',
          'span[itemprop="ratingValue"]',
          '[class*="bookPageMetadata"]',
          'div[class*="RatingStatistics"] span',
        ];

        for (const selector of possibleRatingSelectors) {
          const elem = $(selector).first();
          if (elem.length) {
            const text = elem.text().trim();
            console.log(`Trying selector "${selector}": "${text}"`);
            const ratingMatch = text.match(/(\d+\.?\d*)/);
            if (ratingMatch) {
              rating = parseFloat(ratingMatch[1]);
              if (rating > 0 && rating <= 5) {
                console.log(`Extracted rating from "${selector}": ${rating}`);
                break;
              }
            }
          }
        }
      }

      // Method 4: Try to find ratings count
      if (rating > 0 && ratingsCount === 0) {
        const possibleCountSelectors = [
          '.RatingStatistics__meta',
          '[data-testid="ratingsCount"]',
          '[class*="RatingStatistics"]',
          'span[data-testid="ratingsCount"]',
          'meta[itemprop="reviewCount"]'
        ];

        for (const selector of possibleCountSelectors) {
          const elem = $(selector).first();
          if (elem.length) {
            const text = elem.attr('content') || elem.text();
            const cleanCount = text.replace(/[,\s]/g, '');
            const countMatch = cleanCount.match(/(\d+)/);
            if (countMatch) {
              ratingsCount = parseInt(countMatch[1]);
              if (ratingsCount > 0) {
                console.log(`Extracted count from "${selector}": ${ratingsCount}`);
                break;
              }
            }
          }
        }
      }
    }

    if (rating > 0) {
      const result = {
        rating: rating,
        ratingsCount: ratingsCount,
        url: bookUrl,
        source: 'goodreads'
      };

      // Cache the result
      await setCache(cacheKey, result);
      console.log(`✅ Goodreads found: ${title} - ${rating}⭐ (${ratingsCount.toLocaleString()} ratings)`);
      
      return result;
    }

    // Debug: Save HTML snippet if rating not found (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.log(`HTML snippet (first 1000 chars):\n${html.substring(0, 1000)}`);
    }
    
    console.warn(`Could not extract rating from Goodreads for: ${title}`);
    return null;

  } catch (error) {
    console.error(`Goodreads scraping error for "${title}":`, error.message);
    return null;
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
function mergeBookData(googleBook, openLibBook, goodreadsBook, originalTitle, originalAuthor) {
  // If we have no data from any source, return null
  if (!googleBook && !openLibBook && !goodreadsBook) return null;
  
  // Priority: Goodreads > Google Books > Open Library for ratings
  let rating = 0;
  let ratingsCount = 0;
  let ratingSource = 'No ratings available';

  if (goodreadsBook?.rating > 0) {
    rating = goodreadsBook.rating;
    ratingsCount = goodreadsBook.ratingsCount;
    ratingSource = `Goodreads (${ratingsCount.toLocaleString()} reviews)`;
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
    infoLink: googleBook?.infoLink || goodreadsBook?.url || null,
    isbn: primary.isbn || secondary.isbn || null,
    publishYear: primary.publishYear || secondary.publishYear || null,
    goodreadsUrl: goodreadsBook?.url || null,
    sources: [
      googleBook ? 'Google Books' : null,
      openLibBook ? 'Open Library' : null,
      goodreadsBook ? 'Goodreads' : null
    ].filter(Boolean)
  };
}

// Main scan endpoint
app.post('/api/scan', async (req, res) => {
  try {
    const { image, useGoodreads = true } = req.body;

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

    console.log(`Found ${extractedBooks.length} books, fetching enriched data...`);

    // Step 2: Get data from all sources including Goodreads
    const bookPromises = extractedBooks.map(async (book) => {
      try {
        // Query Google Books and Open Library in parallel
        const [googleBook, openLibBook] = await Promise.all([
          searchGoogleBooks(book.title, book.author),
          searchOpenLibrary(book.title, book.author)
        ]);
        
        // Get ISBN from either source for Goodreads lookup
        const isbn = googleBook?.isbn || openLibBook?.isbn;
        
        // Query Goodreads if enabled (with rate limiting)
        let goodreadsBook = null;
        if (useGoodreads) {
          goodreadsBook = await scrapeGoodreads(isbn, book.title, book.author);
        }
        
        // Merge the data from all sources
        return mergeBookData(googleBook, openLibBook, goodreadsBook, book.title, book.author);
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
  console.log(`✅ Redis: ${isRedisReady ? 'Connected' : 'Not configured (caching disabled)'}`);
});
