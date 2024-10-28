document.addEventListener('DOMContentLoaded', () => {
    console.log("Document Loaded");

    // Firebase Initialization Check
    if (!firebase.apps.length) {
        console.error('Firebase not initialized');
        return;
    } else {
        console.log('Firebase initialized successfully');
    }

    // Firebase Services
    const auth = firebase.auth();
    const database = firebase.database();

    // Set Persistence to LOCAL to keep user logged in after refresh
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .then(() => {
            console.log("Firebase Auth persistence set to LOCAL");
        })
        .catch((error) => {
            console.error("Error setting persistence:", error);
        });

    // UI Elements
    const loadingPage = document.getElementById('loading-page');
    const loginPage = document.getElementById('login-page');
    const chatPage = document.getElementById('chat-page');
    const loginButton = document.getElementById('login-button');
    const logoutButton = document.getElementById('logout-button');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const messagesDiv = document.getElementById('messages');
    const profileIcon = document.getElementById('profile-icon');
    const profileName = document.getElementById('profile-name');
    const onlineUsersList = document.getElementById('online-users-list');
    const typingIndicator = document.getElementById('typing-indicator');
    const themeSwitcher = document.getElementById('theme-switcher');

    let typingTimeout;

    // Authentication State Listener
    auth.onAuthStateChanged((user) => {
        loadingPage.classList.add('hidden'); // Hide loading page after checking auth state

        if (user) {
            console.log("User is logged in:", user);
            setUpChatPage(user);
        } else {
            console.log("User is logged out");
            loginPage.classList.remove('hidden');
            chatPage.classList.add('hidden');
        }
    });

    // Sign In with Google
    loginButton.addEventListener('click', () => {
        console.log("Login Button Clicked");
        loginButton.disabled = true;
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider)
            .then((result) => {
                console.log("User signed in:", result.user);
                setUpChatPage(result.user);
            })
            .catch((error) => {
                console.error("Error during login:", error);
                alert("Login failed: " + error.message);
            })
            .finally(() => {
                loginButton.disabled = false;
            });
    });

    // Set Up Chat Page
    function setUpChatPage(user) {
        console.log("Setting up Chat Page");

        // Hide login and loading pages, and show chat page
        loadingPage.classList.add('hidden');
        loginPage.classList.add('hidden');
        chatPage.classList.remove('hidden');

        profileIcon.src = user.photoURL || 'default-avatar.png';
        profileName.textContent = user.displayName;

        const userStatusRef = database.ref(`onlineUsers/${user.uid}`);
        userStatusRef.set({
            displayName: user.displayName,
            online: true
        });
        userStatusRef.onDisconnect().remove();

        listenForMessages(user);
        listenForOnlineUsers();
        listenForTyping();
        markMessagesAsRead(user);
    }

    // Sign Out
    logoutButton.addEventListener('click', () => {
        console.log("Logout Button Clicked");
        const userStatusRef = database.ref(`onlineUsers/${auth.currentUser.uid}`);
        userStatusRef.remove().then(() => {
            auth.signOut().then(() => {
                console.log("User signed out");
            });
        });
    });

    // Send Message
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        } else {
            handleTyping();
        }
    });

    function sendMessage() {
        const message = messageInput.value.trim();
        if (message && auth.currentUser) {
            const messagesRef = database.ref('messages');
            messagesRef.push({
                user: auth.currentUser.displayName,
                message: message,
                timestamp: new Date().toISOString(),
                readBy: { [auth.currentUser.uid]: true } // Mark the message as read by sender
            }).then(() => {
                console.log("Message sent successfully");
                messageInput.value = '';
                stopTyping();
            }).catch((error) => {
                console.error("Error sending message:", error);
            });
        }
    }

    function handleTyping() {
        const typingRef = database.ref('typing');
        typingRef.set({
            user: auth.currentUser.displayName
        });
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(stopTyping, 2000);
    }

    function stopTyping() {
        const typingRef = database.ref('typing');
        typingRef.remove();
    }

    function listenForMessages(currentUser) {
        const messagesRef = database.ref('messages');
        messagesRef.off('child_added');
        messagesRef.on('child_added', (snapshot) => {
            const messageData = snapshot.val();
            addMessageToDOM(snapshot.key, messageData);

            // Mark the message as read if the user is active and logged in
            if (auth.currentUser && !messageData.readBy[auth.currentUser.uid]) {
                markSingleMessageAsRead(snapshot.key);
            }
        });
    }

    function addMessageToDOM(messageKey, messageData) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message-item');
        messageElement.dataset.key = messageKey; // Add data-key attribute for easier selection
        const time = new Date(messageData.timestamp);
        const formattedTime = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        messageElement.innerHTML = `<strong>${messageData.user}:</strong> ${messageData.message} <span class="timestamp">(${formattedTime})</span>`;

        // Add unread indicator if necessary
        if (!messageData.readBy || !messageData.readBy[auth.currentUser.uid]) {
            const unreadBadge = document.createElement('span');
            unreadBadge.classList.add('unread-indicator');
            unreadBadge.textContent = ' (Unread)';
            messageElement.appendChild(unreadBadge);
        } else {
            // Remove unread indicator if the message is read
            const unreadBadge = messageElement.querySelector('.unread-indicator');
            if (unreadBadge) {
                unreadBadge.remove();
            }
        }

        messagesDiv.appendChild(messageElement);
        messagesDiv.scroll({ top: messagesDiv.scrollHeight, behavior: 'smooth' });
    }

    function listenForOnlineUsers() {
        const onlineUsersRef = database.ref('onlineUsers');
        onlineUsersList.innerHTML = '';
        onlineUsersRef.on('value', (snapshot) => {
            clearOnlineUsers();
            snapshot.forEach((childSnapshot) => {
                const user = childSnapshot.val();
                const userElement = document.createElement('div');
                userElement.classList.add('online-user');
                userElement.textContent = user.displayName;
                onlineUsersList.appendChild(userElement);
            });
        });
    }

    function listenForTyping() {
        const typingRef = database.ref('typing');
        typingRef.on('value', (snapshot) => {
            if (snapshot.exists()) {
                typingIndicator.classList.remove('hidden');
                typingIndicator.textContent = `${snapshot.val().user} is typing...`;
            } else {
                typingIndicator.classList.add('hidden');
            }
        });
    }

    function markMessagesAsRead(user) {
        const messagesRef = database.ref('messages');
        messagesRef.once('value', (snapshot) => {
            snapshot.forEach((childSnapshot) => {
                const messageKey = childSnapshot.key;
                const messageData = childSnapshot.val();

                // If the message hasn't been read by this user, mark it as read
                if (!messageData.readBy || !messageData.readBy[user.uid]) {
                    let updates = {};
                    updates[`messages/${messageKey}/readBy/${user.uid}`] = true;
                    database.ref().update(updates);
                    // Remove unread badge from DOM
                    const messageElement = document.querySelector(`[data-key="${messageKey}"]`);
                    if (messageElement) {
                        const unreadBadge = messageElement.querySelector('.unread-indicator');
                        if (unreadBadge) {
                            unreadBadge.remove();
                        }
                    }
                }
            });
        });
    }

    function markSingleMessageAsRead(messageKey) {
        const updates = {};
        updates[`messages/${messageKey}/readBy/${auth.currentUser.uid}`] = true;
        database.ref().update(updates).then(() => {
            // Remove unread badge from DOM
            const messageElement = document.querySelector(`[data-key="${messageKey}"]`);
            if (messageElement) {
                const unreadBadge = messageElement.querySelector('.unread-indicator');
                if (unreadBadge) {
                    unreadBadge.remove();
                }
            }
        });
    }

    function clearMessages() {
        messagesDiv.innerHTML = '';
    }

    function clearOnlineUsers() {
        onlineUsersList.innerHTML = '';
    }

    listenForTyping();

    // Theme switcher logic
    themeSwitcher.addEventListener('click', () => {
        document.body.classList.toggle('dark-theme');
        localStorage.setItem('theme', document.body.classList.contains('dark-theme') ? 'dark' : 'light');
    });

    // Load saved theme
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-theme');
    }

    // Handle visibility change to mark messages as read when user views the chat
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && auth.currentUser) {
            markMessagesAsRead(auth.currentUser);
        }
    });

    // Listen for user status change to mark messages as read when user logs in
    auth.onAuthStateChanged((user) => {
        if (user) {
            markMessagesAsRead(user);
        }
    });

    module.exports = { sendMessage, handleTyping, stopTyping };
});
