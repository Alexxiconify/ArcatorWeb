import {
    auth,
    collection,
    COLLECTIONS,
    db,
    getDocs,
    getUserProfileFromFirestore,
    limit,
    query,
    where
} from './firebase-init.js';
import {dmsManager} from './dms-manager.js';
import {showMessageBox} from './utils.js';

let currentDmId = null;
let messagesUnsubscribe = null;
let selectedRecipients = new Map();

// Cache DM participant profiles to avoid repeated fetches
const profileCache = new Map();

async function getParticipantProfile(userId) {
    if (profileCache.has(userId)) {
        return profileCache.get(userId);
    }
    const profile = await getUserProfileFromFirestore(userId);
    if (profile) {
        profileCache.set(userId, profile);
    }
    return profile;
}

async function loadDMs() {
    const dmList = document.getElementById('dm-list');
    if (!dmList) return;

    const dms = await dmsManager.loadUserDMs();

    if (dms.length === 0) {
        dmList.innerHTML = '<div class="text-center text-text-2 p-4">No conversations yet</div>';
        return;
    }

    // Load participant profiles for each DM
    const dmsWithProfiles = await Promise.all(dms.map(async (dm) => {
        const profiles = await Promise.all(
            dm.participants.filter(id => id !== auth.currentUser.uid)
                .map(id => getUserProfileFromFirestore(id))
        );
        return {...dm, profiles};
    }));

    dmList.innerHTML = dmsWithProfiles.map(dm => `
        <div class="dm-item p-4 border-b border-accent-dark cursor-pointer hover:bg-surface-2" 
             data-dm-id="${dm.id}">
            <div class="flex justify-between items-center">
                <div class="flex items-center gap-2">
                    <div class="flex -space-x-2">
                        ${dm.profiles.map(profile => `
                            <img src="${profile?.photoURL || './defaultuser.png'}" 
                                 alt="${profile?.displayName || 'User'}"
                                 class="w-8 h-8 rounded-full border-2 border-accent object-cover"
                                 title="${profile?.displayName || 'User'}">
                        `).join('')}
                    </div>
                    <div class="flex flex-col ml-2">
                        <span class="font-medium text-text">
                            ${dm.profiles.map(p => p?.displayName || 'User').join(', ')}
                        </span>
                        <span class="text-sm text-text-2">${dm.lastMessage || 'Start a conversation'}</span>
                    </div>
                </div>
                <span class="text-xs text-text-3">
                    ${dm.lastMessageAt ? new Date(dm.lastMessageAt.toDate()).toLocaleString() : ''}
                </span>
            </div>
        </div>
    `).join('');

    // Add click listeners
    dmList.querySelectorAll('.dm-item').forEach(item => {
        item.addEventListener('click', () => loadMessages(item.dataset.dmId));
    });
}

