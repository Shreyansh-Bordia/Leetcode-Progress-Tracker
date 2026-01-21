// DOM Elements
const loginPage = document.getElementById('login-page');
const adminDashboard = document.getElementById('admin-dashboard');
const userDashboard = document.getElementById('user-dashboard');
const loginBtn = document.getElementById('login-btn');
const adminLogoutBtn = document.getElementById('admin-logout');
const userLogoutBtn = document.getElementById('user-logout');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const adminUsernameSpan = document.getElementById('admin-username');
const userUsernameSpan = document.getElementById('user-username');
const addQuestionBtn = document.getElementById('add-question-btn');
const questionNameInput = document.getElementById('question-name');
const questionLinkInput = document.getElementById('question-link');
const adminQuestionsList = document.getElementById('admin-questions-list');
const userProgressDiv = document.getElementById('user-progress');
const todoQuestionsDiv = document.getElementById('todo-questions');
const completedQuestionsDiv = document.getElementById('completed-questions');

// Firebase Database References
let questionsRef;
let progressRef;
let currentUser = null;
let currentUserName = null;
let currentUserRole = null;
let calendarEventListenersInitialized = false;

function isAdmin(email) {
    return email === 'shreyansh.is21@bmsce.ac.in';
}

// Function to get username from email
function getUsernameFromEmail(email) {
    if (!email) return 'user';
    // Remove @domain.com to get username
    const username = email.split('.')[0];
    return username;
}

// Initialize Firebase listeners
function initFirebase() {
    // Listen for auth state changes
    auth.onAuthStateChanged((user) => {
        if (user) {
            // User is signed in
            currentUser = user;
            const email = user.email;
            currentUserName = getUsernameFromEmail(email);
            currentUserRole = isAdmin(email) ? 'admin' : 'user';
            
            console.log('User signed in:', email, 'Role:', currentUserRole);
            
            // Save to localStorage
            localStorage.setItem('currentUserEmail', email);
            localStorage.setItem('currentUserName', currentUserName);
            localStorage.setItem('currentUserRole', currentUserRole);
            
            // Show appropriate dashboard
            if (currentUserRole === 'admin') {
                showAdminDashboard(currentUserName);
            } else {
                showUserDashboard(currentUserName);
            }
            
            // Initialize Firebase refs
            questionsRef = db.ref('questions');
            progressRef = db.ref('progress');
            
            // Setup listener for questions
            setupFirebaseListeners();
            
            // Load initial data
            getQuestionsFromFirebase((questions) => {
                if (currentUserRole === 'admin') {
                    loadAdminQuestions(questions);
                    loadUserProgress(questions);
                } else {
                    loadUserQuestions(currentUserName, questions);
                }
            });
        } else {
            // User is signed out
            currentUser = null;
            currentUserName = null;
            currentUserRole = null;
            localStorage.removeItem('currentUserEmail');
            localStorage.removeItem('currentUserName');
            localStorage.removeItem('currentUserRole');
            showLoginPage();
        }
    });
    
    // Initialize Firebase refs (will be set properly when user logs in)
    questionsRef = db.ref('questions');
    progressRef = db.ref('progress');
}

// Setup Firebase listeners
function setupFirebaseListeners() {
    if (!questionsRef) return;
    
    // Remove any existing listener
    questionsRef.off();
    
    // Listen for real-time updates to questions
    questionsRef.on('value', (snapshot) => {
        const questions = snapshot.val() || [];
        if (currentUser && currentUserRole) {
            if (currentUserRole === 'admin') {
                loadAdminQuestions(questions);
                loadUserProgress(questions);
            } else {
                loadUserQuestions(currentUserName, questions);
            }
        }
    });
}

// Get questions from Firebase
function getQuestionsFromFirebase(callback) {
    if (!questionsRef) {
        callback([]);
        return;
    }
    
    questionsRef.once('value')
        .then((snapshot) => {
            const questions = snapshot.val() || [];
            callback(questions);
        })
        .catch((error) => {
            console.error('Error getting questions:', error);
            callback([]);
        });
}

// Save question to Firebase
function saveQuestionToFirebase(question) {
    questionsRef.push(question)
        .then(() => {
            console.log('Question saved successfully');
            questionNameInput.value = '';
            questionLinkInput.value = '';
            document.getElementById('question-difficulty').value = 'Medium';
            document.getElementById('question-tags').value = '';
            document.getElementById('question-video').value = '';
            document.getElementById('question-notes').value = '';
            document.getElementById('question-solution').value = '';
        })
        .catch((error) => {
            console.error('Error saving question:', error);
            alert('Error saving question. Please try again.');
        });
}

