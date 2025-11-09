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
    where
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
            `<div class="threads-list">
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

    // Category emoji map
    const categoryEmojis = {
        'announcements': '📢',
        'gaming': '🎮',
        'discussion': '💬',
        'support': '🤝',
        'feedback': '💡',
        'default': '📝'
    };

    const emoji = categoryEmojis[thread.category] || categoryEmojis.default;

    return `
        <div class="thread-card" data-thread-id="${doc.id}" onclick="window.openThread('${doc.id}')">
            <div style="flex-shrink: 0; font-size: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
                ${emoji}
                ${thread.pinned ? '<span style="font-size: 0.875rem;">📌</span>' : ''}
            </div>
            
            <div style="flex: 1; display: flex; flex-direction: column; gap: 0.5rem;">
                <div>
                    <h3 style="margin: 0; font-size: 1.125rem; font-weight: 600; color: var(--color-text);">
                        ${thread.title}
                    </h3>
                    <p style="margin: 0.5rem 0 0 0; font-size: 0.875rem; color: var(--color-text-2); line-height: 1.4; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
                        ${thread.description}
                    </p>
                </div>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    <span style="display: inline-block; background: var(--color-accent); color: white; padding: 0.25rem 0.5rem; border-radius: 0.375rem; font-size: 0.75rem; font-weight: 500;">
                        ${thread.category}
                    </span>
                    ${thread.tags?.slice(0, 2).map(tag => `<span style="display: inline-block; background: var(--color-surface-3); color: var(--color-text-2); padding: 0.25rem 0.5rem; border-radius: 0.375rem; font-size: 0.75rem;">#${tag}</span>`).join('') || ''}
                </div>
            </div>
            
            <div style="flex-shrink: 0; font-size: 0.875rem; color: var(--color-text-2); white-space: nowrap; display: flex; flex-direction: column; gap: 0.25rem; align-items: flex-end;">
                <span title="${date} ${time}" style="font-size: 0.75rem;">
                    ${formatTimeAgo(thread.createdAt?.toDate())}
                </span>
                <div style="display: flex; gap: 0.75rem;">
                    <span style="display: inline-flex; align-items: center; gap: 0.25rem;">
                        👍 <span style="font-weight: 500;">${thread.upvotes || 0}</span>
                    </span>
                    <span style="display: inline-flex; align-items: center; gap: 0.25rem;">
                        💬 <span style="font-weight: 500;">${thread.commentCount || 0}</span>
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
            <div class="flex justify-end gap-2 mt-6">
                <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                <button type="submit" class="btn-primary">Create Thread</button>
            </div>
        </form>
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
    const modal = createModal('');
    document.body.appendChild(modal);

    try {
        const threadDoc = await getDoc(doc(db, COLLECTIONS.FORMS, threadId));
        if (!threadDoc.exists()) {
            modal.querySelector('.modal-body').innerHTML = '<p class="error">Thread not found</p>';
            return;
        }

        const thread = threadDoc.data();
        const creator = await getUserProfile(thread.createdBy);
        const commentsRef = collection(db, COLLECTIONS.FORMS, threadId, COLLECTIONS.SUBMISSIONS);
        const commentsQuery = query(commentsRef, orderBy('createdAt', 'asc'));
        const commentsSnap = await getDocs(commentsQuery);

        modal.querySelector('.modal-body').innerHTML = `
            <div class="thread-view" style="max-height: 600px; overflow-y: auto;">
                <div class="thread-header mb-6 pb-6 border-b border-accent-dark">
                    <h2 style="margin: 0 0 0.5rem 0; font-size: 1.5rem; font-weight: 700;">${thread.title}</h2>
                    <div style="display: flex; gap: 1rem; font-size: 0.875rem; color: var(--color-text-2); margin-bottom: 1rem;">
                        <span class="author">Posted by ${creator.displayName || 'Unknown User'}</span>
                        <span class="timestamp">${formatTimeAgo(thread.createdAt?.toDate())}</span>
                    </div>
                    <p style="margin: 0 0 1rem 0; color: var(--color-text-2); line-height: 1.5;">${thread.description}</p>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem;">
                        <span style="display: inline-block; background: var(--color-accent); color: white; padding: 0.25rem 0.75rem; border-radius: 0.375rem; font-size: 0.75rem; font-weight: 500;">
                            ${thread.category}
                        </span>
                        ${thread.tags?.map(tag => `<span style="display: inline-block; background: var(--color-surface-3); color: var(--color-text-2); padding: 0.25rem 0.75rem; border-radius: 0.375rem; font-size: 0.75rem;">#${tag}</span>`).join('') || ''}
                    </div>
                    <div style="display: flex; gap: 2rem; font-size: 0.875rem;">
                        <span style="cursor: pointer;" onclick="window.addThreadReaction('${threadId}', '👍')">👍 ${thread.reactions?.['👍'] || 0} Upvotes</span>
                        <span>💬 ${thread.commentCount || 0} Comments</span>
                    </div>
                </div>
                
                <div class="comments-section">
                    ${auth.currentUser ? `
                        <form id="comment-form-${threadId}" class="comment-form mb-6 pb-6 border-b border-accent-dark">
                            <textarea style="width: 100%; background: var(--color-surface-2); border: 1px solid var(--color-accent-dark); border-radius: 0.375rem; padding: 0.75rem; color: var(--color-text); resize: vertical; min-height: 80px;" placeholder="Add a comment..." required></textarea>
                            <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem;">
                                <button type="submit" class="btn-primary">Post Comment</button>
                            </div>
                        </form>
                    ` : `
                        <div style="background: var(--color-surface-2); padding: 1rem; border-radius: 0.375rem; margin-bottom: 1rem; text-align: center;">
                            <p>Please <a href="#" onclick="window.showSignIn()" class="text-accent">sign in</a> to comment</p>
                        </div>
                    `}
                    <div class="comments-list" id="comments-list-${threadId}">
                        ${commentsSnap.empty ?
            '<p style="text-align: center; color: var(--color-text-2); padding: 2rem 0;">No comments yet. Be the first to share your thoughts!</p>' :
            commentsSnap.docs.map(doc => createCommentElement(doc.id, doc.data(), threadId)).join('')
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
        modal.querySelector('.modal-body').innerHTML = '<p class="error">Failed to load thread</p>';
    }
}

