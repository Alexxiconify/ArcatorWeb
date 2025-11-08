import {auth, COLLECTIONS, db} from "./firebase-init.js";
import {showMessageBox} from "./utils.js";
import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    increment,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import {updateProfile} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";


const ASSETS = {
    DEFAULT_USER: './defaultuser.png',
    DEFAULT_HERO: './creativespawn.png'
};

let unsubscribeDMs;
let currentDmId;
let currentPhotoURL = ASSETS.DEFAULT_USER;
let currentImageURL;
let currentThreadId;
let photoURL = ASSETS.DEFAULT_USER;

// Expose functions to window immediately
Object.assign(globalThis, {
    openThread: null,
    showNewThreadModal: null,
    openDm: null,
    showSignIn: null,
    handleGoogleSignIn: null,
    updateProfilePhoto: null,
    updateDmImage: null,
    photoURL: ASSETS.DEFAULT_USER
});

// Helper function to create sample threads if none exist
async function createSampleFormsIfNeeded() {
    try {
        const threadsRef = collection(db, COLLECTIONS.FORMS);
        const threadsSnap = await getDocs(threadsRef);

        if (threadsSnap.empty) {
            const sampleThreads = [
                {
                    title: 'Welcome to Arcator!',
                    description: 'Share your thoughts and ideas about our platform. What features would you like to see?',
                    createdAt: serverTimestamp(),
                    createdBy: 'admin',
                    category: 'announcements',
                    tags: ['welcome', 'discussion'],
                    upvotes: 0,
                    commentCount: 0,
                    pinned: true
                },
                {
                    title: 'Gaming Community Hub',
                    description: 'A place to discuss games, share experiences, and find gaming buddies. What are you playing?',
                    createdAt: serverTimestamp(),
                    createdBy: 'admin',
                    category: 'gaming',
                    tags: ['games', 'multiplayer', 'community'],
                    upvotes: 0,
                    commentCount: 0,
                    pinned: false
                }
            ];

            await Promise.all(sampleThreads.map(thread => addDoc(threadsRef, thread)));
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error creating sample threads:', error);
        return false;
    }
}

// Form functionality
async function initForms() {
    const threadsList = document.getElementById('forms-list');
    if (!threadsList) return;

    try {
        threadsList.innerHTML = '<div class="loading-spinner"></div>';

        // Check and create sample threads if needed
        await createSampleFormsIfNeeded();

        const threadsRef = collection(db, COLLECTIONS.FORMS);
        const threadsQuery = query(threadsRef, orderBy('pinned', 'desc'), orderBy('createdAt', 'desc'));
        const threads = await getDocs(threadsQuery);

        threadsList.innerHTML = threads.empty ?
            '<div class="empty-state">No threads available</div>' :
            `<div class="threads-container">
                ${threads.docs.map(doc => createThreadCard(doc)).join('')}
            </div>`;

        // Add new thread button if user is signed in
        if (auth.currentUser) {
            threadsList.insertAdjacentHTML('beforebegin', `
                <div class="sticky top-0 bg-surface z-10 p-4 border-b border-surface-2">
                    <button onclick="window.showNewThreadModal()" class="btn-primary w-full">
                        Create New Thread
                    </button>
                </div>
            `);
        }
    } catch (error) {
        console.error('Error loading threads:', error);
        threadsList.innerHTML = '<div class="error-state">Failed to load threads</div>';
    }
}

function createThreadCard(doc) {
    const thread = doc.data();
    const date = thread.createdAt?.toDate().toLocaleDateString() || 'Unknown';
    const time = thread.createdAt?.toDate().toLocaleTimeString() || '';

    return `
        <div class="thread-card ${thread.pinned ? 'pinned' : ''}" data-thread-id="${doc.id}">
            ${thread.pinned ? '<div class="pinned-badge">📌 Pinned</div>' : ''}
            <div class="thread-content">
                <h3 class="thread-title">
                    <a href="#" onclick="window.openThread('${doc.id}'); return false;">
                        ${thread.title}
                    </a>
                </h3>
                <p class="thread-description">${thread.description}</p>
                <div class="thread-metadata">
                    <span class="thread-category">${thread.category}</span>
                    ${thread.tags?.map(tag => `<span class="thread-tag">#${tag}</span>`).join('') || ''}
                </div>
                <div class="thread-stats">
                    <span class="upvotes">👍 ${thread.upvotes || 0}</span>
                    <span class="comments">💬 ${thread.commentCount || 0}</span>
                    <span class="timestamp" title="${date} ${time}">
                        Posted ${formatTimeAgo(thread.createdAt?.toDate())}
                    </span>
                </div>
            </div>
        </div>
    `;
}

function formatTimeAgo(date) {
    if (!date) return 'sometime ago';

    const seconds = Math.floor((Date.now() - date) / 1000);
    const intervals = {
        year: 31536000,
        month: 2592000,
        week: 604800,
        day: 86400,
        hour: 3600,
        minute: 60
    };

    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsInUnit);
        if (interval >= 1) {
            return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`;
        }
    }
    return 'just now';
}

