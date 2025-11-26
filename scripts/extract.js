const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

const BOOKS_DIR = path.join(__dirname, '..', 'books');
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
 * Extract text page by page with custom page renderer
 */
async function extractPageWiseText(pdfPath) {
  const dataBuffer = fs.readFileSync(pdfPath);
  
  const pageTexts = [];
  
  // Custom page render function to capture individual pages
  const options = {
    pagerender: async (pageData) => {
      const textContent = await pageData.getTextContent();
      let pageText = '';
      
      textContent.items.forEach((item) => {
        if (item.str) {
          pageText += item.str + ' ';
        }
      });
      
      // Store page text in array
      pageTexts.push(pageText.trim());
      
      return pageText;
    }
  };
  
  try {
    const data = await pdfParse(dataBuffer, options);
    return {
      numPages: data.numpages,
      pageTexts: pageTexts
    };
  } catch (error) {
    console.error('Error in page-wise extraction:', error.message);
    // Fallback: extract all text and split evenly
    const data = await pdfParse(dataBuffer);
    const allText = data.text;
    const numPages = data.numpages;
    const avgCharsPerPage = Math.ceil(allText.length / numPages);
    
    const fallbackPages = [];
    for (let i = 0; i < numPages; i++) {
      fallbackPages.push(allText.substring(i * avgCharsPerPage, (i + 1) * avgCharsPerPage));
    }
    
    return {
      numPages: numPages,
      pageTexts: fallbackPages
    };
  }
}

/**
 * Get all PDF files from books directory
 */
function getPDFFiles() {
  if (!fs.existsSync(BOOKS_DIR)) {
    console.error(`❌ Error: Books directory not found at ${BOOKS_DIR}`);
    console.log('📝 Please create the directory and add PDF files:');
    console.log(`   ${BOOKS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(BOOKS_DIR);
  const pdfFiles = files.filter(file => path.extname(file).toLowerCase() === '.pdf');

  if (pdfFiles.length === 0) {
    console.error(`❌ Error: No PDF files found in ${BOOKS_DIR}`);
    console.log('📝 Please add PDF files to the books directory');
    process.exit(1);
  }

  return pdfFiles;
}

/**
 * Extract quotes from a single PDF
 */
async function extractQuotesFromPDF(pdfPath, bookName) {
  try {
    console.log(`\n📖 Reading: ${bookName}`);
    
    console.log('🔍 Parsing PDF content...');
    const { numPages, pageTexts } = await extractPageWiseText(pdfPath);
    
    console.log(`📄 Total pages: ${numPages}`);
    
    const quotes = [];

    // Extract sentences from each page
    console.log('✂️  Extracting sentences...');
    
    for (let i = 0; i < pageTexts.length; i++) {
      const pageNum = i + 1;
      const pageText = pageTexts[i];
      
      if (pageText.trim().length === 0) {
        continue;
      }

      const sentences = extractSentences(pageText);
      
      for (const sentence of sentences) {
        if (sentence) {
          quotes.push({
            book: bookName,
            page: pageNum,
            text: sentence
          });
        }
      }
      
      // Progress indicator
      if (pageNum % 10 === 0) {
        console.log(`   Processed ${pageNum}/${numPages} pages...`);
      }
    }

    console.log(`✅ Extracted ${quotes.length} quotes from ${bookName}`);
    return quotes;

  } catch (error) {
    console.error(`❌ Error processing ${bookName}:`, error.message);
    return [];
  }
}

/**
 * Main function to process all PDFs
 */
async function processAllPDFs() {
  try {
    console.log('🚀 Starting quote extraction from all PDFs...\n');
    
    // Get all PDF files
    const pdfFiles = getPDFFiles();
    console.log(`📚 Found ${pdfFiles.length} PDF file(s):\n`);
    pdfFiles.forEach((file, index) => {
      console.log(`   ${index + 1}. ${file}`);
    });

    // Process each PDF
    let allQuotes = [];
    let quoteId = 0;

    for (const pdfFile of pdfFiles) {
      const pdfPath = path.join(BOOKS_DIR, pdfFile);
      const bookName = path.basename(pdfFile, '.pdf');
      
      const quotes = await extractQuotesFromPDF(pdfPath, bookName);
      
      // Add sequential IDs to quotes
      quotes.forEach(quote => {
        quote.id = quoteId++;
      });
      
      allQuotes = allQuotes.concat(quotes);
    }

    console.log(`\n📊 Total quotes extracted: ${allQuotes.length}`);

    // Ensure data directory exists
    const dataDir = path.dirname(OUTPUT_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Save to JSON file
    console.log('💾 Saving to database...');
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(allQuotes, null, 2), 'utf8');
    
    console.log(`✅ Successfully saved ${allQuotes.length} quotes to:`);
    console.log(`   ${OUTPUT_PATH}`);
    console.log('\n🎉 Quote database generation complete!');
    console.log('   You can now start the server with: node server.js');

    // Display sample quotes from each book
    console.log('\n📝 Sample quotes by book:');
    const bookNames = [...new Set(allQuotes.map(q => q.book))];
    bookNames.forEach(bookName => {
      const bookQuotes = allQuotes.filter(q => q.book === bookName);
      const sample = bookQuotes[0];
      if (sample) {
        console.log(`\n   📖 ${bookName}:`);
        console.log(`      [ID: ${sample.id}, Page: ${sample.page}]`);
        console.log(`      ${sample.text.substring(0, 80)}...`);
      }
    });

    // Summary statistics
    console.log('\n📈 Summary by book:');
    bookNames.forEach(bookName => {
      const count = allQuotes.filter(q => q.book === bookName).length;
      console.log(`   ${bookName}: ${count} quotes`);
    });

  } catch (error) {
    console.error('❌ Error processing PDFs:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the extraction
console.log('🚀 Starting quote extraction from PDF...\n');
processAllPDFs();