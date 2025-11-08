import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import {auth, db} from "./firebase-init.js";
import {showMessageBox} from "./utils.js";
import {updateProfile} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

const COLLECTIONS = {
    FORMS: 'artifacts/forms',
    SUBMISSIONS: 'artifacts/submissions',
    USERS: 'artifacts/users',
    DMS: 'artifacts/dms'
};

const ASSETS = {
    DEFAULT_USER: './defaultuser.png',
    DEFAULT_HERO: './creativespawn.png'
};

let unsubscribeDMs;
let currentDmId;
let currentPhotoURL;
let currentImageURL;

// Form functionality
async function initForms() {
    const formsList = document.getElementById('forms-list');
    if (!formsList) return;

    try {
        formsList.innerHTML = '<div class="loading-spinner"></div>';
        const formsQuery = query(collection(db, COLLECTIONS.FORMS), orderBy('createdAt', 'desc'));
        const forms = await getDocs(formsQuery);

        formsList.innerHTML = forms.empty ?
            '<div class="empty-state">No forms available</div>' :
            forms.docs.map(doc => createFormCard(doc)).join('');
    } catch (error) {
        console.error('Error loading forms:', error);
        formsList.innerHTML = '<div class="error-state">Failed to load forms</div>';
    }
}

function createFormCard(doc) {
    const form = doc.data();
    return `
        <div class="form-card">
            <h3>${form.title || 'Untitled Form'}</h3>
            <p>${form.description || 'No description'}</p>
            <div class="flex justify-between items-center">
                <span class="text-sm opacity-75">
                    Created: ${form.createdAt?.toDate().toLocaleDateString() || 'Unknown'}
                </span>
                <button onclick="openForm('${doc.id}')" class="btn-primary">
                    ${auth.currentUser ? 'Open Form' : 'View Form'}
                </button>
            </div>
        </div>
    `;
}

async function openForm(formId) {
    const modal = createModal('Loading Form...');
    document.body.appendChild(modal);

    try {
        const formDoc = await getDoc(doc(db, COLLECTIONS.FORMS, formId));
        if (!formDoc.exists()) {
            modal.querySelector('.modal-content').innerHTML = '<p class="error">Form not found</p>';
            return;
        }

        const form = formDoc.data();
        modal.querySelector('.modal-content').innerHTML = auth.currentUser ?
            createFormContent(form, formId) :
            createViewOnlyContent(form);

        if (auth.currentUser) {
            modal.querySelector(`#form-${formId}`).addEventListener('submit', e => handleFormSubmit(e, formId));
        }
    } catch (error) {
        console.error('Error loading form:', error);
        modal.querySelector('.modal-content').innerHTML = '<p class="error">Failed to load form</p>';
    }
}

function createFormContent(form, formId) {
    return `
        <h2>${form.title || 'Untitled Form'}</h2>
        <p>${form.description || 'No description'}</p>
        <form id="form-${formId}" class="space-y-4">
            ${renderFormFields(form.fields || [])}
            <div class="flex justify-end gap-4">
                <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                <button type="submit" class="btn-primary">Submit</button>
            </div>
        </form>
    `;
}

function createViewOnlyContent(form) {
    return `
        <h2>${form.title || 'Untitled Form'}</h2>
        <p>${form.description || 'No description'}</p>
        <div class="bg-surface-2 p-4 rounded mt-4">
            <p class="text-center">Please <a href="#" onclick="window.showSignIn()" class="text-accent">sign in</a> to submit this form.</p>
        </div>
        <div class="flex justify-end mt-4">
            <button class="btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
        </div>
    `;
}

function renderFormFields(fields) {
    return fields.map(field => `
        <div class="form-field">
            <label>${field.label}${field.required ? '<span class="required">*</span>' : ''}</label>
            ${renderFormInput(field)}
        </div>
    `).join('');
}

function renderFormInput(field) {
    const baseProps = `name="${field.id}" ${field.required ? 'required' : ''} placeholder="${field.placeholder || ''}"`;

    switch (field.type) {
        case 'text':
        case 'email':
        case 'tel':
        case 'url':
            return `<input type="${field.type}" class="form-input" ${baseProps} ${field.pattern ? `pattern="${field.pattern}"` : ''}>`;
        case 'textarea':
            return `<textarea class="form-input" rows="4" ${baseProps}></textarea>`;
        case 'select':
            return `
                <select class="form-input" ${baseProps}>
                    <option value="">Select...</option>
                    ${(field.options || []).map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('')}
                </select>`;
        case 'checkbox':
        case 'radio':
            return `
                <div class="options-group">
                    ${(field.options || []).map(opt => `
                        <label class="option">
                            <input type="${field.type}" ${baseProps} value="${opt.value}">
                            <span>${opt.label}</span>
                        </label>
                    `).join('')}
                </div>`;
        default:
            return '<p class="error">Unsupported field type</p>';
    }
}

async function handleFormSubmit(event, formId) {
    event.preventDefault();
    if (!auth.currentUser) {
        showMessageBox('Please sign in to submit forms', true);
        return;
    }

    try {
        const formData = new FormData(event.target);
        await addDoc(collection(db, `${COLLECTIONS.FORMS}/${formId}/submissions`), {
            userId: auth.currentUser.uid,
            submittedAt: serverTimestamp(),
            responses: Object.fromEntries(formData)
        });

        showMessageBox('Form submitted successfully');
        event.target.closest('.modal').remove();
    } catch (error) {
        console.error('Error submitting form:', error);
        showMessageBox('Failed to submit form', true);
    }
}

// DM functionality
async function initDMs() {
    const dmList = document.getElementById('dm-list');
    if (!dmList) return;

    setupDmListeners();
    await loadDMs();
}

