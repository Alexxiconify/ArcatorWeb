// admin-user-management.js

import {
    appId,
    auth,
    db,
} from "./firebase-init.js";

import {getAvailableThemes} from "./themes.js";
import {showMessageBox} from "./utils.js";
import {
    collection,
    getDocs,
    doc,
    updateDoc,
} from "./firebase-init.js";

// User Management DOM elements
const editUserModal = document.getElementById("edit-user-modal");
const editUserDisplayNameInput = document.getElementById(
    "edit-user-display-name",
);
const editUserHandleInput = document.getElementById("edit-user-handle");
const editUserEmailInput = document.getElementById("edit-user-email");
const editUserPhotoUrlInput = document.getElementById("edit-user-photo-url");
const editUserDiscordUrlInput = document.getElementById(
    "edit-user-discord-url",
);
const editUserGithubUrlInput = document.getElementById("edit-user-github-url");
const editUserThemeSelect = document.getElementById("edit-user-theme");
const editUserFontScalingSelect = document.getElementById(
    "edit-user-font-scaling",
);
const editUserNotificationFrequencySelect = document.getElementById(
    "edit-user-notification-frequency",
);
const editUserEmailNotificationsCheckbox = document.getElementById(
    "edit-user-email-notifications",
);
const editUserDiscordNotificationsCheckbox = document.getElementById(
    "edit-user-discord-notifications",
);
const editUserPushNotificationsCheckbox = document.getElementById(
    "edit-user-push-notifications",
);
const editUserDataRetentionSelect = document.getElementById(
    "edit-user-data-retention",
);
const editUserProfileVisibleCheckbox = document.getElementById(
    "edit-user-profile-visible",
);
const editUserActivityTrackingCheckbox = document.getElementById(
    "edit-user-activity-tracking",
);
const editUserThirdPartySharingCheckbox = document.getElementById(
    "edit-user-third-party-sharing",
);
const editUserHighContrastCheckbox = document.getElementById(
    "edit-user-high-contrast",
);
const editUserReducedMotionCheckbox = document.getElementById(
    "edit-user-reduced-motion",
);
const editUserScreenReaderCheckbox = document.getElementById(
    "edit-user-screen-reader",
);
const editUserFocusIndicatorsCheckbox = document.getElementById(
    "edit-user-focus-indicators",
);
const editUserKeyboardShortcutsSelect = document.getElementById(
    "edit-user-keyboard-shortcuts",
);
const editUserDebugModeCheckbox = document.getElementById(
    "edit-user-debug-mode",
);
const editUserCustomCssTextarea = document.getElementById(
    "edit-user-custom-css",
);
const saveUserChangesBtn = document.getElementById("save-user-changes-btn");
const cancelUserChangesBtn = document.getElementById("cancel-user-changes-btn");
let currentEditingUserUid = null;

