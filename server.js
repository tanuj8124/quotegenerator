const express = require('express');
const cors = require("cors");
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Load quotes database at startup
let quotesDatabase = [];
let booksList = [];
const QUOTES_FILE = path.join(__dirname, 'data', 'quotes_database.json');

function loadQuotesDatabase() {
  try {
    if (!fs.existsSync(QUOTES_FILE)) {
      console.error('❌ Error: quotes_database.json not found!');
      console.log('📝 Please generate the quotes database first.');
      console.log('   Run: node scripts/extract_quotes.js');
      process.exit(1);
    }

    const data = fs.readFileSync(QUOTES_FILE, 'utf8');
    quotesDatabase = JSON.parse(data);
    
    if (!Array.isArray(quotesDatabase) || quotesDatabase.length === 0) {
      console.error('❌ Error: quotes_database.json is empty or invalid!');
      process.exit(1);
    }

    // Extract unique book names
    booksList = [...new Set(quotesDatabase.map(q => q.book))].filter(Boolean);
    
    console.log(`✅ Loaded ${quotesDatabase.length} quotes from database`);
    console.log(`📚 Found ${booksList.length} books:`, booksList);
  } catch (error) {
    console.error('❌ Error loading quotes database:', error.message);
    process.exit(1);
  }
}

// Track served quotes to avoid repetition (optional feature)
const servedQuotes = new Set();
const servedQuotesByBook = {}; // Track served quotes per book

// Helper function to get random quote from all books
function getRandomQuote(avoidRepeat = false) {
  if (quotesDatabase.length === 0) {
    return null;
  }

  // Reset served quotes if all have been shown
  if (avoidRepeat && servedQuotes.size >= quotesDatabase.length) {
    servedQuotes.clear();
    console.log('🔄 All quotes served, resetting...');
  }

  let quote;
  let attempts = 0;
  const maxAttempts = 100;

  do {
    const randomIndex = Math.floor(Math.random() * quotesDatabase.length);
    quote = quotesDatabase[randomIndex];
    attempts++;

    if (!avoidRepeat || !servedQuotes.has(quote.id) || attempts >= maxAttempts) {
      break;
    }
  } while (servedQuotes.has(quote.id));

  if (avoidRepeat) {
    servedQuotes.add(quote.id);
  }

  return quote;
}

// Helper function to get random quote from a specific book
function getRandomQuoteFromBook(bookName, avoidRepeat = false) {
  const bookQuotes = quotesDatabase.filter(q => q.book === bookName);
  
  if (bookQuotes.length === 0) {
    return null;
  }

  // Initialize tracking for this book if needed
  if (!servedQuotesByBook[bookName]) {
    servedQuotesByBook[bookName] = new Set();
  }

  // Reset served quotes if all have been shown for this book
  if (avoidRepeat && servedQuotesByBook[bookName].size >= bookQuotes.length) {
    servedQuotesByBook[bookName].clear();
    console.log(`🔄 All quotes from "${bookName}" served, resetting...`);
  }

  let quote;
  let attempts = 0;
  const maxAttempts = 100;

  do {
    const randomIndex = Math.floor(Math.random() * bookQuotes.length);
    quote = bookQuotes[randomIndex];
    attempts++;

    if (!avoidRepeat || !servedQuotesByBook[bookName].has(quote.id) || attempts >= maxAttempts) {
      break;
    }
  } while (servedQuotesByBook[bookName].has(quote.id));

  if (avoidRepeat) {
    servedQuotesByBook[bookName].add(quote.id);
  }

  return quote;
}

// Helper function to convert book name to URL-friendly slug
function bookNameToSlug(bookName) {
  return bookName.toLowerCase()
    .replace(/\.pdf$/, '') // Remove .pdf extension
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/_/g, '-') // Convert underscores to hyphens
    .replace(/-+/g, '-')
    .trim();
}

// API Routes

/**
 * GET /quote
 * Returns a random quote from ALL books (original endpoint)
 * Query params:
 *   - unique: true/false (avoid repeating quotes)
 */
app.get('/quote', (req, res) => {
  stats.total_requests++;
  stats.quote_requests++;
  saveStats();
  const avoidRepeat = req.query.unique === 'true';
  const quote = getRandomQuote(avoidRepeat);

  if (!quote) {
    return res.status(500).json({
      error: 'No quotes available'
    });
  }

  res.json({
    quote: quote.text,
    page: quote.page,
    id: quote.id,
    book: quote.book
  });
});

/**
 * GET /books
 * Returns list of all available books
 */
app.get('/books', (req, res) => {
  const booksWithCounts = booksList.map(book => {
    const count = quotesDatabase.filter(q => q.book === book).length;
    const slug = bookNameToSlug(book);
    return {
      name: book,
      slug: slug,
      quote_count: count,
      endpoint: `/quote/book/${slug}`
    };
  });

  res.json({
    total_books: booksList.length,
    books: booksWithCounts
  });
});

