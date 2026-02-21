// frontend/app.js
// Auto-detect API URL (works on computer and phone)
// Auto-detect port (works on 5000 and 5001)
const _port = window.location.port ? `:${window.location.port}` : '';
const API_BASE_URL = `${window.location.protocol}//${window.location.hostname}${_port}/api/teacher`;
let recognition;
let isRecording = false;
let transcribedText = '';
let processedEntries = [];
let processingTimeout;
let serverProcessingQueued = false;

// ========== AUTHENTICATION ==========
async function login(email, password) {
    const submitBtn = document.querySelector('#loginForm button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging in...';
    
    try {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('role', 'teacher');
            localStorage.setItem('teacher', JSON.stringify(data.teacher));
            localStorage.setItem('teacherEmail', data.teacher.email);
            window.location.href = 'dashboard.html';
        } else {
            showError(data.error || 'Login failed');
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    } catch (error) {
        console.error('Login error:', error);
        showError('Network error. Make sure server is running on http://localhost:5000');
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('teacher');
    localStorage.removeItem('teacherEmail');
    window.location.href = 'login.html';
}

// Role guard for all teacher pages.
// Call this at the top of every teacher page's DOMContentLoaded.
// Returns true if the user is a valid teacher, false (and redirects) otherwise.
async function teacherAuth() {
    const token = localStorage.getItem('token');
    const role  = localStorage.getItem('role');

    // If role is explicitly set to 'student', block immediately
    if (!token || role === 'student') {
        window.location.href = 'login.html';
        return false;
    }

    // Verify token is actually a teacher token by calling the teacher profile API
    try {
        const res = await fetch(
            `${window.location.protocol}//${window.location.hostname}${_port}/api/teacher/profile`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) {
            window.location.href = 'login.html';
            return false;
        }
        const data = await res.json();
        // Save role explicitly so future checks are instant
        localStorage.setItem('role', 'teacher');
        return data.teacher;
    } catch (_) {
        window.location.href = 'login.html';
        return false;
    }
}

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        setTimeout(() => errorDiv.style.display = 'none', 5000);
    }
}

// Login form handler
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', (e) => {
        e.preventDefault();
        login(document.getElementById('email').value, document.getElementById('password').value);
    });
}

// ========== CLIENT-SIDE NLP PROCESSING (IMPROVED) ==========
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

