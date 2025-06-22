// announcements.js: Handles announcements.

import { db, appId, getCurrentUser, ADMIN_UIDS } from './firebase-init.js';
import { showMessageBox, showCustomConfirm, parseEmojis, parseMentions, getUserProfileFromFirestore } from './utils.js';
import { collection, doc, addDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- DOM Elements ---
const createAnnouncementSection = document.getElementById('create-announcement-section');
const createAnnouncementForm = document.getElementById('create-announcement-form');
const announcementContentInput = document.getElementById('announcement-content');
const announcementsList = document.getElementById('announcements-list');
const noAnnouncementsMessage = document.getElementById('no-announcements-message');

// --- State Variables ---
let unsubscribeAnnouncements = null;


// --- ANNOUNCEMENT FUNCTIONS ---

/**
 * Sends a new announcement (admin only).
 * @param {string} content - The announcement content.
 */
export async function postAnnouncement(content) {
  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.uid || !currentUser.isAdmin) {
    showMessageBox("You do not have permission to post announcements.", true);
    return;
  }
  if (!db) {
    showMessageBox("Database not initialized. Cannot post announcement.", true);
    return;
  }
  if (content.trim() === '') {
    showMessageBox("Announcement content cannot be empty.", true);
    return;
  }

  const announcementsCol = collection(db, `artifacts/${appId}/public/data/announcements`);
  const announcementData = {
    authorId: currentUser.uid,
    authorHandle: currentUser.handle,
    authorDisplayName: currentUser.displayName,
    authorPhotoURL: currentUser.photoURL || 'https://placehold.co/32x32/1F2937/E5E7EB?text=AV',
    content: content,
    createdAt: serverTimestamp()
  };

  try {
    await addDoc(announcementsCol, announcementData);
    showMessageBox("Announcement posted successfully!", false);
    createAnnouncementForm.reset();
  } catch (error) {
    console.error("Error posting announcement:", error);
    showMessageBox(`Error posting announcement: ${error.message}`, true);
  }
}

/**
 * Deletes an announcement (admin only).
 * @param {string} announcementId - The ID of the announcement to delete.
 */
export async function deleteAnnouncement(announcementId) {
  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.uid || !currentUser.isAdmin) {
    showMessageBox("You do not have permission to delete announcements.", true);
    return;
  }
  if (!db) {
    showMessageBox("Database not initialized. Cannot delete announcement.", true);
    return;
  }

  const confirmation = await showCustomConfirm("Are you sure you want to delete this announcement?", "This action cannot be undone.");
  if (!confirmation) {
    showMessageBox("Announcement deletion cancelled.", false);
    return;
  }

  const announcementDocRef = doc(db, `artifacts/${appId}/public/data/announcements`, announcementId);
  try {
    await deleteDoc(announcementDocRef);
    showMessageBox("Announcement deleted successfully!", false);
  }
  catch (error) {
    console.error("Error deleting announcement:", error);
    showMessageBox(`Error deleting announcement: ${error.message}`, true);
  }
}

// --- REAL-TIME RENDERING (ONSNAPSHOT) ---

/**
 * Renders the announcements in real-time.
 */
export function renderAnnouncements() {
  if (unsubscribeAnnouncements) {
    unsubscribeAnnouncements();
  }

  if (!db || !announcementsList) {
    console.error("Firestore DB or announcementsList element not ready for announcement rendering.");
    return;
  }

  // Show/hide admin announcement form
  const currentUser = getCurrentUser();
  if (currentUser && currentUser.isAdmin && createAnnouncementSection) {
    createAnnouncementSection.classList.remove('hidden');
  } else if (createAnnouncementSection) {
    createAnnouncementSection.classList.add('hidden');
  }

  const announcementsCol = collection(db, `artifacts/${appId}/public/data/announcements`);
  const q = query(announcementsCol, orderBy("createdAt", "desc"));

  // Attach new listener for announcements
  unsubscribeAnnouncements = onSnapshot(q, async (snapshot) => {
    announcementsList.innerHTML = '';
    if (snapshot.empty) {
      noAnnouncementsMessage.style.display = 'block';
    } else {
      noAnnouncementsMessage.style.display = 'none';
    }

    const profilesToFetch = new Set();
    snapshot.forEach(doc => profilesToFetch.add(doc.data().authorId));

    const fetchedProfiles = new Map();
    for (const uid of profilesToFetch) {
      const profile = await getUserProfileFromFirestore(uid);
      if (profile) {
        fetchedProfiles.set(uid, profile);
      }
    }

    for (const docSnapshot of snapshot.docs) {
      const announcement = docSnapshot.data();
      const announcementId = docSnapshot.id;
      const authorProfile = fetchedProfiles.get(announcement.authorId) || {};
      const authorDisplayName = authorProfile.displayName || announcement.authorDisplayName || 'Admin';
      const authorHandle = authorProfile.handle || announcement.authorHandle || 'N/A';
      const authorPhotoURL = authorProfile.photoURL || 'https://placehold.co/32x32/1F2937/E5E7EB?text=AV';

      const announcementElement = document.createElement('div');
      announcementElement.className = 'bg-gray-800 p-4 rounded-lg shadow-md mb-4';
      announcementElement.innerHTML = `
        <div class="flex items-center mb-2">
          <img src="${authorPhotoURL}" alt="Admin" class="w-8 h-8 rounded-full mr-3 object-cover">
          <div>
            <p class="font-semibold text-gray-200">${authorDisplayName} <span class="text-gray-400 text-xs">(@${authorHandle})</span></p>
            <p class="text-xs text-gray-500">${announcement.createdAt ? new Date(announcement.createdAt.toDate()).toLocaleString() : 'N/A'}</p>
          </div>
        </div>
        <p class="text-gray-300 mb-2">${await parseMentions(parseEmojis(announcement.content))}</p>
        ${currentUser && currentUser.isAdmin ? `<button class="delete-announcement-btn text-red-400 hover:text-red-500 float-right transition duration-300" data-id="${announcementId}">
            <i class="fas fa-trash-alt"></i> Delete
        </button>` : ''}
      `;
      announcementsList.appendChild(announcementElement);
    }

    // Attach event listener for delete announcement buttons
    announcementsList.querySelectorAll('.delete-announcement-btn').forEach(button => {
      button.removeEventListener('click', handleDeleteAnnouncement); // Prevent duplicates
      button.addEventListener('click', handleDeleteAnnouncement);
    });
  }, (error) => {
    console.error("Error fetching announcements:", error);
    if (announcementsList) announcementsList.innerHTML = `<p class="text-red-500 text-center">Error loading announcements: ${error.message}</p>`;
    if (noAnnouncementsMessage) noAnnouncementsMessage.style.display = 'none';
  });
}

/**
 * Unsubscribes the current announcements listener.
 */
export function unsubscribeAnnouncementsListener() {
  if (unsubscribeAnnouncements) {
    unsubscribeAnnouncements();
    unsubscribeAnnouncements = null;
  }
}

// --- Event Handlers (exported for forms.js to attach) ---

export async function handlePostAnnouncement(event) {
  event.preventDefault();
  const content = announcementContentInput.value.trim();
  if (!content) {
    showMessageBox("Please enter announcement content.", true);
    return;
  }
  await postAnnouncement(content);
}

export async function handleDeleteAnnouncement(event) {
  event.preventDefault();
  const announcementId = event.target.dataset.id;
  await deleteAnnouncement(announcementId);
}

export function attachAnnouncementEventListeners() {
  if (createAnnouncementForm) {
    createAnnouncementForm.addEventListener('submit', handlePostAnnouncement);
  }
}
