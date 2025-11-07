// admin-user-management.js
import {appId, auth, db, getUserProfileFromFirestore} from "./firebase-init.js";
import {showCustomConfirm, showMessageBox} from "./utils.js";
import {collection, deleteDoc, doc, onSnapshot, updateDoc} from "firebase/firestore";
import {getAvailableThemes} from "./themes.js";

// State management
let usersData = [];
let currentEditingUser = null;
let _usersUnsubscribe = null;

// DOM element cache
const elementCache = new Map();

function getElement(id) {
    if (!elementCache.has(id)) {
        const element = document.getElementById(id);
        if (element) elementCache.set(id, element);
        return element;
    }
    return elementCache.get(id);
}

function setDisplayValue(elementId, value, isCheckbox = false) {
    const element = getElement(elementId);
    if (element) {
        isCheckbox ? element.checked = !!value : element.value = value ?? '';
    }
}

async function isCurrentUserAdmin() {
    if (!auth.currentUser) return false;
    const userProfile = await getUserProfileFromFirestore(auth.currentUser.uid);
    return userProfile?.isAdmin === true;
}

// Main initialization
async function initializeAdmin() {
    try {
        await auth.authStateReady();
        const isAdmin = await isCurrentUserAdmin();
        if (!isAdmin) {
            toggleAdminUI(false);
            return;
        }

        toggleAdminUI(true);
        setupListeners();
        await startRealtimeUsersListener();
    } catch (error) {
        console.error("Admin initialization failed:", error);
        showMessageBox("Failed to initialize admin interface", true);
    }
}

function toggleAdminUI(show) {
    getElement("admin-content").style.display = show ? "block" : "none";
    getElement("login-required-message").style.display = show ? "none" : "block";
}

function setupListeners() {
    const saveBtn = getElement("save-user-changes-btn");
    const cancelBtn = getElement("cancel-user-changes-btn");

    if (saveBtn) {
        saveBtn.addEventListener('click', e => {
            e.preventDefault();
            withRetry(saveUserChanges);
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', e => {
            e.preventDefault();
            closeEditModal();
        });
    }
}

async function startRealtimeUsersListener() {
    if (!db) return;
    cleanup();

    try {
        const usersRef = collection(db, `artifacts/${appId}/public/data/user_profiles`);
        _usersUnsubscribe = onSnapshot(usersRef, handleUsersSnapshot, handleError);
    } catch (error) {
        handleError(error);
    }
}

function handleUsersSnapshot(snapshot) {
    usersData = snapshot.docs.map(doc => ({uid: doc.id, ...doc.data()}));
    renderUserList();
}

function handleError(error) {
    console.error("Operation failed:", error);
    showMessageBox(error.message, true);
}

function cleanup() {
    if (_usersUnsubscribe) {
        _usersUnsubscribe();
        _usersUnsubscribe = null;
    }
}

function renderUserList() {
    const tbody = getElement("user-list-tbody");
    if (!tbody) return;

    if (!usersData.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-text-secondary text-xs">No users found.</td></tr>';
        return;
    }

    tbody.innerHTML = usersData.map((user, idx) => `
        <tr class="hover:bg-table-row-even-bg transition-colors">
            <td class="px-2 py-1 text-text-primary text-xs font-mono">${user.uid.substring(0, 8)}...</td>
            <td class="px-2 py-1 text-text-primary text-xs">${user.displayName || "N/A"}</td>
            <td class="px-2 py-1 text-text-secondary text-xs">${user.email || "N/A"}</td>
            <td class="px-2 py-1 text-text-secondary text-xs">${user.themePreference || "dark"}</td>
            <td class="px-2 py-1 text-text-secondary text-xs">
                <div class="flex space-x-1">
                    <button data-action="edit" data-index="${idx}" class="text-link hover:text-link transition-colors admin-action-btn" title="Edit User">📝</button>
                    <button data-action="delete" data-index="${idx}" class="text-red-400 hover:text-red-300 transition-colors admin-action-btn" title="Delete Profile">❌</button>
                </div>
            </td>
        </tr>
    `).join("");

    attachRowListeners(tbody);
}