function parseMarkEntryClientSide(text) {
    const entries = [];
    
    // Improved patterns - handle various transcription issues
    const patterns = [
        // Pattern 1: "Name got/scored/has X marks" - Single word name before verb
        /\b([A-Z][a-z]+)\s+(?:got|scored|has|obtained|received|have|get|gets)\s+(\d+)\s*(?:marks?|points?)?/gi,
        
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

    return entries;
}

// ========== VOICE RECOGNITION (OPTIMIZED) ==========
function initSpeechRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        
        // OPTIMIZED SETTINGS FOR SPEED
        recognition.continuous = true;           // Keep listening
        recognition.interimResults = true;       // Get partial results immediately
        recognition.lang = 'en-IN';              //try for en-IN for indian english
        recognition.maxAlternatives = 5;         // Only get best result (faster)
        
        // OPTIMIZATION: Set grammars for better accuracy (optional)
        // recognition.grammars = ...; // Can add custom grammar if needed

        recognition.onstart = () => {
            isRecording = true;
            updateRecordButton(true);
            updateStatus('🎤 Recording... Speak clearly: "Name got marks"', 'recording');
            processedEntries = [];
            transcribedText = '';
            serverProcessingQueued = false;
            initializeExcelTable();
            
            // Show performance indicator
            const perfIndicator = document.getElementById('performanceIndicator');
            if (perfIndicator) perfIndicator.style.display = 'block';
        };

        recognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';
            let hasNewFinal = false;

            // ... inside recognition.onresult ...
for (let i = event.resultIndex; i < event.results.length; i++) {
    const result = event.results[i];

    // collect all alternatives
    const alternatives = [];
    for (let j = 0; j < result.length; j++) {
        alternatives.push(result[j].transcript || '');
    }

    // choose the best transcript based on how many valid entries it produces
    const transcript = pickBestTranscript(alternatives).trim();

    if (!transcript) continue;

    if (result.isFinal) {
        finalTranscript += transcript + ' ';
        hasNewFinal = true;
    } else {
        if (transcript.length > 3) {
            interimTranscript = transcript;
        }
    }
}

            // Update transcription IMMEDIATELY (no delay)
            if (hasNewFinal) {
                transcribedText += finalTranscript;
            }
            
            const currentText = transcribedText + (interimTranscript ? ' ' + interimTranscript : '');
            const textarea = document.getElementById('transcribedText');
            if (textarea) {
                textarea.value = currentText;
                textarea.scrollTop = textarea.scrollHeight;
            }

                                    // OPTIMIZATION: Process final results IMMEDIATELY (no delay)
            if (hasNewFinal && finalTranscript.trim()) {
                const text = finalTranscript.trim();
                
                // Update full transcription first
                transcribedText += finalTranscript;

                // 1) Check FULL transcription for "create sheet" voice command
                // (command might span multiple chunks)
                if (handleCreateSheetCommand(transcribedText)) {
                    // We handled a custom sheet command; clear transcription and skip normal parsing
                    transcribedText = ''; // Clear after successful command
                    const textarea = document.getElementById('transcribedText');
                    if (textarea) textarea.value = '';
                    return;
                }

                // 2) Also check current chunk in case it's a complete command
                if (handleCreateSheetCommand(text)) {
                    transcribedText = '';
                    const textarea = document.getElementById('transcribedText');
                    if (textarea) textarea.value = '';
                    return;
                }

                // 3) Otherwise, normal mark-entry parsing
                const clientEntries = parseMarkEntryClientSide(text);
                if (clientEntries.length > 0) {
                    requestAnimationFrame(() => {
                        updateEntriesInRealTime(clientEntries);
                    });
                }

                // 4) Server processing (existing code)
                if (!serverProcessingQueued) {
                    serverProcessingQueued = true;
                    clearTimeout(processingTimeout);
                    processingTimeout = setTimeout(() => {
                        processTextAutomatically(transcribedText);
                        serverProcessingQueued = false;
                    }, 100);
                }
            }
                        
                        // OPTIMIZATION: Process interim results more aggressively for instant feedback
                        if (interimTranscript.trim() && interimTranscript.length > 5) {
                            const interimEntries = parseMarkEntryClientSide(interimTranscript);
                            if (interimEntries.length > 0) {
                                requestAnimationFrame(() => {
                                    updateEntriesInRealTime(interimEntries);
                                });
                            }
                        }
                    };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            
            // OPTIMIZATION: Better error handling with auto-recovery
            if (event.error === 'no-speech') {
                // No speech detected - keep listening (don't stop)
                updateStatus('🔇 No speech detected. Keep speaking...', 'recording');
                return; // Don't stop, just wait for speech
            } else if (event.error === 'audio-capture') {
                updateStatus('❌ Microphone not found. Please check your microphone.', 'error');
                stopRecording();
            } else if (event.error === 'not-allowed') {
                updateStatus('❌ Microphone permission denied. Please allow microphone access.', 'error');
                stopRecording();
            } else if (event.error === 'network') {
                updateStatus('⚠️ Network error. Retrying...', 'error');
                // Auto-retry after 1 second
                setTimeout(() => {
                    if (isRecording) {
                        recognition.start();
                    }
                }, 1000);
            } else {
                updateStatus('⚠️ Error: ' + event.error + '. Continuing...', 'error');
                // For other errors, try to continue
                if (isRecording && event.error !== 'aborted') {
                    setTimeout(() => {
                        if (isRecording) {
                            recognition.start();
                        }
                    }, 500);
                }
            }
        };

        recognition.onend = () => {
            // OPTIMIZATION: Auto-restart if still recording (for continuous mode)
            if (isRecording) {
                // Small delay before restarting to avoid rapid restarts
                setTimeout(() => {
                    if (isRecording && recognition) {
                        try {
                            recognition.start();
                        } catch (e) {
                            // Already started, ignore
                            console.log('Recognition already started');
                        }
                    }
                }, 100);
                return; // Don't update UI, keep recording
            }
            
            // Only update UI if actually stopped
            isRecording = false;
            updateRecordButton(false);
            updateStatus('✅ Recording stopped', 'stopped');
            
            // Hide performance indicator
            const perfIndicator = document.getElementById('performanceIndicator');
            if (perfIndicator) perfIndicator.style.display = 'none';
            
            // Final server processing when recording ends
            if (transcribedText.trim() && !serverProcessingQueued) {
                processTextAutomatically(transcribedText);
            }
        };
    } else {
        // Better browser detection
        const browser = navigator.userAgent.toLowerCase();
        let browserName = 'your browser';
        if (browser.includes('chrome')) browserName = 'Chrome';
        else if (browser.includes('edge')) browserName = 'Edge';
        else if (browser.includes('safari')) browserName = 'Safari';
        else if (browser.includes('firefox')) browserName = 'Firefox';
        
        alert(`Speech recognition not supported in ${browserName}.\n\nPlease use:\n• Chrome (recommended)\n• Edge\n• Safari (Mac/iOS)\n\nThese browsers support voice recognition.`);
    }

    function pickBestTranscript(alternatives) {
        // choose the transcript that produces the most valid mark entries
        let best = alternatives[0] || '';
        let bestScore = -1;
      
        for (const t of alternatives) {
          const entries = parseMarkEntryClientSide(t);
          const score = entries.length; // simple scoring
          if (score > bestScore) {
            bestScore = score;
            best = t;
          }
        }
        return best;
      }
    }