// Get user progress from Firebase
function getUserProgressFromFirebase(username, callback) {
    if (!progressRef) {
        callback([]);
        return;
    }
    
    progressRef.child(username).once('value')
        .then((snapshot) => {
            const progress = snapshot.val() || [];
            callback(progress);
        })
        .catch((error) => {
            console.error('Error getting progress:', error);
            callback([]);
        });
}

// Update user progress in Firebase
function updateUserProgressInFirebase(username, completedQuestions) {
    progressRef.child(username).set(completedQuestions)
        .then(() => {
            console.log('Progress updated successfully');
        })
        .catch((error) => {
            console.error('Error updating progress:', error);
        });
}

// Load questions for admin
function loadAdminQuestions(questions) {
    adminQuestionsList.innerHTML = '';

    if (!questions || Object.keys(questions).length === 0) {
        adminQuestionsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-tasks"></i>
                <p>No questions added yet</p>
            </div>
        `;
        return;
    }

    // Convert Firebase object to array
    const questionsArray = Object.keys(questions).map(key => ({
        id: key,
        ...questions[key]
    }));

    questionsArray.forEach(question => {
        const questionElement = document.createElement('div');
        questionElement.className = 'question-item';

        const resourcesHTML = buildResourcesHTML(question, true);

        questionElement.innerHTML = `
            <div class="question-header">
                <div class="question-title">
                    <a href="${question.link}" target="_blank" rel="noopener noreferrer">
                        ${question.name}
                        ${question.difficulty ? `<span class="difficulty ${question.difficulty.toLowerCase()}">${question.difficulty}</span>` : ''}
                    </a>
                </div>
                <div class="question-actions">
                    <span class="question-meta">
                        Added by: ${question.addedBy}
                    </span>
                    <button class="btn-delete" data-question-id="${question.id}" 
                            style="background: var(--danger-color); color: white; border: none; padding: 0.25rem 0.5rem; border-radius: 4px; cursor: pointer;">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="question-link">
                <small><i class="fas fa-link"></i> ${question.link}</small>
            </div>
            ${question.tags ? `<div class="question-tags">${question.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>` : ''}
            ${resourcesHTML}
        `;
        adminQuestionsList.appendChild(questionElement);
        
        // Add delete event listener
        const deleteBtn = questionElement.querySelector('.btn-delete');
        deleteBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to delete this question?')) {
                deleteQuestion(question.id);
            }
        });
    });
} 

// Build resources HTML for display
function buildResourcesHTML(question, isAdminView = false) {
    const hasVideo = question.videoLink && question.videoLink.trim() !== '';
    const hasNotes = question.notesLink && question.notesLink.trim() !== '';
    const hasSolution = question.solutionLink && question.solutionLink.trim() !== '';
    
    if (!hasVideo && !hasNotes && !hasSolution) return '';
    
    if (isAdminView) {
        // Admin view - simple text display
        return `
            <div class="admin-resources">
                ${hasVideo ? `<div class="admin-resource"><i class="fas fa-video"></i> Video: ${question.videoLink}</div>` : ''}
                ${hasNotes ? `<div class="admin-resource"><i class="fas fa-file-alt"></i> Notes: ${question.notesLink}</div>` : ''}
                ${hasSolution ? `<div class="admin-resource"><i class="fas fa-code"></i> Solution: ${question.solutionLink}</div>` : ''}
            </div>
        `;
    } else {
        // User view - clickable buttons
        return `
            <div class="question-resources">
                ${hasVideo ? `
                    <a href="${question.videoLink}" target="_blank" class="resource-link video">
                        <i class="fas fa-video"></i>Topic Video Explanation
                    </a>
                ` : ''}
                ${hasNotes ? `
                    <a href="${question.notesLink}" target="_blank" class="resource-link notes">
                        <i class="fas fa-file-alt"></i>Topic Notes/Article
                    </a>
                ` : ''}
                ${hasSolution ? `
                    <a href="${question.solutionLink}" target="_blank" class="resource-link solution">
                        <i class="fas fa-code"></i>Solution Video/Notes
                    </a>
                ` : ''}
            </div>
        `;
    }
}

// Delete question from Firebase
function deleteQuestion(questionId) {
    questionsRef.child(questionId).remove()
        .then(() => {
            console.log('Question deleted successfully');
            
            // Clean up progress for all users
            progressRef.once('value')
                .then((snapshot) => {
                    const progressData = snapshot.val() || {};
                    const updates = {};
                    
                    // Remove questionId from every user's progress array
                    Object.keys(progressData).forEach(username => {
                        if (Array.isArray(progressData[username])) {
                            updates[username] = progressData[username].filter(id => id !== questionId);
                        }
                    });
                    
                    // Update progress
                    return progressRef.update(updates);
                })
                .then(() => {
                    console.log('Progress data cleaned up');
                    
                    // Refresh admin view if needed
                    if (currentUserRole === 'admin') {
                        getQuestionsFromFirebase(loadAdminQuestions);
                        getQuestionsFromFirebase(loadUserProgress);
                    }
                })
                .catch(error => {
                    console.error('Error cleaning progress:', error);
                });
        })
        .catch((error) => {
            console.error('Error deleting question:', error);
            alert('Error deleting question. Please try again.');
        });
}

// Load user progress for admin
async function loadUserProgress(questions) {
    userProgressDiv.innerHTML = '';

    if (!questions || Object.keys(questions).length === 0) {
        userProgressDiv.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-chart-bar"></i>
                <p>No questions added yet</p>
            </div>
        `;
        return;
    }

    const questionsArray = Object.keys(questions).map(key => ({
        id: key,
        ...questions[key]
    }));

    const template = `
        <!-- Shiwangi's Progress -->
        <div id="progress-shiwangi" class="progress-item">
            <div class="progress-header">
                <span class="progress-username">shiwangi</span>
                <span class="progress-count" id="count-shiwangi">0/${questionsArray.length} completed</span>
            </div>
            <div id="questions-shiwangi" class="progress-questions">
                <!-- Questions will be inserted here -->
            </div>
        </div>
        
        <!-- Nishita's Progress -->
        <div id="progress-nishitah" class="progress-item">
            <div class="progress-header">
                <span class="progress-username">nishitah</span>
                <span class="progress-count" id="count-nishitah">0/${questionsArray.length} completed</span>
            </div>
            <div id="questions-nishitah" class="progress-questions">
                <!-- Questions will be inserted here -->
            </div>
        </div>
    `;
    
    userProgressDiv.innerHTML = template;
    
    const updateUser = async (username) => {
        const progress = await new Promise(resolve => {
            getUserProgressFromFirebase(username, resolve);
        });
        
        // Update count
        const countElement = document.getElementById(`count-${username}`);
        if (countElement) {
            countElement.textContent = `${progress.length}/${questionsArray.length} completed`;
        }
        
        // Update questions list
        const questionsElement = document.getElementById(`questions-${username}`);
        if (questionsElement) {
            questionsElement.innerHTML = questionsArray.map(question => {
                const isCompleted = progress.includes(question.id);
                return `
                    <span class="progress-question ${isCompleted ? 'completed' : ''}">
                        ${question.name.substring(0, 15)}${question.name.length > 15 ? '...' : ''} 
                        ${isCompleted ? '✓' : '○'}
                    </span>
                `;
            }).join('');
        }
    };
    
    // Update both users
    await updateUser('shiwangi');
    await updateUser('nishitah');
}

