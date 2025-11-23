import express from "express";
import cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// Load quotes from extracted book text
let quotes = [];
try {
  quotes = JSON.parse(fs.readFileSync("quotes.json", "utf-8"));
  console.log(`✅ Loaded ${quotes.length} sentences from book`);
} catch (err) {
  console.error("⚠️ quotes.json not found. Please run extract_pdf.py first");
}

// Store recently used quotes to avoid repetition
const usedQuotes = new Set();
const MAX_USED_CACHE = 50;

// Helper function to get random unused sentence
function getRandomSentence() {
  if (usedQuotes.size >= quotes.length) {
    usedQuotes.clear(); // Reset if all used
  }
  
  let sentence;
  let attempts = 0;
  do {
    sentence = quotes[Math.floor(Math.random() * quotes.length)];
    attempts++;
  } while (usedQuotes.has(sentence) && attempts < 20);
  
  usedQuotes.add(sentence);
  if (usedQuotes.size > MAX_USED_CACHE) {
    const firstItem = usedQuotes.values().next().value;
    usedQuotes.delete(firstItem);
  }
  
  return sentence;
}

// GET /quote - Generate a random Hindi quote
app.get("/quote", async (req, res) => {
  if (quotes.length === 0) {
    return res.status(503).json({ 
      error: "No quotes available. Please extract PDF text first." 
    });
  }

  const randomSentence = getRandomSentence();
  
  const prompt = `
Sentence from Hindi book: "${randomSentence}"

Task: Transform this into a short, meaningful, inspirational Hindi quote.
Requirements:
- Maximum 25 words
- Keep it motivational and uplifting
- Preserve the core wisdom
- Use simple, elegant Hindi
- Return ONLY the quote, no explanation or extra text

Quote:`;

  try {
    const response = await model.generateContent(prompt);
    const generatedQuote = response.response.text().trim();
    
    res.json({ 
      quote: generatedQuote,
      source: randomSentence.substring(0, 100) + "...",
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("❌ Gemini API Error:", err);
    res.status(500).json({ 
      error: "Failed to generate quote",
      details: err.message 
    });
  }
});

// GET /quote/size - Get size/length information of a quote
app.get("/quote/size", async (req, res) => {
  if (quotes.length === 0) {
    return res.status(503).json({ 
      error: "No quotes available. Please extract PDF text first." 
    });
  }

  const randomSentence = getRandomSentence();
  
  const prompt = `
  you are A. Nagraj author of madhyath darshan Madhyasth Darshan, or "Coexistential Philosophy," is a new discovery for humankind that offers a profound insight into reality and human nature. Rooted in original existential research by the late Shri A Nagraj, it provides a comprehensive understanding of the universe, consciousness, and the purpose of human life. The biggest gift being it possible to have self-realization and understand the nature of reality through a structured framework without demanding any intellectual compromises or material denials.
Sentence from Hindi book: "${randomSentence}"

Task: Transform this into a meaningful Hindi quote dont lose original context .
Requirements:
- dont lose original meaning
- Keep it contextful.
- Preserve the core wisdom
- Use simple, elegant Hindi
- Return ONLY the quote, no explanation or extra text

Quote:`;

  try {
    const response = await model.generateContent(prompt);
    const generatedQuote = response.response.text().trim();
    
    // Calculate various size metrics
    const charCount = generatedQuote.length;
    const wordCount = generatedQuote.split(/\s+/).filter(w => w.length > 0).length;
    const byteSize = Buffer.byteLength(generatedQuote, 'utf8');
    
    res.json({ 
      quote: generatedQuote,
      size: {
        characters: charCount,
        words: wordCount,
        bytes: byteSize,
        characterType: "Hindi (Devanagari + Latin)",
        estimatedReadingTime: `${Math.ceil(wordCount / 3)} seconds`
      },
      source: randomSentence.substring(0, 100) + "...",
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("❌ Gemini API Error:", err);
    res.status(500).json({ 
      error: "Failed to generate quote with size info",
      details: err.message 
    });
  }
});

// GET /stats - Get statistics about the quote database
app.get("/stats", (req, res) => {
  res.json({
    totalSentences: quotes.length,
    usedInSession: usedQuotes.size,
    cacheSize: MAX_USED_CACHE,
    status: quotes.length > 0 ? "ready" : "not initialized"
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok",
    quotesLoaded: quotes.length,
    geminiConfigured: !!process.env.GEMINI_API_KEY
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Hindi Quote Generator Server running on http://localhost:${PORT}`);
  console.log(`📚 Total sentences loaded: ${quotes.length}`);
  console.log(`🔑 Gemini API Key: ${process.env.GEMINI_API_KEY ? "✅ Configured" : "❌ Missing"}`);
  console.log(`\n📍 Available endpoints:`);
  console.log(`   GET /quote - Generate random Hindi quote`);
  console.log(`   GET /quote/size - Generate quote with size information`);
  console.log(`   GET /stats - View database statistics`);
  console.log(`   GET /health - Health check`);
});