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
        addedBy: currentUserName,
        addedDate: new Date().toISOString(),
        difficulty: document.getElementById('question-difficulty')?.value || 'Easy',
        tags: document.getElementById('question-tags')?.value.split(',').map(tag => tag.trim()) || []
    };

    saveQuestionToFirebase(newQuestion);
    alert('Question added successfully! All users can now see it.');
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
