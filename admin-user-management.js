// admin-user-management.js

import {appId, collection, db, deleteDoc, doc, getDocs, onSnapshot, updateDoc} from "./firebase-init.js";

import {getAvailableThemes} from "./themes.js";
import {showCustomConfirm, showMessageBox} from "./utils.js";

// User Management DOM elements (queried lazily)
const editUserModal = () => document.getElementById("edit-user-modal");
const editUserThemeSelect = () => document.getElementById("edit-user-theme");
let saveUserChangesBtn = null;
let cancelUserChangesBtn = null;

// Global variables for user management
let usersData = [];
let currentEditingUser = null;

// Wire up button event handlers after DOM is ready
function wireUpButtons() {
    saveUserChangesBtn = document.getElementById("save-user-changes-btn");
    cancelUserChangesBtn = document.getElementById("cancel-user-changes-btn");

    if (saveUserChangesBtn) {
        saveUserChangesBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await saveUserChanges();
        });
    }
    if (cancelUserChangesBtn) {
        cancelUserChangesBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const modal = editUserModal();
            if (modal) modal.style.display = 'none';
            currentEditingUser = null;
        });
    }
}

export async function loadUsers() {
    if (!db) {
        console.error("Firestore DB not initialized for loadUsers.");
        showMessageBox("Database not ready.", true);
        return;
    }

    try {
        const usersRef = collection(
            db,
            `artifacts/${appId}/public/data/user_profiles`,
        );
        const querySnapshot = await getDocs(usersRef);
        usersData = [];
        querySnapshot.forEach((d) => {
            usersData.push({uid: d.id, ...d.data()});
        });

        await renderUserList();
    } catch (error) {
        console.error("Error loading users:", error);
        showMessageBox("Error loading users: " + error.message, true);
    }
}

/**
 * Renders the list of users in the table.
 */
