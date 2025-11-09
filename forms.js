import {auth, COLLECTIONS, db} from "./firebase-init.js";
import {showMessageBox} from "./utils.js";
import {googleSignIn} from './auth-manager.js';
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
let unsubscribeMessages = null;
let currentDmId;
let currentPhotoURL = ASSETS.DEFAULT_USER;
let currentImageURL;
let currentThreadId;
let photoURL = ASSETS.DEFAULT_USER;

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

async function initForms() {
    const threadsList = document.getElementById('forms-list');
    if (!threadsList) return;

    try {
        threadsList.innerHTML = '<div class="loading-spinner"></div>';
        await createSampleFormsIfNeeded();

        const threadsRef = collection(db, COLLECTIONS.FORMS);
        const threadsQuery = query(threadsRef, orderBy('pinned', 'desc'), orderBy('createdAt', 'desc'));
        const threads = await getDocs(threadsQuery);

        threadsList.innerHTML = threads.empty ?
            '<div class="empty-state">No threads available</div>' :
            `<div class="threads-list">${threads.docs.map(doc => createThreadCard(doc)).join('')}</div>`;

        threadsList.querySelector('.threads-list')?.addEventListener('click', (e) => {
            const card = e.target.closest('.thread-card');
            if (card && card.dataset.threadId) {
                openThread(card.dataset.threadId);
            }
        });
    } catch (error) {
        console.error('Error loading threads:', error);
        threadsList.innerHTML = '<div class="error-state">Failed to load threads</div>';
    }
}

function createThreadCard(doc) {
    const thread = doc.data();
    const date = thread.createdAt?.toDate().toLocaleDateString() || 'Unknown';
    const time = thread.createdAt?.toDate().toLocaleTimeString() || '';

    const categoryEmojis = {
        'announcements': '📢',
        'gaming': '🎮',
        'discussion': '💬',
        'support': '🤝',
        'feedback': '💡',
        'default': '📝'
    };

    const emoji = categoryEmojis[thread.category] || categoryEmojis.default;

    return `<div class="thread-card" data-thread-id="${doc.id}">
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
            <span title="${date} ${time}" style="font-size: 0.75rem;">${formatTimeAgo(thread.createdAt?.toDate())}</span>
            <div style="display: flex; gap: 0.75rem;">
                <span style="display: inline-flex; align-items: center; gap: 0.25rem;">👍 <span style="font-weight: 500;">${thread.upvotes || 0}</span></span>
                <span style="display: inline-flex; align-items: center; gap: 0.25rem;">💬 <span style="font-weight: 500;">${thread.commentCount || 0}</span></span>
            </div>
        </div>
    </div>`;
}

