const firebaseConfig = {
    apiKey: "AIzaSyCOVKA4i-d9wI-ap7hk1Jih_8So2FNHEh0",
    authDomain: "leetcode-tracker-dd8eb.firebaseapp.com",
    databaseURL: "https://leetcode-tracker-dd8eb-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "leetcode-tracker-dd8eb",
    storageBucket: "leetcode-tracker-dd8eb.firebasestorage.app",
    messagingSenderId: "299762893783",
    appId: "1:299762893783:web:906977d77b5a85d7b34192"
};

firebase.initializeApp(firebaseConfig);

window.db = firebase.database();
window.auth = firebase.auth();