function setupDmListeners() {
    const createBtn = document.getElementById('new-chat-btn');
    const messageForm = document.getElementById('message-form');

    if (createBtn) {
        createBtn.onclick = () => {
            if (!auth.currentUser) {
                showMessageBox('Please sign in to create conversations', true);
                return;
            }
            showNewDmModal();
        };
    }

    if (messageForm) {
        messageForm.onsubmit = handleMessageSubmit;
    }
}

async function loadDMs() {
    const dmList = document.getElementById('dm-list');
    const messagesContainer = document.getElementById('messages-container');
    if (!dmList) return;

    try {
        dmList.innerHTML = '<div class="loading-spinner"></div>';

        if (!auth.currentUser) {
            dmList.innerHTML = '<div class="sign-in-prompt">Please sign in to view messages</div>';
            return;
        }

        const dmsRef = collection(db, `${COLLECTIONS.USERS}/${auth.currentUser.uid}/dms`);
        const q = query(dmsRef, orderBy('lastMessageAt', 'desc'));

        unsubscribeDMs?.();
        unsubscribeDMs = onSnapshot(q, async snapshot => {
            if (snapshot.empty) {
                dmList.innerHTML = '<div class="empty-state">No conversations yet</div>';
                if (messagesContainer) messagesContainer.style.display = 'none';
                return;
            }

            const dmsHTML = await Promise.all(snapshot.docs.map(createDmElement));
            dmList.innerHTML = dmsHTML.join('');

            if (!currentDmId && snapshot.docs.length) {
                await openDm(snapshot.docs[0].id);
            }
        });
    } catch (error) {
        console.error('Error loading DMs:', error);
        dmList.innerHTML = '<div class="error-state">Failed to load conversations</div>';
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
        .map(p => p.displayName || 'Unknown User')
        .join(', ');

    return `
        <div class="dm-item ${currentDmId === doc.id ? 'active' : ''}" 
             onclick="openDm('${doc.id}')">
            <div class="flex items-center gap-3">
                <img src="${dm.image || participantsProfiles[0]?.photoURL || ASSETS.DEFAULT_USER}" 
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
        return userDoc.exists() ? userDoc.data() : {
            displayName: 'Unknown User',
            photoURL: ASSETS.DEFAULT_USER
        };
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
        const messageData = {
            content,
            sender: auth.currentUser.uid,
            createdAt: serverTimestamp(),
            photoURL: currentPhotoURL || auth.currentUser.photoURL || ASSETS.DEFAULT_USER
        };

        const dmRef = doc(db, `${COLLECTIONS.USERS}/${auth.currentUser.uid}/dms`, currentDmId);
        const dmDoc = await getDoc(dmRef);

        if (!dmDoc.exists()) {
            showMessageBox('Conversation not found', true);
            return;
        }

        const dm = dmDoc.data();

        // Send message to all participants
        await Promise.all(dm.participants.map(async participantId => {
            const messagesRef = collection(db, `${COLLECTIONS.USERS}/${participantId}/dms/${currentDmId}/messages`);
            await addDoc(messagesRef, messageData);

            await updateDoc(doc(db, `${COLLECTIONS.USERS}/${participantId}/dms`, currentDmId), {
                lastMessage: content,
                lastMessageAt: serverTimestamp(),
                lastMessageSender: auth.currentUser.uid,
                lastMessageSenderPhoto: messageData.photoURL
            });
        }));

    } catch (error) {
        console.error('Error sending message:', error);
        showMessageBox('Failed to send message', true);
        input.value = content; // Restore message on failure
    }
}

// Add this function to create a new DM conversation
async function createDmConversation(userIds, name = '', image = '') {
    if (!auth.currentUser || !userIds.length) return null;

    const allParticipants = [auth.currentUser.uid, ...userIds];
    const dmId = allParticipants.sort().join('_');

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
        setDoc(doc(db, `${COLLECTIONS.USERS}/${uid}/dms`, dmId), dmData)
    ));

    await openDm(dmId);
    return dmId;
}

// Add this function to update profile photo
async function updateProfilePhoto(url) {
    if (!auth.currentUser) return;

    try {
        currentPhotoURL = url;
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
        const dmRef = doc(db, `${COLLECTIONS.USERS}/${auth.currentUser.uid}/dms`, dmId);
        const dmDoc = await getDoc(dmRef);

        if (!dmDoc.exists()) return;

        const dm = dmDoc.data();
        await Promise.all(dm.participants.map(uid =>
            setDoc(doc(db, `${COLLECTIONS.USERS}/${uid}/dms`, dmId),
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
        if (!handle) continue;

        try {
            const usersRef = collection(db, COLLECTIONS.USERS);
            const cleanHandle = handle.replace('@', '').trim();
            const userQuery = query(usersRef, where('handle', '==', cleanHandle));
            const snapshot = await getDocs(userQuery);

            if (!snapshot.empty) {
                userIds.add(snapshot.docs[0].id);
            } else {
                // Try by display name if handle not found
                const nameQuery = query(usersRef, where('displayName', '==', cleanHandle));
                const nameSnapshot = await getDocs(nameQuery);
                if (!nameSnapshot.empty) {
                    userIds.add(nameSnapshot.docs[0].id);
                }
            }
        } catch (error) {
            console.error(`Error resolving handle ${handle}:`, error);
        }
    }
    return Array.from(userIds);
}

// Export functions
export {initForms, initDMs};

// Global exports
window.openForm = openForm;
window.openDm = openDm;
window.showSignIn = showSignIn;
window.handleGoogleSignIn = handleGoogleSignIn;
window.updateProfilePhoto = updateProfilePhoto;
window.updateDmImage = updateDmImage;