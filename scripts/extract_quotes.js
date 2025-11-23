const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

const PDF_PATH = path.join(__dirname, '..', 'books', 'book.pdf');
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'quotes_database.json');

// Configuration
const MIN_LINE_LENGTH = 50; // Minimum characters for a valid line
const MAX_LINE_LENGTH = 50000; // Maximum characters for a valid line

/**
 * Clean and normalize Hindi text
 */
function cleanText(text) {
  return text
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/\n+/g, ' ') // Replace newlines with space
    .replace(/[^\u0900-\u097F\u0020-\u007E।॥]/g, '') // Keep Hindi, basic Latin, and Hindi punctuation
    .trim();
}

/**
 * Split text into meaningful sentences
 */
function extractSentences(text) {
  // Split by Hindi sentence delimiters (।) and period
  const sentences = text
    .split(/[।॥\.]+/)
    .map(s => cleanText(s))
    .filter(s => s.length >= MIN_LINE_LENGTH && s.length <= MAX_LINE_LENGTH)
    .filter(s => s.trim().length > 0);

  return sentences;
}

/**
 * Extract quotes from PDF
 */
async function extractQuotesFromPDF() {
  try {
    console.log('📖 Reading PDF file...');
    
    if (!fs.existsSync(PDF_PATH)) {
      console.error(`❌ Error: PDF file not found at ${PDF_PATH}`);
      console.log('📝 Please place your Hindi book PDF at:');
      console.log(`   ${PDF_PATH}`);
      process.exit(1);
    }

    const dataBuffer = fs.readFileSync(PDF_PATH);
    
    console.log('🔍 Parsing PDF content...');
    const pdfData = await pdf(dataBuffer);
    
    console.log(`📄 Total pages: ${pdfData.numpages}`);
    
    const quotes = [];
    let quoteId = 0;

    // Extract text page by page
    console.log('✂️  Extracting sentences...');
    
    // Process entire text by pages
    const pageTexts = await extractPageWiseText(dataBuffer, pdfData.numpages);
    
    for (let pageNum = 1; pageNum <= pdfData.numpages; pageNum++) {
      const pageText = pageTexts[pageNum - 1] || '';
      
      if (pageText.trim().length === 0) {
        continue;
      }

      const sentences = extractSentences(pageText);
      
      for (const sentence of sentences) {
        if (sentence) {
          quotes.push({
            id: quoteId++,
            page: pageNum,
            text: sentence
          });
        }
      }
      
      // Progress indicator
      if (pageNum % 10 === 0) {
        console.log(`   Processed ${pageNum}/${pdfData.numpages} pages...`);
      }
    }

    console.log(`✅ Extracted ${quotes.length} quotes from ${pdfData.numpages} pages`);

    // Ensure data directory exists
    const dataDir = path.dirname(OUTPUT_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Save to JSON file
    console.log('💾 Saving to database...');
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(quotes, null, 2), 'utf8');
    
    console.log(`✅ Successfully saved ${quotes.length} quotes to:`);
    console.log(`   ${OUTPUT_PATH}`);
    console.log('\n🎉 Quote database generation complete!');
    console.log('   You can now start the server with: node server.js');

    // Display sample quotes
    console.log('\n📝 Sample quotes:');
    const samples = quotes.slice(0, 3);
    samples.forEach(q => {
      console.log(`   [ID: ${q.id}, Page: ${q.page}] ${q.text.substring(0, 60)}...`);
    });

  } catch (error) {
    console.error('❌ Error extracting quotes:', error.message);
    process.exit(1);
  }
}

/**
 * Extract text page by page (more accurate page tracking)
 */
async function extractPageWiseText(dataBuffer, numPages) {
  const pageTexts = [];
  
  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    try {
      const data = await pdf(dataBuffer, {
        max: pageNum,
        version: 'v2.0.550'
      });
      
      // Get only the current page text
      const fullText = data.text;
      const currentPageText = fullText.split('\n\n').slice(-1)[0] || fullText;
      
      pageTexts.push(currentPageText);
    } catch (err) {
      console.warn(`⚠️  Warning: Could not extract text from page ${pageNum}`);
      pageTexts.push('');
    }
  }
  
  return pageTexts;
}

// Run the extraction
console.log('🚀 Starting quote extraction from PDF...\n');
extractQuotesFromPDF();