// Load questions for regular user
async function loadUserQuestions(username, questions) {
    if (!questions || Object.keys(questions).length === 0) {
        questions = {};
    }

    const questionsArray = Object.keys(questions).map(key => ({
        id: key,
        ...questions[key]
    }));

    // Get user's completed questions
    const completedQuestionIds = await new Promise(resolve => {
        getUserProgressFromFirebase(username, resolve);
    });

    // Separate questions
    const todoQuestions = questionsArray.filter(q => !completedQuestionIds.includes(q.id));
    const completedQuestions = questionsArray.filter(q => completedQuestionIds.includes(q.id));

    // Display To Do questions
    todoQuestionsDiv.innerHTML = '';
    if (todoQuestions.length === 0) {
        todoQuestionsDiv.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-check-circle"></i>
                <p>All questions completed! 🎉</p>
                <p>Wait for admin to add more</p>
            </div>
        `;
    } else {
        todoQuestions.forEach(question => {
            const questionElement = createUserQuestionElement(question, false, username);
            todoQuestionsDiv.appendChild(questionElement);
        });
    }

    // Display Completed questions
    completedQuestionsDiv.innerHTML = '';
    if (completedQuestions.length === 0) {
        completedQuestionsDiv.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-tasks"></i>
                <p>No completed questions yet</p>
                <p>Start solving!</p>
            </div>
        `;
    } else {
        completedQuestions.forEach(question => {
            const questionElement = createUserQuestionElement(question, true, username);
            completedQuestionsDiv.appendChild(questionElement);
        });
    }

    // Add toast styles
    addToastStyles();
    
    // Initialize daily progress tracking
    initDailyProgress(username);
    
    // Add today button to calendar
    addTodayButton();
    
    // Add event listeners for daily progress
    initDailyProgressEventListeners();
}