// Global variables for user management
let usersData = [];
let currentEditingUser = null;

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
        querySnapshot.forEach((doc) => {
            usersData.push({uid: doc.id, ...doc.data()});
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

    if (!usersData || usersData.length === 0) {
        tbody.innerHTML = `
      <tr>
        <td class="text-center py-4 text-text-secondary text-xs" colspan="5">No users found.</td>
      </tr>
    `;
        return;
    }

    tbody.innerHTML = usersData
        .map((user) => {
            const displayName = user.displayName || "N/A";
            const email = user.email || "N/A";
            const theme = user.themePreference || "dark";
            const handle = user.handle || "N/A";

            return `
      <tr class="hover:bg-table-row-even-bg transition-colors">
        <td class="px-2 py-1 text-text-primary text-xs font-mono">${user.uid.substring(0, 8)}...</td>
        <td class="px-2 py-1 text-text-primary text-xs">${displayName}</td>
        <td class="px-2 py-1 text-text-secondary text-xs">${email}</td>
        <td class="px-2 py-1 text-text-secondary text-xs">${theme}</td>
        <td class="px-2 py-1 text-text-secondary text-xs">
          <div class="flex space-x-1">
            <button 
              onclick="openEditUserModal('${user.uid}', ${JSON.stringify(user).replace(/"/g, "&quot;")})"
              class="text-link hover:text-link transition-colors admin-action-btn"
              title="Edit User"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
              </svg>
            </button>
            <button 
              onclick="deleteUserProfile('${user.uid}', '${displayName}')"
              class="text-red-400 hover:text-red-300 transition-colors admin-action-btn"
              title="Delete Profile"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
        })
        .join("");
}

/**
 * Opens the modal for editing a user's profile.
 * @param {string} uid - The UID of the user to edit.
 * @param {Object} userData - The complete user profile data.
 */
export function openEditUserModal(uid, userData) {
    console.log("DEBUG: Opening edit modal for user:", uid, userData);

    // Store the current user being edited
    currentEditingUser = {uid, ...userData};

    // Populate form fields
    document.getElementById("edit-user-display-name").value =
        userData.displayName || "";
    document.getElementById("edit-user-handle").value = userData.handle || "";
    document.getElementById("edit-user-email").value = userData.email || "";
    document.getElementById("edit-user-photo-url").value =
        userData.photoURL || "";
    document.getElementById("edit-user-discord-url").value =
        userData.discordURL || "";
    document.getElementById("edit-user-github-url").value =
        userData.githubURL || "";

    // Populate theme select
    populateEditUserThemeSelect(userData.themePreference);

    // Populate other fields
    document.getElementById("edit-user-font-scaling").value =
        userData.fontScaling || "normal";
    document.getElementById("edit-user-notification-frequency").value =
        userData.notificationFrequency || "immediate";
    document.getElementById("edit-user-email-notifications").checked =
        userData.emailNotifications || false;
    document.getElementById("edit-user-discord-notifications").checked =
        userData.discordNotifications || false;
    document.getElementById("edit-user-push-notifications").checked =
        userData.pushNotifications || false;
    document.getElementById("edit-user-data-retention").value =
        userData.dataRetention || "365";
    document.getElementById("edit-user-profile-visible").checked =
        userData.profileVisible !== false;
    document.getElementById("edit-user-activity-tracking").checked =
        userData.activityTracking !== false;
    document.getElementById("edit-user-third-party-sharing").checked =
        userData.thirdPartySharing || false;
    document.getElementById("edit-user-high-contrast").checked =
        userData.highContrast || false;
    document.getElementById("edit-user-reduced-motion").checked =
        userData.reducedMotion || false;
    document.getElementById("edit-user-screen-reader").checked =
        userData.screenReader || false;
    document.getElementById("edit-user-focus-indicators").checked =
        userData.focusIndicators || false;
    document.getElementById("edit-user-keyboard-shortcuts").value =
        userData.keyboardShortcuts || "enabled";
    document.getElementById("edit-user-debug-mode").checked =
        userData.debugMode || false;
    document.getElementById("edit-user-custom-css").value =
        userData.customCSS || "";

    // Show the modal
    const modal = document.getElementById("edit-user-modal");
    modal.style.display = "flex";
    modal.style.justifyContent = "center";
    modal.style.alignItems = "center";
}

/**
 * Populates the theme selection dropdown in the edit user modal.
 * @param {string} selectedThemeId - The currently selected theme ID for the user.
 */
async function populateEditUserThemeSelect(selectedThemeId) {
    editUserThemeSelect.innerHTML = ""; // Clear existing options
    const availableThemes = await getAvailableThemes(); // From themes.js
    availableThemes.forEach((theme) => {
        const option = document.createElement("option");
        option.value = theme.id;
        option.textContent = theme.name;
        editUserThemeSelect.appendChild(option);
    });
    editUserThemeSelect.value = selectedThemeId; // Set the current theme
    console.log(
        `DEBUG: Edit User Theme Select populated with selected theme: ${selectedThemeId}`,
    );
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
        editUserModal.style.display = "none";
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
        const userDocRef = doc(
            db,
            `artifacts/${appId}/public/data/user_profiles`,
            uid,
        );
        try {
            await deleteDoc(userDocRef);
            showMessageBox(
                `User profile ${displayName} deleted successfully!`,
                false,
            );
            await loadUsers(); // Reload the user list
        } catch (error) {
            console.error("Error deleting user profile:", error);
            showMessageBox(
                `Error deleting user profile ${displayName}. ${error.message}`,
                true,
            );
        }
    } else {
        showMessageBox("Deletion cancelled.", false);
    }
};


