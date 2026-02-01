// frontend/app.js
const API_BASE_URL = 'http://localhost:5000/api/teacher';
let recognition;
let isRecording = false;
let transcribedText = '';
let processedEntries = [];
let processingTimeout;

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
            localStorage.setItem('teacher', JSON.stringify(data.teacher));
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
    localStorage.removeItem('teacher');
    window.location.href = 'login.html';
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

// ========== CLIENT-SIDE NLP PROCESSING ==========
function parseMarkEntryClientSide(text) {
    const entries = [];
    const patterns = [
        /(\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:got|scored|has|obtained|received)\s+(\d+)\s*(?:marks?|points?)?/gi,
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

    return entries;
}

// ========== VOICE RECOGNITION ==========
function initSpeechRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            isRecording = true;
            updateRecordButton(true);
            updateStatus('Recording... Speak student names and marks', 'recording');
            processedEntries = [];
            transcribedText = '';
            initializeExcelTable();
        };

        recognition.onresult = async (event) => {
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interimTranscript += transcript;
                }
            }

            transcribedText = finalTranscript + interimTranscript;
            const textarea = document.getElementById('transcribedText');
            if (textarea) {
                textarea.value = transcribedText;
                textarea.scrollTop = textarea.scrollHeight;
            }

            // Process in real-time
            if (finalTranscript.trim()) {
                const clientEntries = parseMarkEntryClientSide(finalTranscript);
                if (clientEntries.length > 0) {
                    updateEntriesInRealTime(clientEntries);
                }
                
                // Also send to server for more accurate processing
                clearTimeout(processingTimeout);
                processingTimeout = setTimeout(() => {
                    processTextAutomatically(transcribedText);
                }, 500);
            }
        };

        recognition.onerror = (event) => {
            updateStatus('Error: ' + event.error, 'error');
            stopRecording();
        };

        recognition.onend = () => {
            isRecording = false;
            updateRecordButton(false);
            updateStatus('Recording stopped', 'stopped');
            if (transcribedText.trim()) {
                processTextAutomatically(transcribedText);
            }
        };
    } else {
        alert('Speech recognition not supported. Please use Chrome or Edge.');
    }
}

// Real-time entry updates
function updateEntriesInRealTime(newEntries) {
    const subject = document.getElementById('subject')?.value || 'General';

    newEntries.forEach(newEntry => {
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

// Server-side processing (for accuracy)
async function processTextAutomatically(text) {
    if (!text.trim()) return;
    const subject = document.getElementById('subject')?.value || 'General';

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

// Real-time Excel table update
function updateExcelTableRealTime(entries, subject) {
    const tbody = document.getElementById('excelTableBody');
    if (!tbody) return;

    if (entries.length === 0) {
        initializeExcelTable();
        return;
    }

    const emptyRow = tbody.querySelector('.empty-row');
    if (emptyRow) emptyRow.remove();

    let html = '';
    entries.forEach((entry, index) => {
        html += `<tr id="row-${index}" class="excel-row" data-name="${entry.name}">
            <td class="col-sno">${index + 1}</td>
            <td class="col-name">
                <input type="text" value="${entry.name}" class="cell-input cell-name" onchange="updateEntryName(${index}, this.value)" />
            </td>
            <td class="col-marks">
                <input type="number" value="${entry.mark}" min="0" max="100" class="cell-input cell-marks" onchange="updateEntryMark(${index}, this.value)" />
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
}

function updateEntryName(index, newName) {
    if (processedEntries[index]) {
        processedEntries[index].name = newName;
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
        recognition.start();
    }
}

function stopRecording() {
    if (recognition && isRecording) {
        recognition.stop();
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
        const response = await fetch(`${API_BASE_URL}/generate-excel`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ entries, subject })
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `mark_sheet_${subject}_${Date.now()}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            alert('Excel file downloaded successfully!');
        } else {
            const error = await response.json();
            alert('Error: ' + error.error);
        }
    } catch (error) {
        alert('Network error. Please try again.');
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
        const response = await fetch(`${API_BASE_URL}/save-entries`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ entries, subject })
        });

        const data = await response.json();
        if (response.ok) {
            alert(`Successfully saved ${data.count} mark entries!`);
        } else {
            alert('Error: ' + data.error);
        }
    } catch (error) {
        alert('Network error. Please try again.');
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