function createCommentElement(commentId, comment, threadId, depth = 0) {
    return `
        <div class="comment" style="margin-left: ${depth * 2}rem; margin-bottom: 1rem; padding: 1rem; background: var(--color-surface-2); border-left: 2px solid var(--color-accent); border-radius: 0.375rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                <img src="${comment.authorPhoto || ASSETS.DEFAULT_USER}" 
                     alt="Avatar" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; flex-shrink: 0;">
                <span style="font-weight: 600; color: var(--color-text);">${comment.authorName || 'Unknown User'}</span>
                <span style="font-size: 0.75rem; color: var(--color-text-2);">${formatTimeAgo(comment.createdAt?.toDate())}</span>
            </div>
            <p style="margin: 0.5rem 0; color: var(--color-text); line-height: 1.5; word-break: break-word;">${comment.content}</p>
            <div style="display: flex; gap: 1rem; margin-top: 0.75rem; font-size: 0.875rem; flex-wrap: wrap;">
                <button onclick="window.toggleReplyForm('${commentId}', '${threadId}')" style="background: none; border: none; color: var(--color-accent); cursor: pointer; padding: 0; font-size: inherit;">💬 Reply</button>
                <span style="cursor: pointer; color: var(--color-text-2);" onclick="window.addCommentReaction('${commentId}', '${threadId}', '👍')">👍 ${comment.reactions?.['👍'] || 0}</span>
                <span style="cursor: pointer; color: var(--color-text-2);" onclick="window.addCommentReaction('${commentId}', '${threadId}', '❤️')">❤️ ${comment.reactions?.['❤️'] || 0}</span>
                <span style="cursor: pointer; color: var(--color-text-2);" onclick="window.addCommentReaction('${commentId}', '${threadId}', '😂')">😂 ${comment.reactions?.['😂'] || 0}</span>
            </div>
            <div id="reply-form-${commentId}" class="reply-form" style="display: none; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--color-accent-dark);"></div>
            <div id="replies-${commentId}" class="replies-container" style="margin-top: 1rem;"></div>
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
            authorName: auth.currentUser.displayName || 'Anonymous',
            authorPhoto: auth.currentUser.photoURL || ASSETS.DEFAULT_USER,
            createdAt: serverTimestamp()
        };

        // Create comment using addDoc directly to submissions subcollection
        const submissionsRef = collection(db, COLLECTIONS.FORMS, threadId, COLLECTIONS.SUBMISSIONS);
        await addDoc(submissionsRef, commentData);

        // Update thread stats
        const threadRef = doc(db, COLLECTIONS.FORMS, threadId);
        await updateDoc(threadRef, {
            commentCount: increment(1)
        });


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

    const closeModal = () => modal.remove();

    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>${title}</h2>
                <button class="modal-close-btn" aria-label="Close">×</button>
            </div>
            <div class="modal-body">
                <div class="loading-spinner"></div>
            </div>
        </div>
    `;

    // Close button functionality
    modal.querySelector('.modal-close-btn').addEventListener('click', closeModal);

    // Close on Escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

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
        <div class="modal-tabs">
            <button class="modal-tab active" data-tab="create-new">Create New</button>
            <button class="modal-tab" data-tab="recent">Recent Users</button>
            <button class="modal-tab" data-tab="search">Search Users</button>
        </div>
        
        <div id="create-new-tab" class="modal-tab-content active">
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
                <div class="flex justify-end gap-2 mt-6">
                    <button type="button" class="btn-secondary modal-close-btn-text">Cancel</button>
                    <button type="submit" class="btn-primary">Create</button>
                </div>
            </form>
        </div>
        
        <div id="recent-tab" class="modal-tab-content hidden">
            <div id="recent-users-list" class="space-y-2">
                <p class="text-text-2">Loading recent users...</p>
            </div>
        </div>
        
        <div id="search-tab" class="modal-tab-content hidden">
            <div class="form-field mb-4">
                <input type="text" id="user-search-input" class="form-input w-full" 
                       placeholder="Search users by name or handle...">
            </div>
            <div id="search-users-list" class="space-y-2">
                <p class="text-text-2">Start typing to search...</p>
            </div>
        </div>
    `;

    // Tab switching
    const tabs = modal.querySelectorAll('.modal-tab');
    const tabContents = modal.querySelectorAll('.modal-tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.add('hidden'));

            tab.classList.add('active');
            const tabId = tab.getAttribute('data-tab');
            modal.querySelector(`#${tabId}-tab`)?.classList.remove('hidden');
        });
    });

    // Form submission
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