function showNewThreadModal() {
    if (!auth.currentUser) {
        showMessageBox('Please sign in to create threads', true);
        return;
    }

    const modal = createModal('Create New Thread');
    modal.querySelector('.modal-body').innerHTML = `
        <div class="p-4">
            <form id="new-thread-form" class="space-y-4">
                <div class="form-field">
                    <label>Title</label>
                    <input type="text" id="thread-title" class="form-input w-full" 
                           placeholder="What's on your mind?" required>
                </div>
                <div class="form-field">
                    <label>Description</label>
                    <textarea id="thread-description" class="form-input w-full" rows="4" 
                            placeholder="Share your thoughts..." required></textarea>
                </div>
                <div class="form-field">
                    <label>Category</label>
                    <select id="thread-category" class="form-input w-full" required>
                        <option value="">Select a category...</option>
                        <option value="announcements">Announcements</option>
                        <option value="gaming">Gaming</option>
                        <option value="discussion">Discussion</option>
                        <option value="support">Support</option>
                        <option value="feedback">Feedback</option>
                    </select>
                </div>
                <div class="form-field">
                    <label>Tags (comma-separated)</label>
                    <input type="text" id="thread-tags" class="form-input w-full" 
                           placeholder="gaming, multiplayer, etc">
                </div>
                <div class="flex justify-end gap-2">
                    <button type="button" class="btn-secondary" 
                            onclick="this.closest('.modal').remove()">Cancel</button>
                    <button type="submit" class="btn-primary">Create Thread</button>
                </div>
            </form>
        </div>
    `;

    const form = modal.querySelector('#new-thread-form');
    form.onsubmit = async (e) => {
        e.preventDefault();
        const title = form.querySelector('#thread-title').value.trim();
        const description = form.querySelector('#thread-description').value.trim();
        const category = form.querySelector('#thread-category').value.trim();
        const tags = form.querySelector('#thread-tags').value
            .split(',')
            .map(tag => tag.trim().toLowerCase())
            .filter(Boolean);

        try {
            const threadData = {
                title,
                description,
                category,
                tags,
                createdAt: serverTimestamp(),
                createdBy: auth.currentUser.uid,
                upvotes: 0,
                commentCount: 0,
                pinned: false
            };

            await addDoc(collection(db, COLLECTIONS.FORMS), threadData);
            showMessageBox('Thread created successfully');
            modal.remove();

            // Refresh the threads list
            await initForms();
        } catch (error) {
            console.error('Error creating thread:', error);
            showMessageBox('Failed to create thread', true);
        }
    };

    document.body.appendChild(modal);
}