// Real-time entry updates (OPTIMIZED)
function updateEntriesInRealTime(newEntries) {
    const subject = document.getElementById('subject')?.value || 'General';
    let hasUpdates = false;

    // CURRENT
newEntries.forEach(newEntry => {
    // Normalize name for comparison
    const normalizedName = newEntry.name.toLowerCase().trim();
    
    const existingIndex = processedEntries.findIndex(e => 
        e.name.toLowerCase().trim() === normalizedName
    );
    
    if (existingIndex === -1) {
        // New entry - add it
        processedEntries.push(newEntry);
        hasUpdates = true;
    } else {
        // Existing entry - update marks if different
        if (processedEntries[existingIndex].mark !== newEntry.mark) {
            processedEntries[existingIndex].mark = newEntry.mark;
            hasUpdates = true;
        }
    }
});

    // OPTIMIZATION: Only update UI if there are actual changes
    if (hasUpdates) {
        // Use requestAnimationFrame for smooth rendering
        requestAnimationFrame(() => {
            updateExcelTableRealTime(processedEntries, subject);
        });
    }
}

// Server-side processing (non-blocking, called less frequently)
async function processTextAutomatically(text) {
    if (!text.trim()) return;
    const subject = document.getElementById('subject')?.value || 'General';

    // Don't block UI - process in background
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/process-voice`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ text, subject })
        });

        const data = await response.json();
        if (response.ok && data.data.entries && data.data.entries.length > 0) {
            // Only update if there are new entries from server
            data.data.entries.forEach(newEntry => {
                const existingIndex = processedEntries.findIndex(e => 
                    e.name.toLowerCase() === newEntry.name.toLowerCase()
                );
                if (existingIndex === -1) {
                    processedEntries.push(newEntry);
                } else {
                    processedEntries[existingIndex].mark = newEntry.mark;
                }
            });

            updateExcelTableRealTime(processedEntries, subject);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// Initialize Excel table
function initializeExcelTable() {
    const tbody = document.getElementById('excelTableBody');
    if (tbody) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="6" class="empty-message"><div class="empty-state"><span class="empty-icon">📊</span><p>Start recording to see entries appear here in real-time</p></div></td></tr>';
    }
    updateEntryCount();
    enableActionButtons(false);
}

const STUDENT_ROSTER = [
    "Sarah", "Mike", "Ravi", "Sanjana","Keerthy","Aazma","Sowjanya"
    // add all students here
  ];
  function correctNameToRoster(name) {
    const n = (name || '').trim();
    if (!n) return n;
  
    let best = n, bestDist = Infinity;
    for (const real of STUDENT_ROSTER) {
      const d = levenshtein(n.toLowerCase(), real.toLowerCase());
      if (d < bestDist) { bestDist = d; best = real; }
    }
  
    // only replace if it’s “close enough”
    return bestDist <= 2 ? best : n;
  }
  
  function levenshtein(a, b) {
    const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        dp[i][j] = Math.min(
          dp[i-1][j] + 1,
          dp[i][j-1] + 1,
          dp[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1)
        );
      }
    }
    return dp[a.length][b.length];
  }

// Real-time Excel table update (with better editing support)
function updateExcelTableRealTime(entries, subject) {
    const tbody = document.getElementById('excelTableBody');
    if (!tbody) return;

    if (entries.length === 0) {
        initializeExcelTable();
        return;
    }

    const emptyRow = tbody.querySelector('.empty-row');
    if (emptyRow) emptyRow.remove();

    // Use requestAnimationFrame for smoother updates
    requestAnimationFrame(() => {
        let html = '';
        entries.forEach((entry, index) => {
            // Check if name needs correction (marked with ?)
            const needsCorrection = entry.name.endsWith('?');
            const displayName = needsCorrection ? entry.name.slice(0, -1) : entry.name;
            const correctionClass = needsCorrection ? 'needs-correction' : '';
            const placeholder = needsCorrection ? 'Name incomplete - please edit' : 'Student name';
            
            html += `<tr id="row-${index}" class="excel-row ${correctionClass}" data-name="${entry.name}">
                <td class="col-sno">${index + 1}</td>
                <td class="col-name">
                    <input type="text" 
                           value="${displayName}" 
                           class="cell-input cell-name ${correctionClass}" 
                           placeholder="${placeholder}"
                           onchange="updateEntryName(${index}, this.value)" 
                           onfocus="this.select()"
                           title="Click to edit name spelling" />
                    ${needsCorrection ? '<span class="correction-hint">⚠️ Edit name</span>' : ''}
                </td>
                <td class="col-marks">
                    <input type="number" 
                           value="${entry.mark}" 
                           min="0" 
                           max="100" 
                           class="cell-input cell-marks" 
                           onchange="updateEntryMark(${index}, this.value)" />
                </td>
                <td class="col-subject">${subject}</td>
                <td class="col-date">${new Date().toLocaleDateString()}</td>
                <td class="col-actions">
                    <button onclick="deleteEntry(${index})" class="btn-delete" title="Delete">🗑️</button>
                </td>
            </tr>`;
        });

        tbody.innerHTML = html;
        updateEntryCount();
        enableActionButtons(true);
        updateCurrentSubject(subject);
    });
}
// ====== CUSTOM SHEET (VOICE COMMAND) ======

function handleCreateSheetCommand(text) {
    // More flexible pattern to handle voice recognition errors
    // Handles: "rows", "Firos", "Firoz", "rose", "row", etc.
    // Handles: "create a sheet", "create sheet", "create a seat", "creative seat", etc.
    
    // Try multiple patterns
       // Try multiple patterns - handle both "rows 5" and "5 rows"
       const patterns = [
        // Pattern 1: "create a sheet of 5 rows and 5 columns" (number FIRST)
        /create\s+(?:a\s+)?(?:sheet|seat)\s+of\s+(\d+)\s+(?:rows?|Firos?|Firoz?|rose?)\s+and\s+(\d+)\s+columns?/i,
        
        // Pattern 2: "create a sheet of rows 5 and columns 5" (number AFTER)
        /create\s+(?:a\s+)?(?:sheet|seat)\s+of\s+(?:rows?|Firos?|Firoz?|rose?)\s+(\d+)\s+and\s+columns?\s+(\d+)/i,
        
        // Pattern 3: "create sheet 5 rows 5 columns"
        /create\s+(?:sheet|seat)\s+(\d+)\s+(?:rows?|Firos?|Firoz?|rose?)\s+(\d+)\s+columns?/i,
        
        // Pattern 4: "sheet of 5 rows and 5 columns"
        /(?:sheet|seat)\s+of\s+(\d+)\s+(?:rows?|Firos?|Firoz?|rose?)\s+and\s+(\d+)\s+columns?/i,
        
        // Pattern 5: "5 rows and 5 columns" (simplest)
        /(\d+)\s+(?:rows?|Firos?|Firoz?|rose?)\s+and\s+(\d+)\s+columns?/i
    ];
    
    let match = null;
    for (const pattern of patterns) {
        match = text.match(pattern);
        if (match) break;
    }
    
    if (!match) return false;  // not a sheet-creation command

    const rows = parseInt(match[1], 10);
    const cols = parseInt(match[2], 10);
    let namesPart = match[3] || '';

    // Validate numbers
    if (isNaN(rows) || isNaN(cols) || rows < 1 || cols < 1 || rows > 100 || cols > 20) {
        console.log('Invalid sheet dimensions:', rows, cols);
        return false;
    }

    let columnNames = [];
    if (namesPart) {
        // Split by comma or "and"
        columnNames = namesPart
            .split(/[,\s]+and\s+|[,\s]+/)
            .map(s => s.trim())
            .filter(Boolean);
    }

    // If not enough names were spoken, auto-generate
    while (columnNames.length < cols) {
        columnNames.push(`Col${columnNames.length + 1}`);
    }
    // If too many, trim extra
    if (columnNames.length > cols) {
        columnNames = columnNames.slice(0, cols);
    }

    createCustomSheet(rows, cols, columnNames);
    return true;
}
function createCustomSheet(rows, cols, columnNames) {
    const table = document.getElementById('excelTable');
    const thead = table.querySelector('thead');
    const tbody = document.getElementById('excelTableBody');
    if (!table || !thead || !tbody) return;

    // Clear any existing entries (we treat this as a new mode)
    processedEntries = [];
    transcribedText = '';
    enableActionButtons(false);

    // Build header row
    let headerHtml = '<tr>';
    headerHtml += '<th class="col-sno">#</th>';  // serial number column
    for (let i = 0; i < cols; i++) {
        headerHtml += `<th>${columnNames[i]}</th>`;
    }
    headerHtml += '</tr>';
    thead.innerHTML = headerHtml;

    // Build body with empty rows
    let bodyHtml = '';
    for (let r = 0; r < rows; r++) {
        bodyHtml += '<tr>';
        bodyHtml += `<td class="col-sno">${r + 1}</td>`;
        for (let c = 0; c < cols; c++) {
            bodyHtml += `
                <td>
                    <input type="text"
                           class="cell-input"
                           placeholder="${columnNames[c]} (row ${r + 1})" />
                </td>
            `;
        }
        bodyHtml += '</tr>';
    }
    tbody.innerHTML = bodyHtml;

    // Update header text to indicate custom sheet mode
    const headerTitle = document.querySelector('.excel-header h2');
    if (headerTitle) {
        headerTitle.textContent = '📋 Custom Sheet (Voice Created)';
    }

    const entryCountEl = document.getElementById('entryCount');
    if (entryCountEl) {
        entryCountEl.textContent = `${rows} Rows × ${cols} Columns`;
    }

    const lastUpdateEl = document.getElementById('lastUpdate');
    if (lastUpdateEl) {
        lastUpdateEl.textContent = 'Custom sheet created by voice command';
    }
}

function updateEntryName(index, newName) {
    if (processedEntries[index]) {
        const cleanedName = newName.trim().replace(/\?$/, '');
        if (cleanedName.length > 0) {
            // Also snap edited name to roster
            processedEntries[index].name = correctNameToRoster(cleanedName);
            const subject = document.getElementById('subject')?.value || 'General';
            updateExcelTableRealTime(processedEntries, subject);
        }
    }
}

function updateEntryMark(index, newMark) {
    if (processedEntries[index]) {
        processedEntries[index].mark = parseInt(newMark) || 0;
    }
}

function deleteEntry(index) {
    if (confirm(`Delete entry for ${processedEntries[index]?.name}?`)) {
        processedEntries.splice(index, 1);
        const subject = document.getElementById('subject')?.value || 'General';
        updateExcelTableRealTime(processedEntries, subject);
    }
}

function addManualEntry() {
    const name = prompt('Enter student name:');
    if (!name) return;
    
    const mark = prompt('Enter marks (0-100):');
    if (mark === null || isNaN(mark) || mark < 0 || mark > 100) {
        alert('Invalid marks. Please enter a number between 0 and 100.');
        return;
    }

    processedEntries.push({ name: name.trim(), mark: parseInt(mark) });
    const subject = document.getElementById('subject')?.value || 'General';
    updateExcelTableRealTime(processedEntries, subject);
}

function updateEntryCount() {
    const countEl = document.getElementById('entryCount');
    if (countEl) {
        countEl.textContent = `${processedEntries.length} ${processedEntries.length === 1 ? 'Entry' : 'Entries'}`;
    }
}

function updateCurrentSubject(subject) {
    const subjectEl = document.getElementById('currentSubject');
    if (subjectEl) {
        subjectEl.textContent = subject || 'No Subject Selected';
    }
}

function enableActionButtons(enabled) {
    const downloadBtn = document.getElementById('downloadBtn');
    const saveBtn = document.getElementById('saveBtn');
    if (downloadBtn) downloadBtn.disabled = !enabled;
    if (saveBtn) saveBtn.disabled = !enabled;
}

function toggleRecording() {
    if (!recognition) {
        initSpeechRecognition();
    }
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

function startRecording() {
    if (recognition) {
        transcribedText = '';
        processedEntries = [];
        serverProcessingQueued = false;
        recognition.start();
    }
}

function stopRecording() {
    // IMMEDIATE UI UPDATE - Don't wait for recognition.onend
    if (recognition && isRecording) {
        isRecording = false;
        updateRecordButton(false); // Update button immediately
        updateStatus('Stopping...', 'stopped');
        recognition.stop(); // Stop recognition
    }
}

function updateRecordButton(recording) {
    const recordBtn = document.getElementById('recordBtn');
    const stopBtn = document.getElementById('stopBtn');
    const recordIcon = document.getElementById('recordIcon');
    const recordText = document.getElementById('recordText');

    if (recording) {
        if (recordBtn) {
            recordBtn.disabled = true;
            recordBtn.classList.add('recording');
        }
        if (recordIcon) recordIcon.textContent = '🔴';
        if (recordText) recordText.textContent = 'Recording...';
        if (stopBtn) stopBtn.disabled = false;
    } else {
        if (recordBtn) {
            recordBtn.disabled = false;
            recordBtn.classList.remove('recording');
        }
        if (recordIcon) recordIcon.textContent = '🎤';
        if (recordText) recordText.textContent = 'Start Recording';
        if (stopBtn) stopBtn.disabled = true;
    }
}

function updateStatus(message, type) {
    const statusDiv = document.getElementById('status');
    if (statusDiv) {
        statusDiv.textContent = message;
        statusDiv.className = `status-message ${type}`;
    }
}

function updateSubject() {
    const subject = document.getElementById('subject')?.value || 'General';
    updateCurrentSubject(subject);
    if (processedEntries.length > 0) {
        updateExcelTableRealTime(processedEntries, subject);
    }
}
async function downloadExcel() {
    const entries = processedEntries;
    const subject = document.getElementById('subject')?.value || 'General';

    if (entries.length === 0) {
        alert('No entries to generate Excel');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        
        if (!token) {
            alert('Please login first. Redirecting to login page...');
            window.location.href = 'login.html';
            return;
        }
        
        // Clean entries - remove "?" markers from names before sending
        const cleanedEntries = entries.map(entry => ({
            name: entry.name.replace(/\?$/, '').trim(), // Remove ? marker
            mark: entry.mark
        })).filter(entry => entry.name.length > 0); // Remove empty names
        
        if (cleanedEntries.length === 0) {
            alert('No valid entries to generate Excel. Please check student names.');
            return;
        }
        
        // Show loading state
        const downloadBtn = document.getElementById('downloadBtn');
        const originalText = downloadBtn.innerHTML;
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = '<span>⏳</span> Generating...';
        
        const response = await fetch(`${API_BASE_URL}/generate-excel`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ entries: cleanedEntries, subject })
        });

        // Restore button
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = originalText;

        if (response.ok) {
            const blob = await response.blob();
            
            // Check if blob is valid
            if (blob.size === 0) {
                alert('Error: Generated Excel file is empty. Please try again.');
                return;
            }
            
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `mark_sheet_${subject.replace(/\s+/g, '_')}_${Date.now()}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            // Show success message
            const btn = document.getElementById('downloadBtn');
            const btnText = btn.innerHTML;
            btn.innerHTML = '<span>✅</span> Downloaded!';
            setTimeout(() => {
                btn.innerHTML = btnText;
            }, 2000);
        } else {
            // Try to get error message
            let errorMessage = 'Failed to generate Excel file';
            try {
                const error = await response.json();
                errorMessage = error.error || errorMessage;
            } catch (e) {
                errorMessage = `Server error (Status: ${response.status})`;
            }
            alert('Error: ' + errorMessage);
        }
    } catch (error) {
        console.error('Download error:', error);
        
        // Check if it's a network error
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            alert('Network Error: Cannot connect to server.\n\nPlease make sure:\n1. Server is running (npm start)\n2. Server is on http://localhost:5000\n3. Check browser console for details');
        } else {
            alert('Error: ' + error.message + '\n\nCheck browser console for details.');
        }
    }
}