async function loadMessages(dmId) {
    const messagesContainer = document.getElementById('messages-container');
    if (!messagesContainer || !dmId) return;

    if (messagesUnsubscribe) {
        messagesUnsubscribe();
        messagesUnsubscribe = null;
    }

    currentDmId = dmId;
    messagesContainer.innerHTML = '<div class="text-center p-4">Loading messages...</div>';

    // Show participant list
    const dm = await dmsManager.getDM(dmId);
    if (dm) {
        await updateParticipantList(dm.participants);
    }

    try {
        messagesUnsubscribe = dmsManager.subscribeToMessages(dmId, async (messages) => {
            if (messages.length === 0) {
                messagesContainer.innerHTML = '<div class="text-center text-text-2 p-4">No messages yet</div>';
                return;
            }

            // Get all unique sender profiles using cache
            const senderProfiles = new Map();
            await Promise.all(
                [...new Set(messages.map(m => m.sender))].map(async (senderId) => {
                    const profile = await getParticipantProfile(senderId);
                    senderProfiles.set(senderId, profile);
                })
            );

            messagesContainer.innerHTML = messages.map(msg => {
                const isCurrentUser = msg.sender === auth.currentUser.uid;
                const senderProfile = senderProfiles.get(msg.sender);
                const messageDate = msg.createdAt?.toDate?.() || new Date();

                return `
                    <div class="message ${isCurrentUser ? 'dm-bubble-out bg-accent ml-auto' : 'dm-bubble-in bg-surface-2'} mb-2">
                        <div class="flex items-start gap-2 ${isCurrentUser ? 'flex-row-reverse' : ''}">
                            <img src="${senderProfile?.photoURL || './defaultuser.png'}" 
                                 alt="${senderProfile?.displayName || 'User'}"
                                 class="w-6 h-6 rounded-full mt-1">
                            <div class="flex flex-col">
                                <div class="message-content break-words">
                                    ${msg.content}
                                </div>
                                <div class="text-xs text-text-3 mt-1 ${isCurrentUser ? 'text-right' : ''}">
                                    ${senderProfile?.displayName || 'User'} • 
                                    ${messageDate.toLocaleString()}
                                    ${msg.edited ? ' (edited)' : ''}
                                    ${isCurrentUser ? `
                                        <button class="ml-2 text-accent hover:text-accent-light"
                                                onclick="window.dmsActions.editMessage('${msg.id}', ${JSON.stringify(msg.content)})">
                                            Edit
                                        </button>
                                        <button class="ml-2 text-error hover:text-error-light"
                                                onclick="window.dmsActions.deleteMessage('${msg.id}')">
                                            Delete
                                        </button>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        });
    } catch (error) {
        console.error('Error loading messages:', error);
        showMessageBox('Failed to load messages', true);
        messagesContainer.innerHTML = '<div class="text-center text-error p-4">Failed to load messages</div>';
    }
}

async function updateParticipantList(participants) {
    const participantList = document.getElementById('participant-list');
    if (!participantList) return;

    const profiles = await Promise.all(
        participants.map(id => getUserProfileFromFirestore(id))
    );

    participantList.innerHTML = profiles.map(profile => `
        <div class="flex items-center gap-2 p-2">
            <img src="${profile?.photoURL || './defaultuser.png'}" 
                 alt="${profile?.displayName || 'User'}"
                 class="w-8 h-8 rounded-full object-cover">
            <span class="text-text">${profile?.displayName || 'User'}</span>
        </div>
    `).join('');
}

function setupMessageForm() {
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');

    if (!messageForm || !messageInput) return;

    messageForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const content = messageInput.value.trim();
        if (!content || !currentDmId) return;

        messageInput.value = '';

        try {
            await dmsManager.sendMessage(currentDmId, content);
        } catch (error) {
            console.error('Error sending message:', error);
            showMessageBox('Failed to send message', true);
        }
    });
}

function setupNewConversation() {
    const newChatBtn = document.getElementById('new-chat-btn');
    const recipientInput = document.getElementById('recipient-input');
    const suggestionsList = document.getElementById('recipient-suggestions');

    if (!newChatBtn || !recipientInput || !suggestionsList) return;

    let searchTimeout;

    recipientInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(async () => {
            const searchTerm = recipientInput.value.trim();
            if (!searchTerm) {
                suggestionsList.innerHTML = '';
                return;
            }

            try {
                const usersRef = collection(db, COLLECTIONS.USER_PROFILES);
                const q = query(
                    usersRef,
                    where('displayName', '>=', searchTerm),
                    where('displayName', '<=', searchTerm + '\uf8ff'),
                    limit(5)
                );

                const snapshot = await getDocs(q);
                const users = snapshot.docs
                    .map(doc => ({id: doc.id, ...doc.data()}))
                    .filter(user => user.id !== auth.currentUser.uid);

                suggestionsList.innerHTML = users.map(user => `
                    <div class="suggestion-item p-2 hover:bg-surface-2 cursor-pointer"
                         data-user-id="${user.id}">
                        <div class="flex items-center gap-2">
                            <img src="${user.photoURL || './defaultuser.png'}" 
                                 alt="${user.displayName}"
                                 class="w-8 h-8 rounded-full object-cover">
                            <span class="text-text">${user.displayName}</span>
                        </div>
                    </div>
                `).join('');

                suggestionsList.querySelectorAll('.suggestion-item').forEach(item => {
                    item.addEventListener('click', async () => {
                        const userId = item.dataset.userId;
                        const userProfile = await getParticipantProfile(userId);
                        if (userProfile) {
                            selectedRecipients.set(userId, userProfile);
                            updateSelectedRecipients();
                        }
                        recipientInput.value = '';
                        suggestionsList.innerHTML = '';
                    });
                });
            } catch (error) {
                console.error('Error searching users:', error);
                suggestionsList.innerHTML = '<div class="text-error p-2">Error searching users</div>';
            }
        }, 300);
    });

    newChatBtn.addEventListener('click', async () => {
        if (selectedRecipients.size === 0) {
            showMessageBox('Please select at least one recipient', true);
            return;
        }

        try {
            const dmId = await dmsManager.createDM([...selectedRecipients.keys()]);
            selectedRecipients.clear();
            updateSelectedRecipients();
            await loadMessages(dmId);
        } catch (error) {
            console.error('Error creating conversation:', error);
            showMessageBox('Failed to create conversation', true);
        }
    });
}