async function openThread(threadId) {
    const modal = createModal('Loading Thread...');
    document.body.appendChild(modal);

    try {
        const threadDoc = await getDoc(doc(db, COLLECTIONS.FORMS, threadId));
        if (!threadDoc.exists()) {
            modal.querySelector('.modal-content').innerHTML = '<p class="error">Thread not found</p>';
            return;
        }

        const thread = threadDoc.data();
        const creator = await getUserProfile(thread.createdBy);
        const commentsRef = collection(db, COLLECTIONS.FORMS, threadId, COLLECTIONS.SUBMISSIONS);
        const commentsQuery = query(commentsRef, orderBy('createdAt', 'desc'));
        const commentsSnap = await getDocs(commentsQuery);

        modal.querySelector('.modal-content').innerHTML = `
            <div class="thread-view">
                <div class="thread-header">
                    <h2>${thread.title}</h2>
                    <div class="thread-info">
                        <span class="author">Posted by ${creator.displayName || 'Unknown User'}</span>
                        <span class="timestamp">${formatTimeAgo(thread.createdAt?.toDate())}</span>
                    </div>
                    <p class="description">${thread.description}</p>
                    <div class="tags">
                        <span class="category">${thread.category}</span>
                        ${thread.tags?.map(tag => `<span class="tag">#${tag}</span>`).join('') || ''}
                    </div>
                </div>
                <div class="comments-section">
                    ${auth.currentUser ? `
                        <form id="comment-form-${threadId}" class="comment-form">
                            <textarea placeholder="Add a comment..." required></textarea>
                            <div class="flex justify-end mt-2">
                                <button type="submit" class="btn-primary">Post Comment</button>
                            </div>
                        </form>
                    ` : `
                        <div class="sign-in-prompt">
                            <p>Please <a href="#" onclick="window.showSignIn()" class="text-accent">sign in</a> to comment</p>
                        </div>
                    `}
                    <div class="comments-list">
                        ${commentsSnap.empty ?
            '<p class="no-comments">No comments yet. Be the first to share your thoughts!</p>' :
            commentsSnap.docs.map(doc => createCommentElement(doc.data())).join('')
        }
                    </div>
                </div>
            </div>
        `;

        if (auth.currentUser) {
            const commentForm = modal.querySelector(`#comment-form-${threadId}`);
            commentForm.onsubmit = (e) => handleCommentSubmit(e, threadId);
        }

    } catch (error) {
        console.error('Error loading thread:', error);
        modal.querySelector('.modal-content').innerHTML = '<p class="error">Failed to load thread</p>';
    }
}

function createCommentElement(comment) {
    return `
        <div class="comment">
            <div class="comment-header">
                <img src="${comment.authorPhoto || ASSETS.DEFAULT_USER}" 
                     alt="Avatar" class="w-6 h-6 rounded-full">
                <span class="author">${comment.authorName || 'Unknown User'}</span>
                <span class="timestamp">${formatTimeAgo(comment.createdAt?.toDate())}</span>
            </div>
            <div class="comment-content">${comment.content}</div>
        </div>
    `;
}

async function handleCommentSubmit(event, threadId) {
    event.preventDefault();
    if (!auth.currentUser) {
        showMessageBox('Please sign in to comment', true);
        return;
    }

    const textarea = event.target.querySelector('textarea');
    const content = textarea.value.trim();
    if (!content) return;

    try {
        const commentData = {
            content,
            threadId,
            authorId: auth.currentUser.uid,
            authorName: auth.currentUser.displayName,
            authorPhoto: auth.currentUser.photoURL,
            createdAt: serverTimestamp()
        };

        const threadRef = doc(db, COLLECTIONS.FORMS, threadId);
        const batch = writeBatch(db);

        // Add the comment
        const commentRef = doc(collection(db, COLLECTIONS.FORMS, threadId, COLLECTIONS.SUBMISSIONS));
        batch.set(commentRef, commentData);

        // Update thread stats
        batch.update(threadRef, {
            commentCount: increment(1)
        });

        await batch.commit();

        textarea.value = '';
        showMessageBox('Comment posted successfully');

        // Refresh the thread view
        await openThread(threadId);
    } catch (error) {
        console.error('Error posting comment:', error);
        showMessageBox('Failed to post comment', true);
    }
}