// Search users for mention autocomplete
async function searchUsers(searchTerm) {
    if (!searchTerm || searchTerm.length < 2) return [];

    try {
        const usersRef = collection(db, COLLECTIONS.USERS);
        const cleanTerm = searchTerm.toLowerCase();

        // Search by handle
        const handleQuery = query(
            usersRef,
            where('handle', '>=', cleanTerm),
            where('handle', '<=', cleanTerm + '\uf8ff')
        );
        const handleSnapshot = await getDocs(handleQuery);

        const results = new Map();
        handleSnapshot.docs.forEach(doc => {
            const data = doc.data();
            results.set(doc.id, {
                id: doc.id,
                displayName: data.displayName || 'Unknown',
                handle: data.handle || '',
                photoURL: data.photoURL || ASSETS.DEFAULT_USER
            });
        });

        // Also search by display name
        const nameQuery = query(
            usersRef,
            where('displayName', '>=', cleanTerm),
            where('displayName', '<=', cleanTerm + '\uf8ff')
        );
        const nameSnapshot = await getDocs(nameQuery);

        nameSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (!results.has(doc.id)) {
                results.set(doc.id, {
                    id: doc.id,
                    displayName: data.displayName || 'Unknown',
                    handle: data.handle || '',
                    photoURL: data.photoURL || ASSETS.DEFAULT_USER
                });
            }
        });

        return Array.from(results.values()).slice(0, 5);
    } catch (error) {
        console.error('Error searching users:', error);
        return [];
    }
}