function attachRowListeners(tbody) {
    tbody.querySelectorAll('button[data-action]').forEach(btn => {
        const action = btn.dataset.action;
        const idx = Number(btn.dataset.index);
        const user = usersData[idx];

        btn.addEventListener('click', async () => {
            if (!user) return;
            if (action === 'edit') await openEditUserModal(user.uid, user);
            if (action === 'delete') await deleteUserProfile(user.uid, user.displayName);
        });
    });
}

async function openEditUserModal(uid, userData) {
    currentEditingUser = {uid, ...userData};

    // Populate form fields
    const fields = [
        ['display-name', 'displayName'],
        ['handle', 'handle'],
        ['email', 'email'],
        ['photo-url', 'photoURL'],
        ['discord-url', 'discordURL'],
        ['github-url', 'githubURL'],
        ['font-scaling', 'fontScaling', 'normal'],
        ['notification-frequency', 'notificationFrequency', 'immediate'],
        ['data-retention', 'dataRetention', '365'],
        ['keyboard-shortcuts', 'keyboardShortcuts', 'enabled'],
        ['custom-css', 'customCSS']
    ];

    const checkboxes = [
        'email-notifications',
        'discord-notifications',
        'push-notifications',
        'profile-visible',
        'activity-tracking',
        'third-party-sharing',
        'high-contrast',
        'reduced-motion',
        'screen-reader',
        'focus-indicators',
        'debug-mode'
    ];

    fields.forEach(([elementId, dataKey, defaultValue]) => {
        setDisplayValue(`edit-user-${elementId}`, userData[dataKey] ?? defaultValue);
    });

    checkboxes.forEach(key => {
        setDisplayValue(`edit-user-${key}`, userData[key], true);
    });

    await populateEditUserThemeSelect(userData.themePreference);

    const modal = getElement("edit-user-modal");
    if (modal) {
        modal.style.display = 'flex';
        modal.style.justifyContent = 'center';
        modal.style.alignItems = 'center';
    }
}

async function populateEditUserThemeSelect(selectedThemeId) {
    const select = getElement('edit-user-theme');
    if (!select) return;

    select.innerHTML = '';
    const themes = await getAvailableThemes();

    themes.forEach(theme => {
        const option = document.createElement('option');
        option.value = theme.id;
        option.textContent = theme.name;
        select.appendChild(option);
    });

    select.value = selectedThemeId || 'dark';
}

async function saveUserChanges() {
    if (!currentEditingUser) throw new Error("No user selected for editing.");

    const updatedData = {};
    const fields = ['displayName', 'handle', 'email', 'photoURL', 'discordURL', 'githubURL',
        'themePreference', 'fontScaling', 'notificationFrequency', 'dataRetention',
        'keyboardShortcuts', 'customCSS'];

    const checkboxes = ['emailNotifications', 'discordNotifications', 'pushNotifications',
        'profileVisible', 'activityTracking', 'thirdPartySharing', 'highContrast',
        'reducedMotion', 'screenReader', 'focusIndicators', 'debugMode'];

    fields.forEach(field => {
        const element = getElement(`edit-user-${field.toLowerCase()}`);
        if (element) updatedData[field] = element.value;
    });

    checkboxes.forEach(field => {
        const element = getElement(`edit-user-${field.toLowerCase()}`);
        if (element) updatedData[field] = element.checked;
    });

    updatedData.lastUpdated = new Date().toISOString();

    await updateDoc(
        doc(db, `artifacts/${appId}/public/data/user_profiles`, currentEditingUser.uid),
        updatedData
    );

    showMessageBox("User profile updated successfully!", false);
    closeEditModal();
}

async function deleteUserProfile(uid, displayName) {
    const confirmed = await showCustomConfirm(
        `Delete profile for ${displayName}?`,
        "This will permanently delete the user's profile data. This action cannot be undone."
    );

    if (confirmed) {
        await deleteDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, uid));
        showMessageBox("Profile deleted successfully", false);
    }
}

function closeEditModal() {
    const modal = getElement("edit-user-modal");
    if (modal) modal.style.display = 'none';
    currentEditingUser = null;
}

async function withRetry(operation, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            if (attempt === maxRetries) throw error;
            await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        }
    }
}

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAdmin);
} else {
    initializeAdmin().catch(handleError);
}

// Export necessary functions for global access
Object.assign(window, {
    openEditUserModal,
    deleteUserProfile,
    saveUserChanges,
    populateEditUserThemeSelect
});