// DM functionality
async function initDMs() {
    const dmList = document.getElementById('dm-list');
    const messageForm = document.getElementById('message-form');
    const messagesContainer = document.getElementById('messages-container');

    if (!dmList) return;

    try {
        // Show loading state
        dmList.innerHTML = '<div class="loading-spinner"></div>';
        if (messagesContainer) {
            messagesContainer.innerHTML = `
                <div class="text-center p-4 text-gray-500">
                    Select a conversation or start a new one
                </div>
            `;
        }

        if (!auth.currentUser) {
            dmList.innerHTML = `
                <div class="text-center p-4">
                    <p>Please <a href="#" onclick="window.showSignIn()" class="text-accent">sign in</a> to view messages</p>
                </div>`;
            if (messageForm) messageForm.style.display = 'none';
            return;
        }

        // Show "Start New Conversation" button at the top
        dmList.innerHTML = `
            <div class="p-4 border-b border-surface-2">
                <button onclick="window.showNewDmModal()" class="btn-primary w-full">
                    Start New Conversation
                </button>
            </div>
            <div id="dm-list-content" class="overflow-y-auto">
                <div class="loading-spinner"></div>
            </div>
        `;

        const dmsRef = collection(db, COLLECTIONS.DMS(auth.currentUser.uid));
        const q = query(dmsRef, orderBy('lastMessageAt', 'desc'));

        if (unsubscribeDMs) {
            unsubscribeDMs();
            unsubscribeDMs = null;
        }

        unsubscribeDMs = onSnapshot(q, async snapshot => {
            const dmListContent = document.getElementById('dm-list-content');
            if (!dmListContent) return;

            if (snapshot.empty) {
                dmListContent.innerHTML = `
                    <div class="empty-state p-4 text-center">
                        <p>No conversations yet</p>
                        <p class="text-sm text-gray-500 mt-2">Click "Start New Conversation" to begin chatting</p>
                    </div>`;
                return;
            }

            const dmsHTML = await Promise.all(snapshot.docs.map(createDmElement));
            dmListContent.innerHTML = dmsHTML.join('');

            if (!currentDmId && snapshot.docs.length) {
                await openDm(snapshot.docs[0].id);
            }
        }, error => {
            console.error('Error loading DMs:', error);
            const dmListContent = document.getElementById('dm-list-content');
            if (dmListContent) {
                dmListContent.innerHTML = '<div class="error-state">Failed to load conversations</div>';
            }
        });

    } catch (error) {
        console.error('Error initializing DMs:', error);
        dmList.innerHTML = '<div class="error-state">Failed to initialize conversations</div>';
    }
}

async function createDmElement(doc) {
    const dm = doc.data();
    const participantsProfiles = await Promise.all(
        (dm.participants || [])
            .filter(uid => uid !== auth.currentUser?.uid)
            .map(getUserProfile)
    );

    const profilesText = participantsProfiles
        .map(p => p?.displayName || 'Unknown User')
        .join(', ');

    // Get avatar image with proper null/undefined handling
    let avatarImage = ASSETS.DEFAULT_USER;
    if (dm.image) {
        avatarImage = dm.image;
    } else if (participantsProfiles && participantsProfiles.length > 0 && participantsProfiles[0]) {
        avatarImage = participantsProfiles[0].photoURL || ASSETS.DEFAULT_USER;
    }

    return `
        <div class="dm-item ${currentDmId === doc.id ? 'active' : ''}" 
             onclick="window.openDm('${doc.id}')">
            <div class="flex items-center gap-3">
                <img src="${avatarImage}" 
                     alt="Avatar" class="w-10 h-10 rounded-full object-cover">
                <div class="flex-1 min-w-0">
                    <div class="font-medium">${dm.name || profilesText}</div>
                    <div class="text-sm opacity-75 truncate">${dm.lastMessage || 'No messages'}</div>
                    <div class="text-xs opacity-50">
                        ${dm.lastMessageAt?.toDate().toLocaleString() || ''}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function createModal(title) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>${title}</h2>
                <button onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="modal-body">
                <div class="loading-spinner"></div>
            </div>
        </div>
    `;
    return modal;
}

