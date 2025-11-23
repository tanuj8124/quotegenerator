#!/usr/bin/env python3
"""
Hindi PDF Text Extractor
Extracts text from PDF and splits into sentences for quote generation
"""

import pdfplumber
import json
import re
from pathlib import Path

def clean_text(text):
    """Clean and normalize extracted text"""
    # Remove excessive whitespace
    text = re.sub(r'\s+', ' ', text)
    # Remove special characters but keep Hindi characters and basic punctuation
    text = re.sub(r'[^\u0900-\u097F\u0020-\u007E\।\?!,\.]', '', text)
    return text.strip()

def split_into_sentences(text):
    """Split Hindi text into sentences"""
    # Hindi sentence delimiters: । (purna viram), ?, !, .
    sentences = re.split(r'[।\.\?!]+', text)
    
    # Clean and filter sentences
    cleaned_sentences = []
    for sentence in sentences:
        sentence = sentence.strip()
        # Keep sentences that are meaningful (5-200 words)
        word_count = len(sentence.split())
        if 5 <= word_count <= 200 and len(sentence) > 20:
            cleaned_sentences.append(sentence)
    
    return cleaned_sentences

def extract_from_pdf(pdf_path, output_json="quotes.json", output_txt="book.txt"):
    """Extract text from PDF and save as sentences"""
    
    print(f"📖 Opening PDF: {pdf_path}")
    
    if not Path(pdf_path).exists():
        print(f"❌ Error: PDF file not found at {pdf_path}")
        return False
    
    full_text = ""
    
    try:
        with pdfplumber.open(pdf_path) as pdf:
            total_pages = len(pdf.pages)
            print(f"📄 Total pages: {total_pages}")
            
            for i, page in enumerate(pdf.pages, 1):
                print(f"Processing page {i}/{total_pages}...", end='\r')
                page_text = page.extract_text()
                if page_text:
                    full_text += page_text + "\n"
            
            print(f"\n✅ Extracted text from {total_pages} pages")
    
    except Exception as e:
        print(f"❌ Error reading PDF: {e}")
        return False
    
    # Clean the full text
    full_text = clean_text(full_text)
    
    # Save full text
    with open(output_txt, "w", encoding="utf-8") as f:
        f.write(full_text)
    print(f"💾 Saved full text to {output_txt}")
    
    # Split into sentences
    sentences = split_into_sentences(full_text)
    print(f"✂️  Split into {len(sentences)} sentences")
    
    # Save as JSON
    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(sentences, f, ensure_ascii=False, indent=2)
    print(f"💾 Saved sentences to {output_json}")
    
    # Show sample sentences
    print("\n📝 Sample sentences:")
    for i, sentence in enumerate(sentences[:3], 1):
        preview = sentence[:100] + "..." if len(sentence) > 100 else sentence
        print(f"  {i}. {preview}")
    
    return True

def main():
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python extract_pdf.py <path_to_hindi_book.pdf>")
        print("\nExample:")
        print("  python extract_pdf.py my_hindi_book.pdf")
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    success = extract_from_pdf(pdf_path)
    
    if success:
        print("\n✅ Extraction complete! You can now start the server:")
        print("   node server.js")
    else:
        print("\n❌ Extraction failed")
        sys.exit(1)

if __name__ == "__main__":
    main()