function updateSelectedRecipients() {
    const container = document.getElementById('selected-recipients');
    if (!container) return;

    container.innerHTML = Array.from(selectedRecipients.values())
        .map(profile => `
            <div class="flex items-center gap-2 bg-surface-2 rounded-full px-3 py-1">
                <img src="${profile.photoURL || './defaultuser.png'}" 
                     alt="${profile.displayName}"
                     class="w-6 h-6 rounded-full object-cover">
                <span class="text-text">${profile.displayName}</span>
                <button class="text-text-2 hover:text-error"
                        onclick="removeRecipient('${profile.id}')">×</button>
            </div>
        `).join('');
}

function removeRecipient(userId) {
    selectedRecipients.delete(userId);
    updateSelectedRecipients();
}

// DM action handlers exposed to window
const dmsActions = {
    async editMessage(messageId, content) {
        await showEditMessageModal(messageId, content);
    },

    async deleteMessage(messageId) {
        await handleDeleteMessage(messageId);
    },

    removeRecipient(userId) {
        selectedRecipients.delete(userId);
        updateSelectedRecipients();
    }
};

async function showEditMessageModal(messageId, content) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-surface p-6 rounded-lg shadow-xl max-w-md w-full">
            <h3 class="text-xl font-bold mb-4">Edit Message</h3>
            <form id="edit-message-form">
                <textarea id="edit-message-content" 
                         class="w-full p-2 bg-surface-2 border border-accent rounded resize-none"
                         rows="4">${content}</textarea>
                <div class="flex justify-end gap-2 mt-4">
                    <button type="button" class="btn-secondary" id="cancel-edit">Cancel</button>
                    <button type="submit" class="btn-primary">Save Changes</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    const form = modal.querySelector('form');
    const cancelBtn = modal.querySelector('#cancel-edit');

    cancelBtn.addEventListener('click', () => modal.remove());

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newContent = document.getElementById('edit-message-content').value.trim();

        if (!newContent) {
            showMessageBox('Message content cannot be empty', true);
            return;
        }

        try {
            await dmsManager.editMessage(currentDmId, messageId, newContent);
            modal.remove();
        } catch (error) {
            console.error('Error editing message:', error);
            showMessageBox('Failed to edit message', true);
        }
    });
}

async function handleDeleteMessage(messageId) {
    if (!confirm('Are you sure you want to delete this message?')) return;

    try {
        await dmsManager.deleteMessage(currentDmId, messageId);
    } catch (error) {
        console.error('Error deleting message:', error);
        showMessageBox('Failed to delete message', true);
    }
}

export async function initDMs() {
    if (!auth.currentUser) {
        window.location.href = './users.html';
        return;
    }

    try {
        await dmsManager.init();
        await loadDMs();
        setupMessageForm();
        setupNewConversation();

        // Expose necessary functions globally
        window.dmsActions = dmsActions;

        // Set up auto-scroll for new messages
        const messagesContainer = document.getElementById('messages-container');
        if (messagesContainer) {
            const observer = new MutationObserver(() => {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            });
            observer.observe(messagesContainer, {childList: true, subtree: true});
        }
    } catch (error) {
        console.error('Error initializing DMs:', error);
        showMessageBox('Failed to initialize DMs', true);
    }
}

// Cleanup on page unload
window.addEventListener('unload', () => {
    if (messagesUnsubscribe) {
        messagesUnsubscribe();
    }
    dmsManager.cleanup();
    profileCache.clear();
});