function formatTimeAgo(date) {
    if (!date) return 'sometime ago';
    const seconds = Math.floor((Date.now() - date) / 1000);
    const intervals = {year: 31536000, month: 2592000, week: 604800, day: 86400, hour: 3600, minute: 60};
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
            <div class="form-field"><label>Title</label><input type="text" id="thread-title" class="form-input w-full" placeholder="What's on your mind?" required></div>
            <div class="form-field"><label>Description</label><textarea id="thread-description" class="form-input w-full" rows="4" placeholder="Share your thoughts..." required></textarea></div>
            <div class="form-field"><label>Category</label><select id="thread-category" class="form-input w-full" required><option value="">Select a category...</option><option value="announcements">Announcements</option><option value="gaming">Gaming</option><option value="discussion">Discussion</option><option value="support">Support</option><option value="feedback">Feedback</option></select></div>
            <div class="form-field"><label>Tags (comma-separated)</label><input type="text" id="thread-tags" class="form-input w-full" placeholder="gaming, multiplayer, etc"></div>
            <div class="flex justify-end gap-2 mt-6"><button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button><button type="submit" class="btn-primary">Create Thread</button></div>
        </form>
    `;

    const form = modal.querySelector('#new-thread-form');
    form.onsubmit = async (e) => {
        e.preventDefault();
        const title = form.querySelector('#thread-title').value.trim();
        const description = form.querySelector('#thread-description').value.trim();
        const category = form.querySelector('#thread-category').value.trim();
        const tags = form.querySelector('#thread-tags').value.split(',').map(tag => tag.trim().toLowerCase()).filter(Boolean);

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
                        <span style="display: inline-block; background: var(--color-accent); color: white; padding: 0.25rem 0.75rem; border-radius: 0.375rem; font-size: 0.75rem; font-weight: 500;">${thread.category}</span>
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
                        ${commentsSnap.empty ? '<p style="text-align: center; color: var(--color-text-2); padding: 2rem 0;">No comments yet. Be the first to share your thoughts!</p>' : commentsSnap.docs.map(doc => createCommentElement(doc.id, doc.data(), threadId)).join('')}
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
                <img src="${comment.authorPhoto || ASSETS.DEFAULT_USER}" alt="Avatar" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; flex-shrink: 0;">
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

        const submissionsRef = collection(db, COLLECTIONS.FORMS, threadId, COLLECTIONS.SUBMISSIONS);
        await addDoc(submissionsRef, commentData);

        const threadRef = doc(db, COLLECTIONS.FORMS, threadId);
        await updateDoc(threadRef, {commentCount: increment(1)});

        textarea.value = '';
        showMessageBox('Comment posted successfully');

        await openThread(threadId);
    } catch (error) {
        console.error('Error posting comment:', error);
        showMessageBox('Failed to post comment', true);
    }
}

async function initDMs() {
    const dmList = document.getElementById('dm-list');
    const messageForm = document.getElementById('message-form');
    const messagesContainer = document.getElementById('messages-container');

    if (!dmList) return;

    try {
        dmList.innerHTML = '<div class="loading-spinner"></div>';
        if (messagesContainer) {
            messagesContainer.innerHTML = '<div class="text-center p-4 text-gray-500">Select a conversation or start a new one</div>';
        }

        if (!auth.currentUser) {
            dmList.innerHTML = '<div class="text-center p-4"><p>Please <a href="#" onclick="window.showSignIn()" class="text-accent">sign in</a> to view messages</p></div>';
            if (messageForm) messageForm.style.display = 'none';
            return;
        }

        dmList.innerHTML = `
            <div class="p-4 border-b border-surface-2">
                <button onclick="window.showNewDmModal()" class="btn-primary" style="width:100%; max-width:100%;">Start New Conversation</button>
            </div>
            <div id="dm-list-content" class="overflow-y-auto"><div class="loading-spinner"></div></div>
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
                dmListContent.innerHTML = '<div class="empty-state p-4 text-center"><p>No conversations yet</p><p class="text-sm text-gray-500 mt-2">Click "Start New Conversation" to begin chatting</p></div>';
                return;
            }

            const dmsHTML = await Promise.all(snapshot.docs.map(createDmElement));
            dmListContent.innerHTML = dmsHTML.join('');

            dmListContent.querySelectorAll('.dm-item').forEach(item => {
                item.addEventListener('click', () => {
                    const id = item.dataset.dmId;
                    if (id) openDm(id);
                });
            });

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
    const participantsProfiles = await Promise.all((dm.participants || []).filter(uid => uid !== auth.currentUser?.uid).map(getUserProfile));
    const profilesText = participantsProfiles.map(p => p?.displayName || 'Unknown User').join(', ');
    let avatarImage = ASSETS.DEFAULT_USER;
    if (dm.image) avatarImage = dm.image;
    else if (participantsProfiles && participantsProfiles.length > 0 && participantsProfiles[0]) avatarImage = participantsProfiles[0].photoURL || ASSETS.DEFAULT_USER;

    return `<div class="dm-item ${currentDmId === doc.id ? 'active' : ''}" data-dm-id="${doc.id}"><div class="flex items-center gap-3"><img src="${avatarImage}" alt="Avatar" class="w-10 h-10 rounded-full object-cover"><div class="flex-1 min-w-0"><div class="font-medium">${dm.name || profilesText}</div><div class="text-sm opacity-75 truncate">${dm.lastMessage || 'No messages'}</div><div class="text-xs opacity-50">${dm.lastMessageAt?.toDate().toLocaleString() || ''}</div></div></div></div>`;
}