async function getUserProfile(uid) {
    try {
        const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, uid));
        const profile = userDoc.exists() ? userDoc.data() : {
            displayName: 'Unknown User',
            photoURL: ASSETS.DEFAULT_USER
        };

        // Update module-level photoURL
        if (profile.photoURL) {
            photoURL = profile.photoURL;
            currentPhotoURL = profile.photoURL;
        }

        return profile;
    } catch (error) {
        console.error('Error getting user profile:', error);
        return {
            displayName: 'Unknown User',
            photoURL: ASSETS.DEFAULT_USER
        };
    }
}

// Add this function to handle sign in
function showSignIn() {
    const modal = createModal('Sign In');
    modal.querySelector('.modal-body').innerHTML = `
        <div class="p-4">
            <div class="text-center mb-4">
                <p>Please sign in to continue</p>
            </div>
            <div class="flex justify-center gap-4">
                <button onclick="window.handleGoogleSignIn()" class="btn-primary">
                    Sign in with Google
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Add this function to handle new DM modal
function showNewDmModal() {
    const modal = createModal('New Conversation');
    modal.querySelector('.modal-body').innerHTML = `
        <div class="p-4">
            <form id="new-dm-form" class="space-y-4">
                <div class="form-field">
                    <label>Recipients (comma-separated usernames)</label>
                    <input type="text" id="dm-recipients" class="form-input w-full" 
                           placeholder="@user1, @user2" required>
                </div>
                <div class="form-field">
                    <label>Conversation Name (optional)</label>
                    <input type="text" id="dm-name" class="form-input w-full" 
                           placeholder="Group Chat Name">
                </div>
                <div class="form-field">
                    <label>Conversation Image (optional)</label>
                    <input type="url" id="dm-image" class="form-input w-full" 
                           placeholder="https://example.com/image.jpg">
                </div>
                <div class="flex justify-end gap-2">
                    <button type="button" class="btn-secondary" 
                            onclick="this.closest('.modal').remove()">Cancel</button>
                    <button type="submit" class="btn-primary">Create</button>
                </div>
            </form>
        </div>
    `;

    const form = modal.querySelector('#new-dm-form');
    form.onsubmit = async (e) => {
        e.preventDefault();
        const recipients = form.querySelector('#dm-recipients').value.trim();
        const name = form.querySelector('#dm-name').value.trim();
        const image = form.querySelector('#dm-image').value.trim();

        try {
            const userIds = await resolveUserHandles(recipients.split(',').map(h => h.trim()));
            if (!userIds.length) {
                showMessageBox('No valid recipients found', true);
                return;
            }

            await createDmConversation(userIds, name, image);
            modal.remove();
        } catch (error) {
            console.error('Error creating conversation:', error);
            showMessageBox('Failed to create conversation', true);
        }
    };

    document.body.appendChild(modal);
}

// Add this function to handle message submission
async function handleMessageSubmit(event) {
    event.preventDefault();
    if (!auth.currentUser || !currentDmId) return;

    const input = event.target.querySelector('input[type="text"]');
    if (!input?.value.trim()) return;

    const content = input.value.trim();
    input.value = '';

    try {
        // Get user's profile photo URL
        const senderPhotoURL = auth.currentUser.photoURL || currentPhotoURL || ASSETS.DEFAULT_USER;

        const messageData = {
            content,
            sender: auth.currentUser.uid,
            createdAt: serverTimestamp(),
            photoURL: senderPhotoURL
        };

        const dmRef = doc(db, COLLECTIONS.DMS(auth.currentUser.uid), currentDmId);
        const dmDoc = await getDoc(dmRef);

        if (!dmDoc.exists()) {
            showMessageBox('Conversation not found', true);
            return;
        }

        const dm = dmDoc.data();

        await Promise.all(dm.participants.map(async participantId => {
            const messagesRef = collection(
                db,
                COLLECTIONS.MESSAGES(participantId, currentDmId)
            );
            await addDoc(messagesRef, messageData);

            const participantDmRef = doc(
                db,
                COLLECTIONS.DMS(participantId),
                currentDmId
            );
            await updateDoc(participantDmRef, {
                lastMessage: content,
                lastMessageAt: serverTimestamp(),
                lastMessageSender: auth.currentUser.uid,
                lastMessageSenderPhoto: senderPhotoURL
            });
        }));

    } catch (error) {
        console.error('Error sending message:', error);
        showMessageBox('Failed to send message', true);
    }
}

// Compare function for consistent sorting (lexicographic, non-alphabetic)
function compareParticipants(a, b) {
    // Standard string comparison that doesn't sort alphabetically
    // but instead uses Unicode code point values for consistency
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
}

// Helper function to create consistent DM ID
function createDmId(participantIds) {
    // Sort participants consistently using compare function
    return [...new Set(participantIds)]
        .sort(compareParticipants)
        .join('_');
}

// Add this function to create a new DM conversation
async function createDmConversation(userIds, name = '', image = '') {
    if (!auth.currentUser || !userIds.length) return null;

    const allParticipants = [auth.currentUser.uid, ...userIds];
    const dmId = createDmId(allParticipants);

    const dmData = {
        participants: allParticipants,
        name: name || (userIds.length > 1 ? 'Group Chat' : ''),
        image: image || '',
        type: userIds.length > 1 ? 'group' : 'private',
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser.uid,
        lastMessageAt: serverTimestamp()
    };

    await Promise.all(allParticipants.map(uid =>
        setDoc(doc(db, COLLECTIONS.DMS(uid), dmId), dmData)
    ));

    await openDm(dmId);
    return dmId;
}

// Add this function to update profile photo
async function updateProfilePhoto(url) {
    if (!auth.currentUser) return;

    try {
        // Update all photoURL references
        currentPhotoURL = url;
        photoURL = url;

        await updateProfile(auth.currentUser, {photoURL: url});
        await setDoc(doc(db, COLLECTIONS.USERS, auth.currentUser.uid),
            {photoURL: url}, {merge: true});
    } catch (error) {
        console.error('Error updating profile photo:', error);
        showMessageBox('Failed to update profile photo', true);
    }
}

// Add this function to update DM image
async function updateDmImage(dmId, url) {
    if (!auth.currentUser || !dmId) return;

    try {
        const dmRef = doc(db, COLLECTIONS.DMS(auth.currentUser.uid), dmId);
        const dmDoc = await getDoc(dmRef);

        if (!dmDoc.exists()) return;

        const dm = dmDoc.data();
        await Promise.all(dm.participants.map(uid =>
            setDoc(doc(db, COLLECTIONS.DMS(uid), dmId),
                {image: url}, {merge: true})
        ));

        currentImageURL = url;
    } catch (error) {
        console.error('Error updating DM image:', error);
        showMessageBox('Failed to update conversation image', true);
    }
}

// Add missing resolveUserHandles function
async function resolveUserHandles(handles) {
    const userIds = new Set();
    for (const handle of handles) {
        if (!handle || handle.trim().length === 0) continue;

        try {
            const usersRef = collection(db, COLLECTIONS.USERS);
            const cleanHandle = handle.replace('@', '').trim();
            const userQuery = query(usersRef, where('handle', '==', cleanHandle));
            const snapshot = await getDocs(userQuery);

            if (snapshot.size > 0) {
                userIds.add(snapshot.docs[0].id);
            } else {
                // Try by display name if handle not found
                const nameQuery = query(usersRef, where('displayName', '==', cleanHandle));
                const nameSnapshot = await getDocs(nameQuery);
                if (nameSnapshot.size > 0) {
                    userIds.add(nameSnapshot.docs[0].id);
                }
            }
        } catch (error) {
            console.error(`Error resolving handle ${handle}:`, error);
        }
    }
    return Array.from(userIds);
}

// Make sure all window functions are assigned properly
Object.assign(globalThis, {
    openThread,
    showNewThreadModal,
    openDm,
    showSignIn,
    showNewDmModal,
    handleMessageSubmit,
    updateProfilePhoto,
    updateDmImage,
    createDmConversation,
    handleGoogleSignIn: handleGoogleSignIn || (() => alert('Google Sign In not configured'))
});

// Export functions
export {initForms, initDMs};

async function openDm(dmId) {
    const messagesContainer = document.getElementById('messages-container');
    if (!messagesContainer) return;

    currentDmId = dmId;

    try {
        messagesContainer.innerHTML = '<div class="loading-spinner"></div>';

        if (!auth.currentUser) {
            messagesContainer.innerHTML = `
                <div class="text-center p-4">
                    <p>Please <a href="#" onclick="window.showSignIn()" class="text-accent">sign in</a> to view messages</p>
                </div>`;
            return;
        }

        const dmRef = doc(db, COLLECTIONS.DMS(auth.currentUser.uid), dmId);
        const dmDoc = await getDoc(dmRef);

        if (!dmDoc.exists()) {
            messagesContainer.innerHTML = '<div class="error-state">Conversation not found</div>';
            return;
        }

        const dm = dmDoc.data();
        const messagesRef = collection(db, COLLECTIONS.MESSAGES(auth.currentUser.uid, dmId));
        const messagesQuery = query(messagesRef, orderBy('createdAt', 'asc'));
        const messagesSnap = await getDocs(messagesQuery);

        const participantProfiles = await Promise.all(
            dm.participants
                .filter(uid => uid !== auth.currentUser.uid)
                .map(getUserProfile)
        );

        const dmName = dm.name || participantProfiles.map(p => p?.displayName || 'Unknown User').join(', ');

        // Get avatar image with proper null/undefined handling
        let dmImage = ASSETS.DEFAULT_USER;
        if (dm.image) {
            dmImage = dm.image;
        } else if (participantProfiles && participantProfiles.length > 0 && participantProfiles[0]) {
            dmImage = participantProfiles[0].photoURL || ASSETS.DEFAULT_USER;
        }

        messagesContainer.innerHTML = `
            <div class="dm-header">
                <div class="flex items-center gap-3 p-4 border-b border-surface-2">
                    <img src="${dmImage}" alt="Avatar" class="w-10 h-10 rounded-full object-cover">
                    <div class="flex-1 min-w-0">
                        <div class="font-medium">${dmName}</div>
                        <div class="text-sm opacity-75">${dm.participants.length} participants</div>
                    </div>
                </div>
            </div>
            <div class="messages-list p-4 space-y-4">
                ${messagesSnap.empty ? `
                    <div class="text-center text-gray-500">
                        No messages yet. Start the conversation!
                    </div>
                ` : messagesSnap.docs.map(doc => {
            const message = doc.data();
            const isOwn = message.sender === auth.currentUser.uid;
            const messagePhotoURL = message.photoURL || ASSETS.DEFAULT_USER;
            return `
                        <div class="message ${isOwn ? 'self-end' : 'self-start'}">
                            <div class="flex items-start gap-2 ${isOwn ? 'flex-row-reverse' : ''}">
                                <img src="${messagePhotoURL}" 
                                     alt="Avatar" class="w-8 h-8 rounded-full">
                                <div class="message-content ${isOwn ? 'bg-accent' : 'bg-surface-2'} 
                                                           rounded-lg p-3 max-w-xs">
                                    ${message.content}
                                </div>
                            </div>
                            <div class="text-xs opacity-50 mt-1 ${isOwn ? 'text-right' : ''}">
                                ${message.createdAt?.toDate().toLocaleString() || ''}
                            </div>
                        </div>
                    `;
        }).join('')}
            </div>
            <form class="message-form p-4 border-t border-surface-2">
                <div class="flex gap-2">
                    <input type="text" class="form-input flex-1" 
                           placeholder="Type your message...">
                    <button type="submit" class="btn-primary">Send</button>
                </div>
            </form>
        `;

        // Setup message form handler
        const form = messagesContainer.querySelector('.message-form');
        form.onsubmit = handleMessageSubmit;

        // Scroll to bottom
        const messagesList = messagesContainer.querySelector('.messages-list');
        messagesList.scrollTop = messagesList.scrollHeight;

    } catch (error) {
        console.error('Error loading conversation:', error);
        messagesContainer.innerHTML = '<div class="error-state">Failed to load conversation</div>';
    }
}