const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Load quotes database at startup
let quotesDatabase = [];
const QUOTES_FILE = path.join(__dirname, 'data', 'quotes_database.json');
import cors from "cors";
app.use(cors({ origin: "*" }));

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

    console.log(`✅ Loaded ${quotesDatabase.length} quotes from database`);
  } catch (error) {
    console.error('❌ Error loading quotes database:', error.message);
    process.exit(1);
  }
}

// Track served quotes to avoid repetition (optional feature)
const servedQuotes = new Set();

// Helper function to get random quote
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

    // Break if we've tried too many times or not avoiding repeats
    if (!avoidRepeat || !servedQuotes.has(quote.id) || attempts >= maxAttempts) {
      break;
    }
  } while (servedQuotes.has(quote.id));

  if (avoidRepeat) {
    servedQuotes.add(quote.id);
  }

  return quote;
}

// API Routes

/**
 * GET /quote
 * Returns a random quote from the book
 * Query params:
 *   - unique: true/false (avoid repeating quotes)
 */
app.get('/quote', (req, res) => {
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
    pdf_link: `/pdfjs/web/viewer.html?file=../../books/book.pdf#page=${quote.page}`
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
    pdf_link: `/pdfjs/web/viewer.html?file=../../books/book.pdf#page=${quote.page}`
  });
});

/**
 * GET /stats
 * Returns statistics about the quotes database
 */
app.get('/stats', (req, res) => {
  res.json({
    total_quotes: quotesDatabase.length,
    served_quotes: servedQuotes.size,
    remaining_quotes: quotesDatabase.length - servedQuotes.size
  });
});

/**
 * POST /reset
 * Resets the served quotes tracker
 */
app.post('/reset', (req, res) => {
  servedQuotes.clear();
  res.json({
    message: 'Served quotes tracker reset successfully',
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
    total_quotes: quotesDatabase.length
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

// Initialize and start server
function startServer() {
  loadQuotesDatabase();
  
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📖 Quote endpoint: http://localhost:${PORT}/quote`);
    console.log(`📊 Stats endpoint: http://localhost:${PORT}/stats`);
  });
}

startServer();