/**
 * GET /quote/book/:bookSlug
 * Returns a random quote from a specific book
 * Query params:
 *   - unique: true/false (avoid repeating quotes from this book)
 */
app.get('/quote/book/:bookSlug', (req, res) => {
  const bookSlug = req.params.bookSlug.toLowerCase();
  const avoidRepeat = req.query.unique === 'true';
  stats.total_requests++;
  stats.quote_requests++;
  saveStats();
  
  // Find the book by matching slug
  const bookName = booksList.find(book => bookNameToSlug(book) === bookSlug);
  
  if (!bookName) {
    return res.status(404).json({
      error: 'Book not found',
      available_books: booksList.map(book => ({
        name: book,
        slug: bookNameToSlug(book)
      }))
    });
  }

  const quote = getRandomQuoteFromBook(bookName, avoidRepeat);

  if (!quote) {
    return res.status(500).json({
      error: `No quotes available for book: ${bookName}`
    });
  }

  res.json({
    quote: quote.text,
    page: quote.page,
    id: quote.id,
    book: quote.book
  });
});

/**
 * GET /quote/:id
 * Returns a specific quote by ID
 */
app.get('/quote/:id', (req, res) => {
  const quoteId = parseInt(req.params.id);

  if (isNaN(quoteId)) {
    return res.status(400).json({
      error: 'Invalid quote ID'
    });
  }

  const quote = quotesDatabase.find(q => q.id === quoteId);

  if (!quote) {
    return res.status(404).json({
      error: 'Quote not found'
    });
  }

  res.json({
    quote: quote.text,
    page: quote.page,
    id: quote.id,
    book: quote.book,
    pdf_link: `/pdfjs/web/viewer.html?file=../../books/book.pdf#page=${quote.page}`
  });
});
app.get('/stats/requests', (req, res) => {
  res.json(stats);
});

/**
 * GET /stats
 * Returns statistics about the quotes database
 */
app.get('/stats', (req, res) => {
  const bookStats = booksList.map(book => ({
    name: book,
    slug: bookNameToSlug(book),
    total_quotes: quotesDatabase.filter(q => q.book === book).length,
    served_quotes: (servedQuotesByBook[book] || new Set()).size
  }));

  res.json({
    total_quotes: quotesDatabase.length,
    total_books: booksList.length,
    served_quotes_overall: servedQuotes.size,
    remaining_quotes_overall: quotesDatabase.length - servedQuotes.size,
    books: bookStats
  });
});

/**
 * POST /reset
 * Resets the served quotes tracker
 * Query params:
 *   - book: book slug (optional, resets specific book)
 */
app.post('/reset', (req, res) => {
  const bookSlug = req.query.book;

  if (bookSlug) {
    // Reset specific book
    const bookName = booksList.find(book => bookNameToSlug(book) === bookSlug.toLowerCase());
    
    if (!bookName) {
      return res.status(404).json({
        error: 'Book not found'
      });
    }

    if (servedQuotesByBook[bookName]) {
      servedQuotesByBook[bookName].clear();
    }

    return res.json({
      message: `Served quotes tracker reset for book: ${bookName}`,
      book: bookName,
      total_quotes: quotesDatabase.filter(q => q.book === bookName).length
    });
  }

  // Reset all trackers
  servedQuotes.clear();
  Object.keys(servedQuotesByBook).forEach(book => {
    servedQuotesByBook[book].clear();
  });

  res.json({
    message: 'All served quotes trackers reset successfully',
    total_quotes: quotesDatabase.length
  });
});

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    quotes_loaded: quotesDatabase.length > 0,
    total_quotes: quotesDatabase.length,
    total_books: booksList.length
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found'
  });
});



const STATS_FILE = path.join(__dirname, 'data', 'stats.json');
let stats = { total_requests: 0, quote_requests: 0, book_quote_requests: 0 };

function loadStats() {
  try {
    if (fs.existsSync(STATS_FILE)) {
      stats = JSON.parse(fs.readFileSync(STATS_FILE, "utf8"));
    }
  } catch (err) {
    console.error("Error loading stats file:", err);
  }
}


function saveStats() {
  fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
}

// Initialize and start server
function startServer() {
    loadQuotesDatabase();
  loadStats();
  loadQuotesDatabase();
  
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`\n📖 Available Endpoints:`);
    console.log(`   GET  /quote              - Random quote from all books`);
    console.log(`   GET  /books              - List all available books`);
    console.log(`   GET  /quote/book/:slug   - Random quote from specific book`);
    console.log(`   GET  /quote/:id          - Get specific quote by ID`);
    console.log(`   GET  /stats              - Database statistics`);
    console.log(`   POST /reset              - Reset served quotes tracker`);
    console.log(`   GET  /health             - Health check`);
    
    if (booksList.length > 0) {
      console.log(`\n📚 Book-Specific Endpoints:`);
      booksList.forEach(book => {
        const slug = bookNameToSlug(book);
        console.log(`   GET  /quote/book/${slug}`);
      });
    }
  });
}

startServer();