// Create question element for user
function createUserQuestionElement(question, isCompleted, username) {
    const questionElement = document.createElement('div');
    questionElement.className = `question-item ${isCompleted ? 'completed' : 'todo'}`;
    
    // Build resources HTML
    const resourcesHTML = buildResourcesHTML(question, false);

    questionElement.innerHTML = `
        <div class="question-header">
            <div class="question-title">
                <a href="${question.link}" target="_blank" rel="noopener noreferrer">
                    ${question.name}
                    ${question.difficulty ? `<span class="difficulty ${question.difficulty.toLowerCase()}">${question.difficulty}</span>` : ''}
                </a>
            </div>
            <div class="question-actions">
                <div class="checkbox-container">
                    <label>
                        <input type="checkbox" ${isCompleted ? 'checked' : ''} 
                               data-question-id="${question.id}">
                        ${isCompleted ? 'Completed' : 'Mark as completed'}
                    </label>
                </div>
            </div>
        </div>
        <div class="question-link">
            <small><i class="fas fa-link"></i> ${question.link}</small>
        </div>
        ${question.tags ? `<div class="question-tags">${question.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>` : ''}
        ${resourcesHTML}
    `;

    // Add checkbox event listener
    const checkbox = questionElement.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', async function() {
        await toggleQuestionCompletion(username, question.id, this.checked);
    });

    return questionElement;
}

// Toggle question completion
async function toggleQuestionCompletion(username, questionId, completed) {
    // Get current progress
    const progress = await new Promise(resolve => {
        getUserProgressFromFirebase(username, resolve);
    });

    let updatedProgress;
    if (completed) {
        // Add to completed if not already there
        if (!progress.includes(questionId)) {
            updatedProgress = [...progress, questionId];
            getQuestionsFromFirebase((questions) => {
                loadUserQuestions(username, questions);
            });
        } else {
            return; // Already completed
        }
    } else {
        // Remove from completed
        updatedProgress = progress.filter(id => id !== questionId);
        getQuestionsFromFirebase((questions) => {
            loadUserQuestions(username, questions);
        });
    }

    // Save to Firebase
    await updateUserProgressInFirebase(username, updatedProgress);
}

// Add new question
function addQuestion() {
    const name = questionNameInput.value.trim();
    const link = questionLinkInput.value.trim();
    const videoLink = document.getElementById('question-video').value.trim();
    const notesLink = document.getElementById('question-notes').value.trim();
    const solutionLink = document.getElementById('question-solution').value.trim();

    if (!name || !link) {
        alert('Please fill in both question name and link');
        return;
    }

    if (!link.startsWith('http')) {
        alert('Please enter a valid URL');
        return;
    }

    const newQuestion = {
        name,
        link,
        addedBy: currentUserName,
        addedDate: new Date().toISOString(),
        difficulty: document.getElementById('question-difficulty')?.value || 'Easy',
        tags: document.getElementById('question-tags')?.value.split(',').map(tag => tag.trim()) || [],
        videoLink: videoLink || '',
        notesLink: notesLink || '',
        solutionLink: solutionLink || ''
    };

    saveQuestionToFirebase(newQuestion);
    alert('Question added successfully! All users can now see it.');
}







// Get today's date in YYYY-MM-DD format (local time, India timezone)
function getTodayDate() {
    const now = new Date();
    
    // Get Indian date (UTC+5:30)
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0'); // 0-based
    const day = String(now.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
}

// Get display date string in Indian format
function getDisplayDate(date) {
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        timeZone: 'Asia/Kolkata'
    };
    return date.toLocaleDateString('en-IN', options);
}