// Toggle reply form visibility
async function toggleReplyForm(commentId, threadId) {
    const replyForm = document.getElementById(`reply-form-${commentId}`);
    if (!replyForm) return;

    if (replyForm.style.display === 'none') {
        replyForm.style.display = 'block';
        replyForm.innerHTML = `
            <form id="reply-submit-${commentId}" style="display: flex; flex-direction: column; gap: 0.5rem;">
                <textarea style="width: 100%; background: var(--color-surface-3); border: 1px solid var(--color-accent-dark); border-radius: 0.375rem; padding: 0.5rem; color: var(--color-text); resize: vertical; min-height: 60px; font-family: inherit;" placeholder="Write a reply..." required></textarea>
                <div style="display: flex; justify-content: flex-end; gap: 0.5rem;">
                    <button type="button" onclick="document.getElementById('reply-form-${commentId}').style.display = 'none';" style="background: var(--color-surface-3); border: 1px solid var(--color-accent-dark); color: var(--color-text); padding: 0.5rem 1rem; border-radius: 0.375rem; cursor: pointer;">Cancel</button>
                    <button type="submit" style="background: var(--color-accent); color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.375rem; cursor: pointer; font-weight: 500;">Reply</button>
                </div>
            </form>
        `;

        document.getElementById(`reply-submit-${commentId}`).onsubmit = async (e) => {
            e.preventDefault();
            const textarea = e.target.querySelector('textarea');
            const replyContent = textarea.value.trim();
            if (!replyContent) return;

            try {
                // Create reply as a nested comment
                const replyData = {
                    content: replyContent,
                    threadId,
                    parentCommentId: commentId,
                    authorId: auth.currentUser.uid,
                    authorName: auth.currentUser.displayName || 'Anonymous',
                    authorPhoto: auth.currentUser.photoURL || ASSETS.DEFAULT_USER,
                    createdAt: serverTimestamp(),
                    reactions: {}
                };

                const submissionsRef = collection(db, COLLECTIONS.FORMS, threadId, COLLECTIONS.SUBMISSIONS);
                await addDoc(submissionsRef, replyData);

                // Update parent comment reply count
                const parentRef = doc(db, COLLECTIONS.FORMS, threadId, COLLECTIONS.SUBMISSIONS, commentId);
                await updateDoc(parentRef, {
                    replyCount: increment(1)
                });

                replyForm.style.display = 'none';
                showMessageBox('Reply posted successfully');

                // Reload thread to show new reply
                const modal = document.querySelector('.modal');
                if (modal) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    openThread(threadId);
                }
            } catch (error) {
                console.error('Error posting reply:', error);
                showMessageBox('Failed to post reply', true);
            }
        };
    } else {
        replyForm.style.display = 'none';
    }
}

// Add reaction to comment
async function addCommentReaction(commentId, threadId, reaction) {
    if (!auth.currentUser) {
        showMessageBox('Please sign in to react', true);
        return;
    }

    try {
        const commentRef = doc(db, COLLECTIONS.FORMS, threadId, COLLECTIONS.SUBMISSIONS, commentId);
        const commentDoc = await getDoc(commentRef);

        if (!commentDoc.exists()) return;

        const currentReactions = commentDoc.data().reactions || {};
        const reactionKey = `${reaction}_${auth.currentUser.uid}`;

        if (currentReactions[reactionKey]) {
            // Remove reaction
            delete currentReactions[reactionKey];
        } else {
            // Add reaction
            currentReactions[reactionKey] = true;
        }

        await updateDoc(commentRef, {reactions: currentReactions});

        // Reload to show updated reaction count
        const modal = document.querySelector('.modal');
        if (modal) {
            openThread(threadId);
        }
    } catch (error) {
        console.error('Error adding reaction:', error);
    }
}

// Add reaction to thread
async function addThreadReaction(threadId, reaction) {
    if (!auth.currentUser) {
        showMessageBox('Please sign in to react', true);
        return;
    }

    try {
        const threadRef = doc(db, COLLECTIONS.FORMS, threadId);
        const threadDoc = await getDoc(threadRef);

        if (!threadDoc.exists()) return;

        const currentReactions = threadDoc.data().reactions || {};
        const reactionKey = `${reaction}_${auth.currentUser.uid}`;

        if (currentReactions[reactionKey]) {
            // Remove reaction
            delete currentReactions[reactionKey];
        } else {
            // Add reaction
            currentReactions[reactionKey] = true;
        }

        await updateDoc(threadRef, {reactions: currentReactions});

        // Reload to show updated reaction count
        openThread(threadId);
    } catch (error) {
        console.error('Error adding reaction:', error);
    }
}

// Export functions
export {initForms, initDMs};