async function renderUserList() {
    const tbody = document.getElementById("user-list-tbody");

    if (!tbody) {
        console.warn('renderUserList: #user-list-tbody not found in DOM, skipping render.');
        return;
    }

    if (!usersData || usersData.length === 0) {
        tbody.innerHTML = `
      <tr>
        <td class="text-center py-4 text-text-secondary text-xs" colspan="5">No users found.</td>
      </tr>
    `;
        return;
    }

    // Build rows with data-index attributes, attach listeners after inserting to DOM
    tbody.innerHTML = usersData
        .map((user, idx) => {
            const displayName = user.displayName || "N/A";
            const email = user.email || "N/A";
            const theme = user.themePreference || "dark";

            return `
      <tr class="hover:bg-table-row-even-bg transition-colors">
        <td class="px-2 py-1 text-text-primary text-xs font-mono">${user.uid.substring(0, 8)}...</td>
        <td class="px-2 py-1 text-text-primary text-xs">${displayName}</td>
        <td class="px-2 py-1 text-text-secondary text-xs">${email}</td>
        <td class="px-2 py-1 text-text-secondary text-xs">${theme}</td>
        <td class="px-2 py-1 text-text-secondary text-xs">
          <div class="flex space-x-1">
            <button data-action="edit" data-index="${idx}" class="text-link hover:text-link transition-colors admin-action-btn" title="Edit User">
              <svg class="w-4 h-4" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
              </svg>
            </button>
            <button data-action="delete" data-index="${idx}" class="text-red-400 hover:text-red-300 transition-colors admin-action-btn" title="Delete Profile">
              <svg class="w-4 h-4" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
        })
        .join("");

    // Attach event listeners so async handlers can await internals
    tbody.querySelectorAll('button[data-action="edit"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            try {
                const idx = Number(btn.getAttribute('data-index'));
                const u = usersData[idx];
                if (!u) return;
                await openEditUserModal(u.uid, u);
            } catch (err) {
                console.error('openEditUserModal handler error:', err);
            }
        });
    });

    tbody.querySelectorAll('button[data-action="delete"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            try {
                const idx = Number(btn.getAttribute('data-index'));
                const u = usersData[idx];
                if (!u) return;
                await deleteUserProfile(u.uid, u.displayName || '');
            } catch (err) {
                console.error('deleteUserProfile handler error:', err);
            }
        });
    });
}

/**
 * Opens the modal for editing a user's profile.
 * @param {string} uid - The UID of the user to edit.
 * @param {Object} userData - The complete user profile data.
 */
export async function openEditUserModal(uid, userData) {
    // Accept userData as an object or a string (inline onclick may pass a string)
    let parsedUserData = userData;
    if (typeof userData === 'string') {
        try {
            // HTML embedding used &quot; for quotes; convert back
            const normalized = userData.replace(/&quot;/g, '"');
            parsedUserData = JSON.parse(normalized);
        } catch (e) {
            console.warn('openEditUserModal: failed to parse userData string, falling back to raw value', e);
            // keep as string if parsing fails
            parsedUserData = userData;
        }
    }

    console.log("DEBUG: Opening edit modal for user:", uid, parsedUserData);

    // Store the current user being edited
    currentEditingUser = {uid, ...(parsedUserData || {})};

    // Populate form fields (guard DOM queries)
    const setVal = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value;
    };
    const setChecked = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.checked = !!value;
    };

    setVal('edit-user-display-name', parsedUserData?.displayName || '');
    setVal('edit-user-handle', parsedUserData?.handle || '');
    setVal('edit-user-email', parsedUserData?.email || '');
    setVal('edit-user-photo-url', parsedUserData?.photoURL || '');
    setVal('edit-user-discord-url', parsedUserData?.discordURL || '');
    setVal('edit-user-github-url', parsedUserData?.githubURL || '');

    // Ensure theme select is populated before continuing
    try {
        await populateEditUserThemeSelect(parsedUserData?.themePreference);
    } catch (e) {
        console.warn("Failed to populate theme select:", e);
    }

    setVal('edit-user-font-scaling', parsedUserData?.fontScaling || 'normal');
    setVal('edit-user-notification-frequency', parsedUserData?.notificationFrequency || 'immediate');
    setChecked('edit-user-email-notifications', parsedUserData?.emailNotifications || false);
    setChecked('edit-user-discord-notifications', parsedUserData?.discordNotifications || false);
    setChecked('edit-user-push-notifications', parsedUserData?.pushNotifications || false);
    setVal('edit-user-data-retention', parsedUserData?.dataRetention || '365');
    setChecked('edit-user-profile-visible', parsedUserData?.profileVisible !== false);
    setChecked('edit-user-activity-tracking', parsedUserData?.activityTracking !== false);
    setChecked('edit-user-third-party-sharing', parsedUserData?.thirdPartySharing || false);
    setChecked('edit-user-high-contrast', parsedUserData?.highContrast || false);
    setChecked('edit-user-reduced-motion', parsedUserData?.reducedMotion || false);
    setChecked('edit-user-screen-reader', parsedUserData?.screenReader || false);
    setChecked('edit-user-focus-indicators', parsedUserData?.focusIndicators || false);
    setVal('edit-user-keyboard-shortcuts', parsedUserData?.keyboardShortcuts || 'enabled');
    setChecked('edit-user-debug-mode', parsedUserData?.debugMode || false);
    setVal('edit-user-custom-css', parsedUserData?.customCSS || '');

    // Show the modal
    const modal = editUserModal();
    if (modal) {
        modal.style.display = 'flex';
        modal.style.justifyContent = 'center';
        modal.style.alignItems = 'center';
    }
}

/**
 * Populates the theme selection dropdown in the edit user modal.
 * @param {string} selectedThemeId - The currently selected theme ID for the user.
 */
export async function populateEditUserThemeSelect(selectedThemeId) {
    // If the reference isn't available, re-query the DOM to be robust
    const selectEl = editUserThemeSelect() || document.getElementById('edit-user-theme');
    if (!selectEl) {
        console.warn('Theme select element (#edit-user-theme) not found');
        return [];
    }

    selectEl.innerHTML = ''; // Clear existing options
    const availableThemes = await getAvailableThemes(); // From themes.js
    if (Array.isArray(availableThemes)) {
        availableThemes.forEach((theme) => {
            const option = document.createElement('option');
            option.value = theme.id;
            option.textContent = theme.name;
            selectEl.appendChild(option);
        });
    }
    // Try to set the value; if not available, ignore
    try {
        selectEl.value = selectedThemeId;
    } catch (e) { /* ignore */
    }
    console.log(`DEBUG: Edit User Theme Select populated with selected theme: ${selectedThemeId}`);
    return availableThemes;
}

export async function saveUserChanges() {
    if (!currentEditingUser) {
        showMessageBox("No user selected for editing.", true);
        return;
    }

    try {
        const displayNameEl = document.getElementById("edit-user-display-name");
        const handleEl = document.getElementById("edit-user-handle");
        const emailEl = document.getElementById("edit-user-email");
        const photoUrlEl = document.getElementById("edit-user-photo-url");
        const discordUrlEl = document.getElementById("edit-user-discord-url");
        const githubUrlEl = document.getElementById("edit-user-github-url");
        const themeEl = document.getElementById("edit-user-theme");
        const fontScalingEl = document.getElementById("edit-user-font-scaling");
        const notificationFrequencyEl = document.getElementById(
            "edit-user-notification-frequency",
        );
        const emailNotificationsEl = document.getElementById(
            "edit-user-email-notifications",
        );
        const discordNotificationsEl = document.getElementById(
            "edit-user-discord-notifications",
        );
        const pushNotificationsEl = document.getElementById("edit-user-push-notifications");
        const dataRetentionEl = document.getElementById("edit-user-data-retention");
        const profileVisibleEl = document.getElementById("edit-user-profile-visible");
        const activityTrackingEl = document.getElementById("edit-user-activity-tracking");
        const thirdPartySharingEl = document.getElementById(
            "edit-user-third-party-sharing",
        );
        const highContrastEl = document.getElementById("edit-user-high-contrast");
        const reducedMotionEl = document.getElementById("edit-user-reduced-motion");
        const screenReaderEl = document.getElementById("edit-user-screen-reader");
        const focusIndicatorsEl = document.getElementById("edit-user-focus-indicators");
        const keyboardShortcutsEl = document.getElementById("edit-user-keyboard-shortcuts");
        const debugModeEl = document.getElementById("edit-user-debug-mode");
        const customCssEl = document.getElementById("edit-user-custom-css");

        const updatedData = {
            displayName: displayNameEl.value,
            handle: handleEl.value,
            email: emailEl.value,
            photoURL: photoUrlEl.value,
            discordURL: discordUrlEl.value,
            githubURL: githubUrlEl.value,
            themePreference: themeEl.value,
            fontScaling: fontScalingEl.value,
            notificationFrequency: notificationFrequencyEl.value,
            emailNotifications: emailNotificationsEl.checked,
            discordNotifications: discordNotificationsEl.checked,
            pushNotifications: pushNotificationsEl.checked,
            dataRetention: dataRetentionEl.value,
            profileVisible: profileVisibleEl.checked,
            activityTracking: activityTrackingEl.checked,
            thirdPartySharing: thirdPartySharingEl.checked,
            highContrast: highContrastEl.checked,
            reducedMotion: reducedMotionEl.checked,
            screenReader: screenReaderEl.checked,
            focusIndicators: focusIndicatorsEl.checked,
            keyboardShortcuts: keyboardShortcutsEl.value,
            debugMode: debugModeEl.checked,
            customCSS: customCssEl.value,
            lastUpdated: new Date().toISOString(),
        };

        const userDocRef = doc(
            db,
            `artifacts/${appId}/public/data/user_profiles`,
            currentEditingUser.uid,
        );
        await updateDoc(userDocRef, updatedData);

        showMessageBox("User profile updated successfully!", false);
        const modal = editUserModal();
        if (modal) modal.style.display = 'none';
        currentEditingUser = null;

        // Reload the user list to show updated data
        await loadUsers();
    } catch (error) {
        console.error("Error updating user profile:", error);
        showMessageBox("Error updating user profile: " + error.message, true);
    }
}

export async function deleteUserProfile (uid, displayName) {
    console.log("DEBUG: Delete User button clicked for:", uid);

    // Show confirmation dialog with more details
    const confirmed = await showCustomConfirm(
        `Are you sure you want to delete the user profile for ${displayName}?`,
        "This action will permanently delete the user's profile data including all settings, preferences, and customizations. This will NOT delete the Firebase Authentication account. This action cannot be undone.",
    );

    if (confirmed) {
        try {
            // Delete the user document from Firestore
            const userDocRef = doc(
                db,
                `artifacts/${appId}/public/data/user_profiles`,
                uid,
            );
            await deleteDoc(userDocRef);

            showMessageBox("User profile deleted successfully!", false);

            // Reload the user list
            await loadUsers();
        } catch (error) {
            console.error("Error deleting user profile:", error);
            showMessageBox("Error deleting user profile: " + error.message, true);
        }
    } else {
        console.log("Delete user profile action was cancelled.");
    }
}

// Export element getters so other modules can import if needed
// Ensure functions are available globally for inline onclick handlers
if (typeof window !== 'undefined') {
    window.openEditUserModal = openEditUserModal;
    window.deleteUserProfile = deleteUserProfile;
    window.saveUserChanges = saveUserChanges;
    window.loadUsers = loadUsers;
    window.populateEditUserThemeSelect = populateEditUserThemeSelect;
}

// Initial load of users and wiring when the script loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        loadUsers().catch(e => console.error('loadUsers failed:', e));
        wireUpButtons();
    });
} else {
    loadUsers().catch(e => console.error('loadUsers failed:', e));
    wireUpButtons();
}

// Ensure the admin panel refreshes its user list when the auth/user profile becomes ready
if (typeof window !== 'undefined') {
    const _prevOnUserReady = window.onUserReady;
    window.onUserReady = async function () {
        try {
            await loadUsers();
        } catch (e) {
            console.error('onUserReady: loadUsers failed', e);
        }
        try {
            // preserve previous handler behavior
            if (typeof _prevOnUserReady === 'function') await _prevOnUserReady();
        } catch (e) {
            console.error('onUserReady: previous handler failed', e);
        }
    };
}

let _usersUnsubscribe = null;

async function startRealtimeUsersListener() {
    if (!db) return;
    try {
        const usersRef = collection(db, `artifacts/${appId}/public/data/user_profiles`);
        // If onSnapshot was provided by firebase-init, use it
        if (typeof window !== 'undefined' && window.firebaseOnSnapshot) {
            // support external shim (not expected, but keep it safe)
        }
        if (typeof onSnapshot === 'function') {
            // remove previous listener
            if (_usersUnsubscribe) try {
                _usersUnsubscribe();
            } catch (e) { /* ignore */
            }
            _usersUnsubscribe = onSnapshot(usersRef, (snapshot) => {
                usersData = [];
                snapshot.forEach((d) => usersData.push({uid: d.id, ...d.data()}));
                // Try to render; this function guards DOM access
                renderUserList().catch(e => console.error('renderUserList failed after snapshot update', e));
            }, (err) => {
                console.error('Realtime users listener error', err);
            });
            // expose for debugging
            if (typeof window !== 'undefined') window._usersUnsubscribe = _usersUnsubscribe;
        }
    } catch (e) {
        console.error('startRealtimeUsersListener failed:', e);
    }
}

// Start real-time listener when firebase is ready
if (typeof window !== 'undefined') {
    const _prevOnUserReady2 = window.onUserReady;
    window.onUserReady = async function () {
        try {
            await startRealtimeUsersListener();
        } catch (e) {
            console.error('onUserReady: startRealtimeUsersListener failed', e);
        }
        if (typeof _prevOnUserReady2 === 'function') await _prevOnUserReady2();
    };
}