// Get local date string from a Date object (consistent format)
function getLocalDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Initialize daily progress tracking
let dailyProgressRef;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

function initDailyProgress(username) {
    dailyProgressRef = db.ref('dailyProgress/' + username);
    
    // Set today's date display
    const today = new Date();
    document.getElementById('current-date').textContent = getDisplayDate(today);
    
    // Load today's progress
    loadTodayProgress(username);
    
    // Load calendar
    loadCalendar(username);
    
    // Load streak info
    loadStreakInfo(username);
}

// Load today's progress from Firebase
function loadTodayProgress(username) {
    const today = getTodayDate();
    
    dailyProgressRef.child(today).once('value')
        .then(snapshot => {
            const count = snapshot.val();
            const displayCount = count || 0;
            document.getElementById('today-count').value = displayCount;
            document.getElementById('today-stat').textContent = displayCount;
        })
        .catch(error => {
            console.error('Error loading today progress:', error);
        });
}

// Save daily progress
function saveDailyProgress(username) {
    const countInput = document.getElementById('today-count');
    const count = parseInt(countInput.value) || 0;
    const today = getTodayDate();
    
    if (count < 0) {
        alert('Please enter a valid number (0 or more)');
        return;
    }
    
    dailyProgressRef.child(today).set(count)
        .then(() => {
            console.log('Progress saved for', today, ':', count);
            
            // Update UI
            document.getElementById('today-stat').textContent = count;
            
            // Reload calendar and streak
            loadCalendar(username);
            loadStreakInfo(username);
            
            // Show success message
            showToast('Progress saved successfully!', 'success');
        })
        .catch(error => {
            console.error('Error saving progress:', error);
            alert('Error saving progress. Please try again.');
        });
}

// Load calendar for current month - FIXED VERSION
function loadCalendar(username) {
    const calendarGrid = document.getElementById('calendar-grid');
    const monthYearDisplay = document.getElementById('current-month');

    // Set month-year display
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                   'July', 'August', 'September', 'October', 'November', 'December'];
    monthYearDisplay.textContent = `${months[currentMonth]} ${currentYear}`;

    // Get first day of month and number of days
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay(); // 0 = Sunday

    // Get today's date info (used frequently)
    const today = new Date();
    const todayStr = getLocalDateString(today);
    const todayMonth = today.getMonth();
    const todayYear = today.getFullYear();
    const todayDay = today.getDate();

    // Load all progress for this user (async)
    dailyProgressRef.once('value')
        .then(snapshot => {
            const progressData = snapshot.val() || {};

            // Clear calendar (do it inside the async callback so repeated calls won't produce duplicates)
            calendarGrid.innerHTML = '';

            // Add empty cells for days before month starts
            for (let i = 0; i < startingDay; i++) {
                const emptyCell = document.createElement('div');
                emptyCell.className = 'calendar-day empty';
                calendarGrid.appendChild(emptyCell);
            }

            // Add days of month
            for (let day = 1; day <= daysInMonth; day++) {
                const date = new Date(currentYear, currentMonth, day);
                const dateStr = getLocalDateString(date);

                // Check day relation to today
                const isToday = (currentYear === todayYear &&
                                currentMonth === todayMonth &&
                                day === todayDay);
                const isPast = date < today && !isToday;
                const isFuture = date > today;

                // Get count for this day
                const dayCount = progressData[dateStr] || 0;
                const hasData = dayCount > 0;

                // Create day element
                const dayElement = document.createElement('div');
                dayElement.className = `calendar-day ${isToday ? 'today' : ''} ${hasData ? 'completed' : ''} ${isPast && !hasData ? 'missed' : ''} ${isFuture ? 'future' : ''}`;
                dayElement.setAttribute('data-date', dateStr);
                dayElement.setAttribute('data-count', dayCount);

                // Fix hover text - Show correct date
                const displayDate = date.toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                });
                dayElement.title = `${displayDate}: ${dayCount} questions`;

                dayElement.innerHTML = `
                    <div class="day-number">${day}</div>
                    <div class="day-count">${hasData ? dayCount : ''}</div>
                `;

                // Add click to edit (only for past days and today)
                if (!isFuture) {
                    dayElement.addEventListener('click', () => {
                        editDayProgress(username, dateStr, dayCount, displayDate);
                    });
                }

                calendarGrid.appendChild(dayElement);
            }
        })
        .catch(error => {
            console.error('Error loading calendar:', error);
        });
}

