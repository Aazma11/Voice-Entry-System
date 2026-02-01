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

function parseMarkEntryCommand(text) {
  const entries = [];
  const patterns = [
    /(\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:got|scored|has|obtained)\s+(\d+)\s*(?:marks?)?/gi,
    /(\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(\d{1,3})\b/gi,
    /(\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+marks?\s+(\d+)/gi,
    /(\d+)\s+marks?\s+(?:for|to)\s+(\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
    /(\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*[:-]\s*(\d+)/gi
  ];

  const foundEntries = new Map();

  patterns.forEach(pattern => {
    let match;
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
        name = name.split(' ').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');

        foundEntries.set(name, mark);
      }
    }
  });

  foundEntries.forEach((mark, name) => {
    entries.push({ name, mark });
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