async function openDm(dmId) {
    const modal = createModal('');
    document.body.appendChild(modal);

    try {
        const dmDoc = await getDoc(doc(db, COLLECTIONS.DMS(auth.currentUser.uid), dmId));
        if (!dmDoc.exists()) {
            modal.querySelector('.modal-body').innerHTML = '<p class="error">Conversation not found</p>';
            return;
        }

        const dm = dmDoc.data();
        const participantsProfiles = await Promise.all((dm.participants || []).filter(uid => uid !== auth.currentUser?.uid).map(getUserProfile));
        const profilesText = participantsProfiles.map(p => p?.displayName || 'Unknown User').join(', ');
        let avatarImage = ASSETS.DEFAULT_USER;
        if (dm.image) avatarImage = dm.image;
        else if (participantsProfiles && participantsProfiles.length > 0 && participantsProfiles[0]) avatarImage = participantsProfiles[0].photoURL || ASSETS.DEFAULT_USER;

        modal.querySelector('.modal-body').innerHTML = `
            <div class="dm-view" style="max-height: 600px; overflow-y: auto;">
                <div class="dm-header mb-6 pb-6 border-b border-accent-dark">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <img src="${avatarImage}" alt="Avatar" class="w-12 h-12 rounded-full object-cover">
                        <div style="flex: 1;">
                            <h2 style="margin: 0; font-size: 1.5rem; font-weight: 700;">${dm.name || profilesText}</h2>
                            <div style="font-size: 0.875rem; color: var(--color-text-2);">${dm.participants?.length > 2 ? `${dm.participants.length} members` : profilesText}</div>
                        </div>
                    </div>
                </div>

                <div class="messages-container" id="messages-container-${dmId}" style="max-height: 400px; overflow-y: auto;"><div class="loading-spinner"></div></div>

                ${auth.currentUser ? `
                    <form id="message-form" class="message-form mt-4" style="display: flex; gap: 0.5rem;">
                        <input type="text" class="form-input w-full" placeholder="Type a message..." required>
                        <button type="submit" class="btn-primary">Send</button>
                    </form>
                ` : `
                    <div style="background: var(--color-surface-2); padding: 1rem; border-radius: 0.375rem; text-align: center;">
                        <p>Please <a href="#" onclick="window.showSignIn()" class="text-accent">sign in</a> to send messages</p>
                    </div>
                `}
            </div>
        `;

        const messagesContainer = modal.querySelector(`#messages-container-${dmId}`);
        const messageForm = modal.querySelector('#message-form');

        if (unsubscribeMessages) {
            unsubscribeMessages();
            unsubscribeMessages = null;
        }

        const messagesRef = collection(db, COLLECTIONS.MESSAGES(auth.currentUser.uid, dmId));
        const q = query(messagesRef, orderBy('createdAt', 'asc'));

        unsubscribeMessages = onSnapshot(q, snapshot => {
            if (snapshot.empty) {
                messagesContainer.innerHTML = '<div class="text-center p-4 text-gray-500">No messages yet</div>';
                return;
            }

            messagesContainer.innerHTML = snapshot.docs.map(d => {
                const m = d.data();
                const isMine = (m.sender === auth.currentUser?.uid);
                return `<div class="message ${isMine ? 'mine' : ''}" style="display:flex; gap:0.5rem; align-items:flex-start; margin-bottom:0.75rem;">
                    <img src="${m.photoURL || ASSETS.DEFAULT_USER}" alt="" style="width:36px;height:36px;min-width:36px;min-height:36px;max-width:36px;max-height:36px;border-radius:50%;object-fit:cover;flex-shrink:0;">
                    <div style="background:${isMine ? 'var(--color-accent)' : 'var(--color-surface-2)'}; color:${isMine ? 'white' : 'var(--color-text)'}; padding:0.5rem 0.75rem; border-radius:0.5rem; max-width:80%;">
                        <div style="font-size:0.85rem; font-weight:600;">${m.sender === auth.currentUser.uid ? 'You' : (m.sender || 'User')}</div>
                        <div style="margin-top:0.25rem; white-space:pre-wrap;">${escapeHtml(m.content)}</div>
                        <div style="font-size:0.7rem; opacity:0.7; margin-top:0.25rem;">${m.createdAt ? formatTimeAgo(m.createdAt.toDate()) : ''}</div>
                    </div>
                </div>`;
            }).join('');

            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, err => {
            console.error('Error listening to messages:', err);
            messagesContainer.innerHTML = '<div class="error-state">Failed to load messages</div>';
        });

        if (messageForm) {
            messageForm.style.display = 'flex';
            messageForm.onsubmit = handleMessageSubmit;
        }
    } catch (error) {
        console.error('Error opening DM:', error);
        modal.querySelector('.modal-body').innerHTML = '<div class="error-state">Failed to open conversation</div>';
    }
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
            <div class="modal-body"><div class="loading-spinner"></div></div>
        </div>
    `;

    modal.querySelector('.modal-close-btn').addEventListener('click', closeModal);

    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    return modal;
}

async function getUserProfile(uid) {
    if (!uid) return {displayName: 'Unknown User', photoURL: ASSETS.DEFAULT_USER};
    try {
        const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, uid));
        const profile = userDoc.exists() ? userDoc.data() : {
            displayName: 'Unknown User',
            photoURL: ASSETS.DEFAULT_USER
        };
        if (profile.photoURL) {
            photoURL = profile.photoURL;
            currentPhotoURL = profile.photoURL;
        }
        return profile;
    } catch (error) {
        console.error('Error getting user profile:', error);
        return {displayName: 'Unknown User', photoURL: ASSETS.DEFAULT_USER};
    }
}

function escapeHtml(unsafe) {
    return String(unsafe ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

async function resolveUserHandles(handles) {
    const userIds = new Set();
    for (const handle of handles) {
        if (!handle) continue;
        const clean = handle.replace('@', '').trim();
        try {
            const usersRef = collection(db, COLLECTIONS.USERS);
            const q1 = query(usersRef, where('handle', '==', clean));
            const snap1 = await getDocs(q1);
            if (!snap1.empty) {
                snap1.docs.forEach(d => userIds.add(d.id));
                continue;
            }
            const q2 = query(usersRef, where('displayName', '==', clean));
            const snap2 = await getDocs(q2);
            if (!snap2.empty) snap2.docs.forEach(d => userIds.add(d.id));
        } catch (err) {
            console.error('Error resolving handle', handle, err);
        }
    }
    return Array.from(userIds);
}

async function searchUsers(searchTerm) {
    if (!searchTerm || searchTerm.length < 1) return [];
    try {
        const usersRef = collection(db, COLLECTIONS.USERS);
        const term = searchTerm.toLowerCase();
        const results = new Map();
        const qHandle = query(usersRef, where('handle', '>=', term), where('handle', '<=', term + '\uf8ff'));
        const snapHandle = await getDocs(qHandle);
        snapHandle.docs.forEach(d => {
            const data = d.data();
            results.set(d.id, {
                id: d.id,
                displayName: data.displayName || 'Unknown',
                handle: data.handle || '',
                photoURL: data.photoURL || ASSETS.DEFAULT_USER
            });
        });
        const qName = query(usersRef, where('displayName', '>=', term), where('displayName', '<=', term + '\uf8ff'));
        const snapName = await getDocs(qName);
        snapName.docs.forEach(d => {
            if (!results.has(d.id)) {
                const data = d.data();
                results.set(d.id, {
                    id: d.id,
                    displayName: data.displayName || 'Unknown',
                    handle: data.handle || '',
                    photoURL: data.photoURL || ASSETS.DEFAULT_USER
                });
            }
        });
        return Array.from(results.values()).slice(0, 8);
    } catch (err) {
        console.error('Error searching users', err);
        return [];
    }
}

async function toggleReplyForm(commentId, threadId) {
    const replyForm = document.getElementById(`reply-form-${commentId}`);
    if (!replyForm) return;
    if (replyForm.style.display === 'block') {
        replyForm.style.display = 'none';
        replyForm.innerHTML = '';
        return;
    }
    replyForm.style.display = 'block';
    replyForm.innerHTML = `
        <form id="reply-submit-${commentId}" style="display:flex; flex-direction:column; gap:0.5rem; margin-top:0.5rem;">
            <textarea required style="min-height:60px; padding:0.5rem; background:var(--color-surface-3); color:var(--color-text); border-radius:0.375rem; border:1px solid var(--color-accent-dark); width:100%;"></textarea>
            <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
                <button type="button" class="btn-secondary" style="padding:0.5rem 1rem; font-size:0.875rem;">Cancel</button>
                <button type="submit" class="btn-primary" style="padding:0.5rem 1rem; font-size:0.875rem;">Reply</button>
            </div>
        </form>
    `;
    const form = document.getElementById(`reply-submit-${commentId}`);
    form.querySelector('button[type="button"]').addEventListener('click', () => {
        replyForm.style.display = 'none';
        replyForm.innerHTML = '';
    });
    form.onsubmit = async (e) => {
        e.preventDefault();
        if (!auth.currentUser) {
            showMessageBox('Please sign in to reply', true);
            return;
        }
        const textarea = form.querySelector('textarea');
        const content = textarea.value.trim();
        if (!content) return;
        try {
            const replyData = {
                content,
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
            const parentRef = doc(db, COLLECTIONS.FORMS, threadId, COLLECTIONS.SUBMISSIONS, commentId);
            await updateDoc(parentRef, {replyCount: increment(1)});
            showMessageBox('Reply posted');
            replyForm.style.display = 'none';
            replyForm.innerHTML = '';
            await openThread(threadId);
        } catch (err) {
            console.error('Error posting reply', err);
            showMessageBox('Failed to post reply', true);
        }
    };
}

async function addCommentReaction(commentId, threadId, reaction) {
    if (!auth.currentUser) {
        showMessageBox('Please sign in to react', true);
        return;
    }
    try {
        const commentRef = doc(db, COLLECTIONS.FORMS, threadId, COLLECTIONS.SUBMISSIONS, commentId);
        const commentSnap = await getDoc(commentRef);
        if (!commentSnap.exists()) return;
        const data = commentSnap.data();
        const reactions = data.reactions || {};
        const key = `${reaction}_${auth.currentUser.uid}`;
        if (reactions[key]) delete reactions[key]; else reactions[key] = true;
        await updateDoc(commentRef, {reactions});
        if (document.querySelector('.modal')) await openThread(threadId);
    } catch (err) {
        console.error('Error reacting to comment', err);
    }
}

async function addThreadReaction(threadId, reaction) {
    if (!auth.currentUser) {
        showMessageBox('Please sign in to react', true);
        return;
    }
    try {
        const threadRef = doc(db, COLLECTIONS.FORMS, threadId);
        const threadSnap = await getDoc(threadRef);
        if (!threadSnap.exists()) return;
        const data = threadSnap.data();
        const reactions = data.reactions || {};
        const key = `${reaction}_${auth.currentUser.uid}`;
        if (reactions[key]) delete reactions[key]; else reactions[key] = true;
        await updateDoc(threadRef, {reactions});
        await openThread(threadId);
    } catch (err) {
        console.error('Error reacting to thread', err);
    }
}

async function updateProfilePhoto(url) {
    if (!auth.currentUser) return;
    try {
        await updateProfile(auth.currentUser, {photoURL: url});
        await setDoc(doc(db, COLLECTIONS.USERS, auth.currentUser.uid), {photoURL: url}, {merge: true});
        currentPhotoURL = url;
        photoURL = url;
        showMessageBox('Profile photo updated');
    } catch (err) {
        console.error('Error updating profile photo', err);
        showMessageBox('Failed to update profile photo', true);
    }
}

async function updateDmImage(dmId, url) {
    if (!auth.currentUser || !dmId) return;
    try {
        const dmRef = doc(db, COLLECTIONS.DMS(auth.currentUser.uid), dmId);
        const dmSnap = await getDoc(dmRef);
        if (!dmSnap.exists()) return;
        const dm = dmSnap.data();
        await Promise.all((dm.participants || []).map(uid => setDoc(doc(db, COLLECTIONS.DMS(uid), dmId), {image: url}, {merge: true})));
        currentImageURL = url;
        showMessageBox('Conversation image updated');
    } catch (err) {
        console.error('Error updating DM image', err);
        showMessageBox('Failed to update conversation image', true);
    }
}

function showSignIn() {
    const modal = createModal('Sign In');
    modal.querySelector('.modal-body').innerHTML = `
        <div class="p-4">
            <div class="text-center mb-4">
                <p>Please sign in to continue</p>
            </div>
            <div class="flex justify-center gap-4">
                <button id="google-signin-btn" class="btn-primary">Sign in with Google</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#google-signin-btn').addEventListener('click', async () => {
        try {
            await googleSignIn();
            modal.remove();
        } catch (err) {
            console.error('Google sign in failed', err);
            showMessageBox('Sign in failed', true);
        }
    });
}