async function saveEntries() {
    const entries = processedEntries;
    const subject = document.getElementById('subject')?.value || 'General';

    if (entries.length === 0) {
        alert('No entries to save');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        
        if (!token) {
            alert('Please login first. Redirecting to login page...');
            window.location.href = 'login.html';
            return;
        }
        
        // Clean entries - remove "?" markers from names
        const cleanedEntries = entries.map(entry => ({
            name: entry.name.replace(/\?$/, '').trim(),
            mark: entry.mark
        })).filter(entry => entry.name.length > 0);
        
        if (cleanedEntries.length === 0) {
            alert('No valid entries to save. Please check student names.');
            return;
        }
        
        const saveBtn = document.getElementById('saveBtn');
        const originalText = saveBtn.innerHTML;
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span>⏳</span> Saving...';
        
        const response = await fetch(`${API_BASE_URL}/save-entries`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ entries: cleanedEntries, subject })
        });

        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;

        const data = await response.json();
        if (response.ok) {
            saveBtn.innerHTML = `<span>✅</span> Saved ${data.count} entries!`;
            setTimeout(() => {
                saveBtn.innerHTML = originalText;
            }, 2000);
        } else {
            alert('Error: ' + (data.error || 'Failed to save entries'));
        }
    } catch (error) {
        console.error('Save error:', error);
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            alert('Network Error: Cannot connect to server.\n\nPlease make sure the server is running on http://localhost:5000');
        } else {
            alert('Error: ' + error.message);
        }
    }
}

function clearAll() {
    if (confirm('Are you sure you want to clear all entries?')) {
        processedEntries = [];
        transcribedText = '';
        const textarea = document.getElementById('transcribedText');
        if (textarea) textarea.value = '';
        initializeExcelTable();
        updateStatus('All entries cleared', 'stopped');
    }
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('recordBtn')) {
            initSpeechRecognition();
            initializeExcelTable();
        }
    });
} else {
    if (document.getElementById('recordBtn')) {
        initSpeechRecognition();
        initializeExcelTable();
    }
}