// Edit progress for a specific day
function editDayProgress(username, dateStr, currentCount, displayDate) {
    const newCount = prompt(`Enter number of questions solved on ${displayDate}:`, currentCount);
    
    if (newCount === null) return; // User cancelled
    
    const count = parseInt(newCount) || 0;
    if (count < 0) {
        alert('Please enter a valid number (0 or more)');
        return;
    }
    
    dailyProgressRef.child(dateStr).set(count)
        .then(() => {
            console.log('Progress updated for', dateStr);
            loadCalendar(username);
            loadStreakInfo(username);
            showToast('Progress updated!', 'success');
        })
        .catch(error => {
            console.error('Error updating progress:', error);
            alert('Error updating progress. Please try again.');
        });
}

// Calculate and display streak info
function loadStreakInfo(username) {
    dailyProgressRef.once('value')
        .then(snapshot => {
            const progressData = snapshot.val() || {};
            const today = new Date();
            const todayStr = getLocalDateString(today);
            
            // Calculate streak
            let currentStreak = 0;
            let maxStreak = 0;
            let tempStreak = 0;
            
            // Get all dates with progress
            const dates = Object.keys(progressData)
                .filter(date => progressData[date] > 0)
                .sort();
            
            if (dates.length > 0) {
                // Calculate current streak (consecutive days up to today)
                let currentDate = new Date();
                while (true) {
                    const dateStr = getLocalDateString(currentDate);
                    const count = progressData[dateStr] || 0;
                    
                    if (count > 0) {
                        currentStreak++;
                        currentDate.setDate(currentDate.getDate() - 1);
                    } else {
                        break;
                    }
                }
                
                // Calculate max streak
                for (let i = 0; i < dates.length - 1; i++) {
                    const date1 = new Date(dates[i]);
                    const date2 = new Date(dates[i + 1]);
                    const diffTime = Math.abs(date2 - date1);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    if (diffDays === 1) {
                        tempStreak++;
                    } else {
                        tempStreak = 0;
                    }
                    
                    maxStreak = Math.max(maxStreak, tempStreak);
                }
            }
            
            // Update streak display
            document.getElementById('current-streak').textContent = currentStreak;
            document.getElementById('streak-stat').textContent = currentStreak;
            
            // Add animation for good streaks
            const streakElement = document.getElementById('current-streak');
            if (currentStreak >= 3) {
                streakElement.classList.add('streak-high');
            } else {
                streakElement.classList.remove('streak-high');
            }
            
            // Update streak message
            const streakMessage = document.getElementById('streak-message');
            if (currentStreak === 0) {
                streakMessage.textContent = "Start your streak today! Solve at least 1 question.";
            } else if (currentStreak < 3) {
                streakMessage.textContent = "Keep it up! You're building momentum.";
            } else if (currentStreak < 7) {
                streakMessage.textContent = "Great streak! Don't break the chain.";
            } else if (currentStreak < 14) {
                streakMessage.textContent = "Excellent! You're on fire! 🔥";
            } else {
                streakMessage.textContent = "Unstoppable! You're a coding machine! 🚀";
            }
            
            // Calculate totals
            let totalQuestions = 0;
            let monthTotal = 0;
            
            const now = new Date();
            const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            
            Object.keys(progressData).forEach(dateStr => {
                const count = progressData[dateStr] || 0;
                totalQuestions += count;
                
                // Check if within current month
                const date = new Date(dateStr);
                if (date >= currentMonthStart) {
                    monthTotal += count;
                }
            });
            
            // Update stats
            document.getElementById('month-total').textContent = monthTotal;
            document.getElementById('all-time').textContent = totalQuestions;
            
        })
        .catch(error => {
            console.error('Error loading streak info:', error);
        });
}

// Navigate calendar months - FIXED
function changeCalendarMonth(direction) {
    if (direction === 'prev') {
        currentMonth--;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }
    } else {
        // Prevent going to future months
        const now = new Date();
        const nextMonth = new Date(currentYear, currentMonth + 1, 1);
        
        if (nextMonth <= now) {
            currentMonth++;
            if (currentMonth > 11) {
                currentMonth = 0;
                currentYear++;
            }
        }
    }
    
    // Reload calendar
    if (currentUserName) {
        loadCalendar(currentUserName);
    }
}