async function showNewDmModal() {
    const modal = createModal('New Conversation');
    modal.querySelector('.modal-body').innerHTML = `
        <div class="modal-tabs">
            <button class="modal-tab active" data-tab="create-new">Create New</button>
            <button class="modal-tab" data-tab="search">Search Users</button>
        </div>
        <div id="create-new-tab" class="modal-tab-content active">
            <form id="new-dm-form" class="space-y-4">
                <div class="form-field">
                    <label>Recipients (comma-separated handles or names)</label>
                    <input type="text" id="dm-recipients" class="form-input w-full" placeholder="@user1, @user2" required>
                </div>
                <div class="form-field">
                    <label>Conversation Name (optional)</label>
                    <input type="text" id="dm-name" class="form-input w-full" placeholder="Group Chat Name">
                </div>
                <div class="form-field">
                    <label>Conversation Image (optional)</label>
                    <input type="url" id="dm-image" class="form-input w-full" placeholder="https://example.com/image.jpg">
                </div>
                <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:0.5rem;">
                    <button type="button" class="btn-secondary" style="padding:0.5rem 1rem;">Cancel</button>
                    <button type="submit" class="btn-primary" style="padding:0.5rem 1rem;">Create</button>
                </div>
            </form>
        </div>
        <div id="search-tab" class="modal-tab-content hidden">
            <div class="form-field mb-4">
                <input type="text" id="user-search-input" class="form-input w-full" placeholder="Search users...">
            </div>
            <div id="search-users-list" class="space-y-2"></div>
        </div>
    `;

    const tabs = modal.querySelectorAll('.modal-tab');
    const tabContents = modal.querySelectorAll('.modal-tab-content');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.add('hidden'));
            tab.classList.add('active');
            const id = tab.getAttribute('data-tab');
            modal.querySelector(`#${id}-tab`)?.classList.remove('hidden');
        });
    });

    const form = modal.querySelector('#new-dm-form');
    form.onsubmit = async (e) => {
        e.preventDefault();
        if (!auth.currentUser) {
            showMessageBox('Please sign in to create conversations', true);
            return;
        }
        const recipientsRaw = form.querySelector('#dm-recipients').value;
        const name = form.querySelector('#dm-name').value.trim();
        const image = form.querySelector('#dm-image').value.trim();
        const handles = recipientsRaw.split(',').map(s => s.trim()).filter(Boolean);
        try {
            const userIds = await resolveUserHandles(handles);
            if (!userIds.length) {
                showMessageBox('No valid recipients found', true);
                return;
            }
            const dmId = await createDmConversation(userIds, name, image);
            modal.remove();
            if (dmId) await openDm(dmId);
        } catch (err) {
            console.error('Error creating conversation', err);
            showMessageBox('Failed to create conversation', true);
        }
    };

    const searchInput = modal.querySelector('#user-search-input');
    const searchList = modal.querySelector('#search-users-list');
    if (searchInput) {
        let timer = null;
        searchInput.addEventListener('input', async (e) => {
            clearTimeout(timer);
            const term = e.target.value.trim();
            if (!term) {
                searchList.innerHTML = '';
                return;
            }
            timer = setTimeout(async () => {
                const results = await searchUsers(term);
                searchList.innerHTML = results.map(u => `<div class="user-search-item" data-uid="${u.id}"><img src="${u.photoURL}" alt="" style="width:28px;height:28px;border-radius:50%;margin-right:8px;"> ${u.displayName} <span style="opacity:0.6">@${u.handle}</span></div>`).join('');
                searchList.querySelectorAll('.user-search-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const uid = item.getAttribute('data-uid');
                        const handle = '@' + (RegExp(/@([a-zA-Z0-9_]+)/).exec(item.textContent)?.[1] || '');
                        const r = modal.querySelector('#dm-recipients');
                        r.value = r.value ? r.value + ', ' + handle : handle;
                    });
                });
            }, 300);
        });
    }

    document.body.appendChild(modal);
}

