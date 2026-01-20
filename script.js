// Hardcoded users
const USERS = {
    'admin': { password: 'admin', role: 'admin' },
    'shiwangi': { password: 'shiwangi', role: 'user' },
    'nishita': { password: 'nishita', role: 'user' }
};

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
let listenerActive = false;

// Initialize Firebase listeners
function initFirebase() {
    if (questionsRef) {
        questionsRef.off();
        console.log('Removed existing Firebase listener');
    }
    questionsRef = db.ref('questions');
    progressRef = db.ref('progress');
    
    let isProcessing = false;

    // Listen for real-time updates to questions
    questionsRef.on('value', (snapshot) => {
        if (isProcessing) {
            console.log('Already processing update, skipping...');
            return;
        }

        isProcessing = true;
        setTimeout(() => {
            isProcessing = false;
        }, 100);

        const questions = snapshot.val() || [];
        if (currentUser && USERS[currentUser]) {
            if (USERS[currentUser].role === 'admin') {
                loadAdminQuestions(questions);
                loadUserProgress(questions);
            } else {
                loadUserQuestions(currentUser, questions);
            }
        }
    });
}

// Get questions from Firebase
function getQuestionsFromFirebase(callback) {
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
        })
        .catch((error) => {
            console.error('Error saving question:', error);
            alert('Error saving question. Please try again.');
        });
}

// Get user progress from Firebase
function getUserProgressFromFirebase(username, callback) {
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
        questionElement.innerHTML = `
            <div class="question-header">
                <div class="question-title">
                    <a href="${question.link}" target="_blank" rel="noopener noreferrer">
                        ${question.name}
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
                <small>${question.link}</small>
            </div>
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
                    if (currentUser && USERS[currentUser].role === 'admin') {
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
        <div id="progress-nishita" class="progress-item">
            <div class="progress-header">
                <span class="progress-username">nishita</span>
                <span class="progress-count" id="count-nishita">0/${questionsArray.length} completed</span>
            </div>
            <div id="questions-nishita" class="progress-questions">
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
    await updateUser('nishita');
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
}

// Create question element for user
function createUserQuestionElement(question, isCompleted, username) {
    const questionElement = document.createElement('div');
    questionElement.className = `question-item ${isCompleted ? 'completed' : 'todo'}`;
    
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
            <small>${question.link}</small>
        </div>
        ${question.tags ? `<div class="question-tags">${question.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>` : ''}
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
        addedBy: currentUser,
        addedDate: new Date().toISOString(),
        difficulty: document.getElementById('question-difficulty')?.value || 'Medium',
        tags: document.getElementById('question-tags')?.value.split(',').map(tag => tag.trim()) || []
    };

    saveQuestionToFirebase(newQuestion);
    alert('Question added successfully! All users can now see it.');
}

// Login function
function login() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
        alert('Please enter both username and password');
        return;
    }

    const user = USERS[username];

    if (!user || user.password !== password) {
        alert('Invalid username or password');
        return;
    }

    currentUser = username;

    localStorage.setItem('currentUser', username);
    localStorage.setItem('userRole', user.role);

    // Show appropriate dashboard
    if (user.role === 'admin') {
        showAdminDashboard(username);
    } else {
        showUserDashboard(username);
    }

    // Get initial data
    getQuestionsFromFirebase((questions) => {
        if (user.role === 'admin') {
            loadAdminQuestions(questions);
            loadUserProgress(questions);
        } else {
            loadUserQuestions(username, questions);
        }
    });
}

// Show/Hide functions (same as before)
function showLoginPage() {
    loginPage.classList.remove('hidden');
    adminDashboard.classList.add('hidden');
    userDashboard.classList.add('hidden');
    usernameInput.value = '';
    passwordInput.value = '';
    currentUser = null;
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
    if (questionsRef) {
        questionsRef.off();
        console.log('Cleaned up Firebase listener on logout');
    }

    localStorage.removeItem('currentUser');
    localStorage.removeItem('userRole');

    currentUser = null;
    showLoginPage();
}

// Event Listeners
loginBtn.addEventListener('click', login);
adminLogoutBtn.addEventListener('click', logout);
userLogoutBtn.addEventListener('click', logout);

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
    
    // Check if user was previously logged in
    const savedUser = localStorage.getItem('currentUser');
    const savedRole = localStorage.getItem('userRole');

    if (savedUser && savedRole && USERS[savedUser]) {

        currentUser = savedUser;

        if (savedRole === 'admin') {
            showAdminDashboard(savedUser);
        } else {
            showUserDashboard(savedUser);
        }
        
        // Load data
        getQuestionsFromFirebase((questions) => {
            if (savedRole === 'admin') {
                loadAdminQuestions(questions);
                loadUserProgress(questions);
            } else {
                loadUserQuestions(savedUser, questions);
            }
        });
    } else {
        showLoginPage();
    }
}

// Start the application
init();