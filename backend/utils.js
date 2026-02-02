// backend/utils.js
const XLSX = require('xlsx');

// NLP Processing Functions
function extractStudentNames(text) {
  const namePattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;
  return text.match(namePattern) || [];
}

function extractMarks(text) {
  const numbers = text.match(/\d+/g) || [];
  return numbers.map(num => parseInt(num)).filter(num => num >= 0 && num <= 100);
}

// Common verbs to exclude from names
const verbsToExclude = ['got', 'scored', 'has', 'obtained', 'received', 'marks', 'mark', 'points', 'point', 'have', 'get', 'gets'];

// Function to clean name - remove verbs and extra words
function cleanName(name, verbsToExclude) {
    if (!name) return '';
    
    const words = name.trim().split(/\s+/);
    const cleanedWords = [];
    
    for (let word of words) {
        const lowerWord = word.toLowerCase();
        if (!verbsToExclude.includes(lowerWord) && 
            !['the', 'a', 'an', 'and', 'or', 'but', 'is', 'was', 'are', 'were'].includes(lowerWord)) {
            cleanedWords.push(word);
        }
        if (cleanedWords.length >= 2) break;
    }
    
    // Additional check: if last word is a verb, remove it
    if (cleanedWords.length > 0) {
        const lastWord = cleanedWords[cleanedWords.length - 1].toLowerCase();
        if (verbsToExclude.includes(lastWord)) {
            cleanedWords.pop();
        }
    }
    
    return cleanedWords.join(' ').trim();
}

function parseMarkEntryCommand(text) {
  const entries = [];
  
  // Improved patterns - handle various transcription issues
  const patterns = [
    // Pattern 1: "Name got/scored/has X marks" - Single word name before verb
    /\b([A-Z][a-z]+)\s+(?:got|scored|has|obtained|received|have|get|gets)\s+(\d+)\s*(?:marks?)?/gi,
    
    // Pattern 2: "Name X" - Full name with space (at least 2 letters)
    /\b([A-Z][a-z]{2,})\s+(\d{1,3})\b/gi,
    
    // Pattern 2b: Handle incomplete transcriptions like "M72" - extract single letter + number
    /\b([A-Z])(\d{1,3})\b/gi,
    
    // Pattern 3: "Name marks X"
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+marks?\s+(\d+)/gi,
    
    // Pattern 4: "X marks for Name"
    /(\d+)\s+marks?\s+(?:for|to)\s+\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
    
    // Pattern 5: "Name: X" or "Name - X" or "Name, X" - Fix: hyphen at end
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*[:,\s-]\s*(\d+)/gi
  ];

  const foundEntries = new Map();

  patterns.forEach((pattern, patternIndex) => {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(text)) !== null) {
      let name, mark;
      if (pattern.source.includes('for|to')) {
        mark = parseInt(match[1]);
        name = match[2].trim();
      } else {
        name = match[1].trim();
        mark = parseInt(match[2]);
      }

      if (mark >= 0 && mark <= 100 && name.length > 0) {
        // Special handling for Pattern 2b (single letter + number like "M72")
        if (patternIndex === 2 && name.length === 1) {
          // Mark this as needing manual correction
          name = name + '?'; // Add ? to indicate incomplete
        } else {
          // Clean the name - remove verbs and normalize
          name = cleanName(name, verbsToExclude);
        }
        
        if (name.length > 0) {
          // Capitalize properly (unless it's marked for correction)
          if (!name.endsWith('?')) {
            name = name.split(' ').map(word => 
              word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            ).join(' ');
          }

          // Use mark as key to avoid duplicates
          const key = `${name.toLowerCase()}_${mark}`;
          foundEntries.set(key, { name, mark });
        }
      }
    }
  });

  // Convert Map to array
  foundEntries.forEach((entry) => {
    entries.push(entry);
  });

  return { entries, students: extractStudentNames(text), marks: extractMarks(text) };
}

// Excel Generation Functions
function generateMarkSheet(entries, subject = 'Marks') {
  const workbook = XLSX.utils.book_new();
  const excelData = [['Student Name', 'Marks', 'Subject', 'Date']];

  entries.forEach(entry => {
    excelData.push([
      entry.name || entry.studentName || 'Unknown',
      entry.mark || entry.marks || 0,
      entry.subject || subject,
      new Date().toLocaleDateString()
    ]);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(excelData);
  worksheet['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 15 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Mark Sheet');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = { parseMarkEntryCommand, generateMarkSheet };