async function createDmConversation(userIds = [], name = '', image = '') {
    if (!auth.currentUser) throw new Error('Not signed in');
    try {
        const participants = Array.from(new Set([auth.currentUser.uid, ...(userIds || [])]));
        const dmData = {
            participants,
            name: name || null,
            image: image || null,
            createdAt: serverTimestamp(),
            lastMessage: '',
            lastMessageAt: serverTimestamp(),
            lastMessageSender: null
        };

        const dmRef = await addDoc(collection(db, COLLECTIONS.DMS(auth.currentUser.uid)), dmData);
        const dmId = dmRef.id;

        await Promise.all(participants.map(async (uid) => {
            try {
                await setDoc(doc(db, COLLECTIONS.DMS(uid), dmId), dmData, {merge: true});
            } catch (err) {
                console.error('Error creating DM for user', uid, err);
            }
        }));

        return dmId;
    } catch (err) {
        console.error('Error creating DM conversation', err);
        throw err;
    }
}

async function handleMessageSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const input = form.querySelector('input[type="text"]');
    if (!input) return;
    const content = input.value.trim();
    if (!content) return;

    try {
        if (!auth.currentUser) {
            showMessageBox('Please sign in to send messages', true);
            return;
        }

        const modal = form.closest('.modal');
        const messagesContainer = modal?.querySelector('[id^="messages-container-"]');
        const dmId = messagesContainer?.id?.replace('messages-container-', '') || currentDmId;
        if (!dmId) {
            showMessageBox('Conversation not found', true);
            return;
        }

        const senderPhotoURL = auth.currentUser.photoURL || currentPhotoURL || ASSETS.DEFAULT_USER;

        const messageData = {
            content,
            sender: auth.currentUser.uid,
            createdAt: serverTimestamp(),
            photoURL: senderPhotoURL
        };

        const dmRefForUser = doc(db, COLLECTIONS.DMS(auth.currentUser.uid), dmId);
        const dmSnap = await getDoc(dmRefForUser);
        if (!dmSnap.exists()) {
            showMessageBox('Conversation not found', true);
            return;
        }
        const dm = dmSnap.data();
        const participants = dm.participants || [];

        await Promise.all(participants.map(async (participantId) => {
            const messagesRef = collection(db, COLLECTIONS.MESSAGES(participantId, dmId));
            await addDoc(messagesRef, messageData);

            const participantDmRef = doc(db, COLLECTIONS.DMS(participantId), dmId);
            await updateDoc(participantDmRef, {
                lastMessage: content,
                lastMessageAt: serverTimestamp(),
                lastMessageSender: auth.currentUser.uid,
                lastMessageSenderPhoto: senderPhotoURL
            });
        }));

        input.value = '';
    } catch (err) {
        console.error('Error sending message:', err);
        showMessageBox('Failed to send message', true);
    }
}

Object.assign(globalThis, {
    openThread,
    showNewThreadModal,
    openDm,
    showSignIn,
    showNewDmModal,
    handleMessageSubmit,
    handleGoogleSignIn: async () => {
        try {
            await googleSignIn();
        } catch (err) {
            console.error('Google sign-in failed:', err);
            showMessageBox(err?.message || 'Google sign-in failed', true);
        }
    },
    updateProfilePhoto,
    updateDmImage,
    photoURL,
    toggleReplyForm,
    addCommentReaction,
    addThreadReaction,
    searchUsers,
    resolveUserHandles,
    initForms,
    initDMs,
    createDmConversation
});

export {initForms, initDMs};