// Reset calendar to current month
function resetCalendarToCurrentMonth() {
    const now = new Date();
    currentMonth = now.getMonth();
    currentYear = now.getFullYear();
    
    if (currentUserName) {
        loadCalendar(currentUserName);
    }
}

// Toast notification
function showToast(message, type = 'info') {
    // Remove existing toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    // Create toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    
    // Add to body
    document.body.appendChild(toast);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Add toast styles
function addToastStyles() {
    if (!document.querySelector('#toast-styles')) {
        const toastStyles = document.createElement('style');
        toastStyles.id = 'toast-styles';
        toastStyles.textContent = `
            .toast {
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                padding: 1rem 1.5rem;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 1000;
                animation: slideIn 0.3s ease;
                border-left: 4px solid #3b82f6;
            }
            
            .toast-success {
                border-left-color: #10b981;
            }
            
            .toast-content {
                display: flex;
                align-items: center;
                gap: 0.75rem;
            }
            
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(toastStyles);
    }
}

// Add today button to calendar controls
function addTodayButton() {
    const calendarControls = document.querySelector('.calendar-controls');
    if (calendarControls && !document.getElementById('today-btn')) {
        const todayBtn = document.createElement('button');
        todayBtn.id = 'today-btn';
        todayBtn.className = 'btn-icon';
        todayBtn.innerHTML = '<i class="fas fa-calendar-day"></i>';
        todayBtn.title = 'Go to current month';
        todayBtn.style.marginLeft = 'auto';
        todayBtn.style.marginRight = '10px';
        
        todayBtn.addEventListener('click', resetCalendarToCurrentMonth);
        
        calendarControls.appendChild(todayBtn);
    }
}








// Login function
function login() {
    const email = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
        alert('Please enter both email and password');
        return;
    }

    // Sign in with Firebase Auth
    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Signed in successfully - handled by auth state listener
            console.log('Login successful for:', email);
        })
        .catch((error) => {
            console.error('Login error:', error);
            alert('Login failed. Please check your email and password.');
        });
}

// Show/Hide functions (same as before)
function showLoginPage() {
    loginPage.classList.remove('hidden');
    adminDashboard.classList.add('hidden');
    userDashboard.classList.add('hidden');
    usernameInput.value = '';
    passwordInput.value = '';
}

function showAdminDashboard(username) {
    loginPage.classList.add('hidden');
    adminDashboard.classList.remove('hidden');
    userDashboard.classList.add('hidden');
    adminUsernameSpan.textContent = username;
}

function showUserDashboard(username) {
    loginPage.classList.add('hidden');
    adminDashboard.classList.add('hidden');
    userDashboard.classList.remove('hidden');
    userUsernameSpan.textContent = username;
}

// Logout function
function logout() {
    auth.signOut()
        .then(() => {
            console.log('User signed out');
            showLoginPage();
        })
        .catch((error) => {
            console.error('Logout error:', error);
        });
}

// Event Listeners
loginBtn.addEventListener('click', login);
adminLogoutBtn.addEventListener('click', logout);
userLogoutBtn.addEventListener('click', logout);

// Add event listeners for daily progress (guarded so we only attach once)
function initDailyProgressEventListeners() {
    if (calendarEventListenersInitialized) return; // already attached
    calendarEventListenersInitialized = true;

    // Save daily progress button
    const saveBtn = document.getElementById('save-daily-progress');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            if (currentUserName) {
                saveDailyProgress(currentUserName);
            }
        });
    }

    // Calendar navigation
    const prevBtn = document.getElementById('prev-month');
    const nextBtn = document.getElementById('next-month');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            changeCalendarMonth('prev');
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            changeCalendarMonth('next');
        });
    }

    // Enter key for daily count
    const countInput = document.getElementById('today-count');
    if (countInput) {
        countInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && currentUserName) {
                saveDailyProgress(currentUserName);
            }
        });
    }
}

// Add Enter key support for login
passwordInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        login();
    }
});

addQuestionBtn.addEventListener('click', addQuestion);

// Initialize the app
function init() {

    userProgressDiv.innerHTML = '';

    initFirebase();
    
    showLoginPage();
}

// Start the application
init();
