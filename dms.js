// dms.js: Handles Direct Messages and Group Chats.

import {db, getCurrentUser} from "./firebase-init.js";
import {
  escapeHtml,
  getUserProfileFromFirestore,
  renderMarkdownWithMedia,
  resolveHandlesToUids,
  sanitizeHandle,
  showCustomConfirm,
  showMessageBox,
} from "./utils.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- DOM Elements ---
const conversationsPanel = document.getElementById("conversations-panel");
const messagesPanel = document.getElementById("messages-panel");
const backToChatsBtn = document.getElementById("back-to-chats-btn");
const createConversationForm = document.getElementById(
  "create-conversation-form",
);
const newChatTypeSelect = document.getElementById("new-chat-type");
const privateChatFields = document.getElementById("private-chat-fields");
const privateChatRecipientInput = document.getElementById(
  "private-chat-recipient",
);
const groupChatFields = document.getElementById("group-chat-fields");
const groupChatNameInput = document.getElementById("group-chat-name");
const groupChatParticipantsInput = document.getElementById(
  "group-chat-participants",
);
const sortConversationsBySelect = document.getElementById(
  "sort-conversations-by",
);
const conversationsList = document.getElementById("conversations-list");
const noConversationsMessage = document.getElementById(
  "no-conversations-message",
);
const selectedConversationHeader = document.getElementById(
  "selected-conversation-header",
);
const conversationTitleHeader = document.getElementById("conversation-title");
const deleteConversationBtn = document.getElementById(
  "delete-conversation-btn",
);
const conversationMessagesContainer = document.getElementById(
  "conversation-messages-container",
);
const noMessagesMessage = document.getElementById("no-messages-message");
const messageInputArea = document.getElementById("message-input-area");
const sendMessageForm = document.getElementById("send-message-form");
const messageContentInput = document.getElementById("message-content-input");
const userHandlesDatalist = document.getElementById("user-handles-list");

// --- State Variables ---
let selectedConversationId = null;
let unsubscribeConversationsList = null;
let unsubscribeCurrentMessages = null;
let allConversations = []; // Array to hold fetched conversations for sorting
let currentSortOption = "lastMessageAt_desc"; // Default sort for conversations list
let currentMessages = [];
let allUserProfiles = []; // Store all user profiles for suggestions
let selectedRecipients = new Map(); // Store selected recipients with their profiles

const DEFAULT_PROFILE_PIC = "https://placehold.co/40x40/1F2937/E5E7EB?text=AV";

// --- DM FUNCTIONS ---

/**
 * Initialize the DM system
 */
export async function initializeDmSystem() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    console.warn("No current user for DM system initialization");
    return;
  }

  console.log("Initializing DM system for user:", currentUser.uid);

  try {
    // Always clear recipients and UI on init
    selectedRecipients.clear();
    renderRecipients("private");
    renderRecipients("group");
    renderUserCardList("private");
    renderUserCardList("group");

    // Load all user profiles for suggestions
    await loadAllUserProfiles();

    // Set up real-time listeners for conversations
    await setupConversationsListener();

    // Populate user handles for autocomplete
    await populateUserHandlesDatalist();

    // Set up recipient input handlers
    setupRecipientInputHandlers();

    console.log("DM system initialized successfully");
  } catch (error) {
    console.error("Error initializing DM system:", error);
  }
}

/**
 * Load all user profiles for suggestions (username primary, handle fallback)
 */
async function loadAllUserProfiles() {
  if (!db) return;
  try {
    const userProfilesRef = collection(
      db,
      `artifacts/arcator-web/public/data/user_profiles`,
    );
    const querySnapshot = await getDocs(userProfilesRef);
    allUserProfiles = [];
    const usernameCount = {};
    // First pass: count usernames
    querySnapshot.forEach((docSnap) => {
      const profile = docSnap.data();
      if (profile.displayName) {
        const uname = profile.displayName.trim().toLowerCase();
        usernameCount[uname] = (usernameCount[uname] || 0) + 1;
      }
    });
    // Second pass: build profile list with username/handle
    querySnapshot.forEach((docSnap) => {
      const profile = docSnap.data();
      if (profile.handle && profile.displayName) {
        const uname = profile.displayName.trim();
        const unameKey = uname.toLowerCase();
        const showHandle = usernameCount[unameKey] > 1;
        allUserProfiles.push({
          uid: docSnap.id,
          handle: profile.handle,
          displayName: uname,
          photoURL: profile.photoURL || DEFAULT_PROFILE_PIC,
          usernameLabel: showHandle ? `${uname} (@${profile.handle})` : uname,
        });
      }
    });
    console.log(
      "Loaded",
      allUserProfiles.length,
      "user profiles for suggestions (username primary)",
    );
    renderUserCardList("private");
    renderUserCardList("group");
  } catch (error) {
    console.error("Error loading user profiles:", error);
  }
}

/**
 * Render user cards for recipient selection (private or group)
 */
function renderUserCardList(type) {
  const listId =
    type === "private"
      ? "private-chat-recipient-list"
      : "group-chat-recipient-list";
  const list = document.getElementById(listId);
  const inputId =
    type === "private" ? "private-chat-recipient" : "group-chat-participants";
  const input = document.getElementById(inputId);

  if (!list) {
    console.warn(`User list container not found: ${listId}`);
    return;
  }

  list.innerHTML = "";

  if (allUserProfiles.length === 0) {
    list.innerHTML =
      '<div class="teams-empty-state"><div class="empty-icon">👥</div><h3>No users found</h3><p>Unable to load user list</p></div>';
    return;
  }

  // Horizontal table: row 1 = names+pics, row 2 = handles
  let nameRow = '<tr>';
  let handleRow = '<tr>';
  allUserProfiles.forEach((profile) => {
    const isSelected = selectedRecipients.has(profile.uid);
    nameRow += `
      <td class="p-0 cursor-pointer hover:bg-input-border transition-colors${isSelected ? ' selected' : ''}" data-uid="${profile.uid}" style="padding:0 4px; vertical-align:middle;">
        <span class="flex items-center justify-center gap-1" style="line-height:1.2;">
          <img src="${profile.photoURL}" alt="${profile.displayName}" class="rounded-full object-cover" style="width:1em;height:1em;min-width:1em;min-height:1em;max-width:1em;max-height:1em;display:inline-block;vertical-align:middle;margin-right:0.25em;" onerror="this.src='${DEFAULT_PROFILE_PIC}'">
          <span class="font-medium text-[11px] text-center leading-tight" style="display:inline;vertical-align:middle;">${escapeHtml(profile.displayName)}</span>
        </span>
      </td>
    `;
    handleRow += `
      <td class="p-0 text-[10px] text-text-secondary text-center cursor-pointer hover:bg-input-border transition-colors${isSelected ? ' selected' : ''}" data-uid="${profile.uid}" style="padding:0 4px;">@${escapeHtml(profile.handle)}</td>
    `;
  });
  nameRow += '</tr>';
  handleRow += '</tr>';

  const table = document.createElement("table");
  table.className = "w-full border-collapse text-center";
  table.innerHTML = `<tbody>${nameRow}${handleRow}</tbody>`;
  list.appendChild(table);

  // Update input field with selected handles
  if (input) {
    const selectedHandles = Array.from(selectedRecipients.values()).map(
      (profile) => `@${profile.handle}`,
    );
    input.value = selectedHandles.join(", ");
  }

  // Add click handlers to all cells
  list.querySelectorAll("[data-uid]").forEach((cell) => {
    cell.addEventListener("click", () => {
      const uid = cell.dataset.uid;
      const profile = allUserProfiles.find((p) => p.uid === uid);
      if (profile) {
        if (type === "private") {
          selectedRecipients.clear();
          selectedRecipients.set(profile.uid, profile);
        } else {
          if (selectedRecipients.has(profile.uid)) {
            selectedRecipients.delete(profile.uid);
          } else {
            selectedRecipients.set(profile.uid, profile);
          }
        }
        renderUserCardList(type);
        renderRecipients(type);
      }
    });
  });
}

/**
 * Call renderUserCardList after loading profiles
 */
async function populatePrivateChatRecipientSelect() {
  renderUserCardList("private");
}

async function populateGroupChatRecipientSelect() {
  renderUserCardList("group");
}

/**
 * Set up recipient input handlers for suggestions
 */
function setupRecipientInputHandlers() {
  const privateInput = document.getElementById("private-chat-recipient");
  const groupInput = document.getElementById("group-chat-participants");

  if (privateInput) {
    privateInput.addEventListener("input", (e) =>
      handleRecipientInput(e, "private"),
    );
    privateInput.addEventListener("keydown", (e) =>
      handleRecipientKeydown(e, "private"),
    );
  }

  if (groupInput) {
    groupInput.addEventListener("input", (e) =>
      handleRecipientInput(e, "group"),
    );
    groupInput.addEventListener("keydown", (e) =>
      handleRecipientKeydown(e, "group"),
    );
  }
}

/**
 * Handle recipient input for suggestions
 */
function handleRecipientInput(event, type) {
  const input = event.target;
  const value = input.value.trim();
  const suggestionsContainer = document.getElementById(
    `${type}-chat-suggestions`,
  );
  if (!suggestionsContainer) return;
  if (!value || value.length < 1) {
    suggestionsContainer.style.display = "none";
    input.classList.remove("input-valid", "input-invalid");
    return;
  }
  // Validate input: green if valid, red if not
  const searchTerm = value.replace(/^@/, "").toLowerCase();
  let valid = false;
  for (const profile of allUserProfiles) {
    if (
      profile.usernameLabel.toLowerCase() === searchTerm ||
      profile.displayName.trim().toLowerCase() === searchTerm ||
      profile.handle.toLowerCase() === searchTerm
    ) {
      valid = true;
      break;
    }
  }
  input.classList.toggle("input-valid", valid);
  input.classList.toggle("input-invalid", !valid);
  // Suggestions logic
  const filteredProfiles = allUserProfiles
    .filter((profile) => {
      const uname = profile.displayName.trim().toLowerCase();
      const handle = profile.handle.toLowerCase();
      return (
        uname.includes(searchTerm) ||
        handle.includes(searchTerm) ||
        profile.usernameLabel.toLowerCase().includes(searchTerm)
      );
    })
    .slice(0, 5);
  if (filteredProfiles.length === 0) {
    suggestionsContainer.style.display = "none";
    return;
  }
  suggestionsContainer.innerHTML = filteredProfiles
    .map(
      (profile) => `
    <div class="handle-suggestion" data-uid="${profile.uid}">
      <img src="${profile.photoURL}" alt="${profile.displayName}" class="w-8 h-8 rounded-full object-cover mr-2" onerror="this.src='${DEFAULT_PROFILE_PIC}'">
      <div class="suggestion-info">
        <div class="suggestion-name">${escapeHtml(profile.usernameLabel)}</div>
      </div>
    </div>
  `,
    )
    .join("");
  suggestionsContainer.style.display = "block";
  suggestionsContainer
    .querySelectorAll(".handle-suggestion")
    .forEach((suggestion) => {
      suggestion.addEventListener("click", () => {
        const uid = suggestion.dataset.uid;
        const profile = allUserProfiles.find((p) => p.uid === uid);
        if (profile) {
          addRecipient(type, profile);
          input.value = "";
          input.classList.remove("input-valid", "input-invalid");
          suggestionsContainer.style.display = "none";
        }
      });
    });
}

/**
 * Handle recipient input keydown events
 */
function handleRecipientKeydown(event, type) {
  if (event.key === "Enter") {
    event.preventDefault();
    const input = event.target;
    const value = input.value.trim();
    if (value) {
      // Try to find user by usernameLabel (username primary, handle fallback)
      const searchTerm = value.replace(/^@/, "").toLowerCase();
      let profile = allUserProfiles.find(
        (p) => p.usernameLabel.toLowerCase() === searchTerm,
      );
      if (!profile) {
        // Try by displayName
        profile = allUserProfiles.find(
          (p) => p.displayName.trim().toLowerCase() === searchTerm,
        );
      }
      if (!profile) {
        // Try by handle
        profile = allUserProfiles.find(
          (p) => p.handle.toLowerCase() === searchTerm,
        );
      }
      if (profile) {
        addRecipient(type, profile);
        input.value = "";
        document.getElementById(`${type}-chat-suggestions`).style.display =
          "none";
      } else {
        showMessageBox(`User not found. Please select from suggestions.`, true);
      }
    }
  }
}

/**
 * Add a recipient to the selected recipients
 */
function addRecipient(type, profile) {
  const currentUser = getCurrentUser();
  if (!currentUser) return;

  // Don't add self as recipient
  if (profile.uid === currentUser.uid) {
    showMessageBox("You cannot add yourself as a recipient.", true);
    return;
  }

  // Check if already added
  if (selectedRecipients.has(profile.uid)) {
    showMessageBox(`@${profile.handle} is already added.`, true);
    return;
  }

  selectedRecipients.set(profile.uid, profile);
  renderRecipients(type);
}

/**
 * Remove a recipient from selected recipients
 */
function removeRecipient(type, uid) {
  selectedRecipients.delete(uid);
  renderRecipients(type);
}

/**
 * Make removeRecipient globally accessible
 */
window.removeRecipient = removeRecipient;

/**
 * Render selected recipients as bubbles
 */
function renderRecipients(type) {
  const container = document.getElementById(`${type}-chat-recipients`);
  if (!container) return;

  if (selectedRecipients.size === 0) {
    container.innerHTML = "";
    container.classList.add("empty");
    return;
  }

  container.classList.remove("empty");
  container.style.display = "flex";
  container.style.flexWrap = "wrap";
  container.style.gap = "0.5rem";
  container.innerHTML = Array.from(selectedRecipients.values())
    .map(
      (profile) => `
    <div class="recipient-bubble" data-uid="${profile.uid}">
      <img src="${profile.photoURL}" alt="${profile.displayName}" class="w-8 h-8 rounded-full object-cover mr-2" onerror="this.src='${DEFAULT_PROFILE_PIC}'">
      <span class="recipient-name">${escapeHtml(profile.displayName)}</span>
      <span class="recipient-handle">@${escapeHtml(profile.handle)}</span>
      <button class="remove-recipient" data-type="${type}" data-uid="${profile.uid}" title="Remove recipient">
        ×
      </button>
    </div>
  `,
    )
    .join("");

  // Add event listeners to remove buttons
  container.querySelectorAll(".remove-recipient").forEach((button) => {
    button.addEventListener("click", (event) => {
      const type = event.target.dataset.type;
      const uid = event.target.dataset.uid;
      removeRecipient(type, uid);
    });
  });
}

/**
 * Opens a modal to edit conversation name and group image
 */
function openEditConversationModal(convId, convType, currentName) {
  const currentUser = getCurrentUser();
  if (!currentUser) return;

  // Find the conversation to get current image and participants
  const conversation = allConversations.find((c) => c.id === convId);
  const currentImage = conversation
    ? convType === "group"
      ? conversation.groupImage
      : conversation.privateImage
    : "";
  const currentParticipants = conversation
    ? conversation.participants || []
    : [];

  // Create modal HTML
  const modalHTML = `
    <div id="edit-conversation-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-card border border-input-border rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-bold">Edit ${convType === "group" ? "Group" : "Conversation"}</h3>
          <button class="close-edit-modal text-2xl hover:text-red-500 transition-colors">&times;</button>
        </div>

        <form id="edit-conversation-form" class="space-y-4">
          <div class="form-group">
            <label class="form-label" for="edit-conversation-name">Name</label>
            <input type="text" id="edit-conversation-name" class="form-input bg-card text-text-primary border-none rounded w-full"
                   value="${escapeHtml(currentName)}" required>
          </div>

          <div class="form-group">
            <label class="form-label" for="edit-conversation-image">${convType === "group" ? "Group" : "Conversation"} Image URL (optional)</label>
            <input type="url" id="edit-conversation-image" class="form-input bg-card text-text-primary border-none rounded w-full"
                   value="${escapeHtml(currentImage || "")}" placeholder="https://example.com/image.png">
            <p class="text-xs text-text-secondary mt-1">Leave empty to use ${convType === "group" ? "default group icon" : "recipient's avatar"}</p>
          </div>

          ${
            convType === "group"
              ? `
            <div class="form-group">
              <label class="form-label">Group Participants</label>
              <div class="bg-card border border-input-border rounded p-3 max-h-48 overflow-y-auto">
                <div id="current-participants-list" class="space-y-2">
                  ${currentParticipants
                    .map((uid) => {
                      const profile = allUserProfiles.find(
                        (p) => p.uid === uid,
                      );
                      const isCurrentUser = uid === currentUser.uid;
                      return `
                      <div class="flex items-center justify-between p-2 bg-input-border rounded" data-uid="${uid}">
                        <div class="flex items-center gap-2">
                          <img src="${profile?.photoURL || DEFAULT_PROFILE_PIC}" alt="${profile?.displayName || "Unknown"}"
                               class="w-6 h-6 rounded-full object-cover" onerror="this.src='${DEFAULT_PROFILE_PIC}'">
                          <span class="text-sm">${escapeHtml(profile?.displayName || "Unknown User")}</span>
                          ${isCurrentUser ? '<span class="text-xs text-text-secondary">(You)</span>' : ""}
                        </div>
                        ${
                          !isCurrentUser
                            ? `
                          <button type="button" class="remove-participant-btn text-red-500 hover:text-red-700 text-sm"
                                  data-uid="${uid}" title="Remove participant">
                            Remove
                          </button>
                        `
                            : ""
                        }
                      </div>
                    `;
                    })
                    .join("")}
                </div>
              </div>

              <div class="mt-3">
                <label class="form-label text-sm">Add New Participants</label>
                <div id="add-participants-list" class="user-list-scrollable max-h-32"></div>
                <div class="recipient-input-container mt-2">
                  <input id="add-participant-input" class="form-input bg-card text-text-primary border-none rounded w-full text-sm"
                         placeholder="@username or handle" list="user-handles-list">
                  <div id="add-participant-suggestions" class="handle-suggestions" style="display: none;"></div>
                </div>
              </div>
            </div>
          `
              : ""
          }

          <div class="flex gap-2">
            <button type="submit" class="btn-modern flex-1">Save Changes</button>
            <button type="button" class="btn-modern flex-1 close-edit-modal">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Add modal to page
  document.body.insertAdjacentHTML("beforeend", modalHTML);

  const modal = document.getElementById("edit-conversation-modal");
  const form = document.getElementById("edit-conversation-form");
  const closeButtons = modal.querySelectorAll(".close-edit-modal");

  // Initialize participant management for group chats
  if (convType === "group") {
    initializeParticipantManagement(convId, currentParticipants);
  }

  // Close modal handlers
  closeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      modal.remove();
    });
  });

  // Close on outside click
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });

  // Form submission
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const newName = document
      .getElementById("edit-conversation-name")
      .value.trim();
    const newImage = document
      .getElementById("edit-conversation-image")
      .value.trim();

    if (!newName) {
      showMessageBox("Name cannot be empty.", true);
      return;
    }

    try {
      let newParticipants = null;
      if (convType === "group") {
        // Get updated participants list
        const currentParticipantsList = document.getElementById(
          "current-participants-list",
        );
        const participantUids = Array.from(
          currentParticipantsList.querySelectorAll("[data-uid]"),
        ).map((el) => el.dataset.uid);
        newParticipants = participantUids;
      }

      await updateConversation(
        convId,
        newName,
        convType === "group" ? newImage : null,
        convType === "private" ? newImage : null,
        newParticipants,
      );
      showMessageBox("Conversation updated successfully!", false);
      modal.remove();
    } catch (error) {
      console.error("Error updating conversation:", error);
      showMessageBox(`Error updating conversation: ${error.message}`, true);
    }
  });
}

/**
 * Update conversation details
 */
async function updateConversation(
  convId,
  newName,
  groupImage,
  privateImage,
  newParticipants,
) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !convId || !db) {
    showMessageBox(
      "Cannot update conversation. User not logged in or conversation not found.",
      true,
    );
    return;
  }

  const conversationDocRef = doc(
    db,
    `artifacts/arcator-web/users/${currentUser.uid}/dms`,
    convId,
  );

  try {
    const updateData = {
      name: newName,
    };

    if (groupImage !== null) {
      updateData.groupImage = groupImage;
    }

    if (privateImage !== null) {
      updateData.privateImage = privateImage;
    }

    if (newParticipants !== null) {
      updateData.participants = newParticipants;
    }

    await updateDoc(conversationDocRef, updateData);
    console.log("Conversation updated successfully");
  } catch (error) {
    console.error("Error updating conversation:", error);
    throw error;
  }
}

/**
 * Set up real-time listener for conversations
 */
async function setupConversationsListener() {
  const currentUser = await getCurrentUser();
  if (!currentUser || !db) {
    console.warn("No current user or database for conversations listener");
    return;
  }

  if (unsubscribeConversationsList) {
    unsubscribeConversationsList();
  }

  const conversationsCol = collection(
    db,
    `artifacts/arcator-web/users/${currentUser.uid}/dms`,
  );
  const q = query(conversationsCol, orderBy("lastMessageAt", "desc"));

  unsubscribeConversationsList = onSnapshot(
    q,
    async (snapshot) => {
      allConversations = [];

      if (snapshot.empty) {
        console.log("No conversations found");
        renderConversationsList();
        return;
      }

      // Collect all unique user UIDs from conversations
      const allUserUids = new Set();
      snapshot.forEach((doc) => {
        const conv = { id: doc.id, ...doc.data() };
        allConversations.push(conv);
        if (conv.participants) {
          conv.participants.forEach((uid) => allUserUids.add(uid));
        }
      });

      // Fetch all user profiles in one batch
      const fetchedProfiles = new Map();
      if (allUserUids.size > 0) {
        const userProfilesRef = collection(
          db,
          `artifacts/arcator-web/public/data/user_profiles`,
        );
        const profilePromises = Array.from(allUserUids).map(async (uid) => {
          try {
            const profileDoc = await getDoc(doc(userProfilesRef, uid));
            if (profileDoc.exists()) {
              fetchedProfiles.set(uid, profileDoc.data());
            }
          } catch (error) {
            console.warn("Could not fetch profile for user:", uid, error);
          }
        });
        await Promise.all(profilePromises);
      }

      // Enhance conversations with profile data
      allConversations.forEach((conv) => {
        if (conv.type === "group") {
          conv.groupImage = conv.groupImage || null;
        } else {
          const otherUid = conv.participants?.find(
            (uid) => uid !== currentUser.uid,
          );
          if (otherUid) {
            const otherProfile = fetchedProfiles.get(otherUid);
            if (otherProfile) {
              conv.otherUsername =
                otherProfile.displayName ||
                otherProfile.handle ||
                "Unknown User";
              conv.otherUserAvatar =
                otherProfile.photoURL || DEFAULT_PROFILE_PIC;
              // For private chats, preserve custom names and only set fallback if no name exists
              if (!conv.name || conv.name.trim() === "") {
                conv.name =
                  otherProfile.displayName ||
                  otherProfile.handle ||
                  "Unknown User";
              }
              // Preserve private image if set
              conv.privateImage = conv.privateImage || null;
              console.log(
                `[DEBUG] Private chat ${conv.id}: name="${conv.name}", otherUsername="${conv.otherUsername}", otherUserAvatar="${conv.otherUserAvatar}", privateImage="${conv.privateImage}"`,
              );
            } else {
              conv.otherUsername = "Unknown User";
              conv.otherUserAvatar = DEFAULT_PROFILE_PIC;
              if (!conv.name || conv.name.trim() === "") {
                conv.name = "Unknown User";
              }
              conv.privateImage = conv.privateImage || null;
              console.log(
                `[DEBUG] Private chat ${conv.id}: No profile found for ${otherUid}`,
              );
            }
          } else {
            // Self-DM case
            conv.otherUsername = "Self Chat";
            conv.otherUserAvatar = currentUser.photoURL || DEFAULT_PROFILE_PIC;
            if (!conv.name || conv.name.trim() === "") {
              conv.name = "Self Chat";
            }
            conv.privateImage = conv.privateImage || null;
            console.log(
              `[DEBUG] Self-DM ${conv.id}: name="${conv.name}", privateImage="${conv.privateImage}"`,
            );
          }
        }
      });

      console.log(
        "Enhanced conversations with profile data:",
        allConversations,
      );
      renderConversationsList();

      // Auto-select the first conversation if none is currently selected
      if (!selectedConversationId && allConversations.length > 0) {
        const firstConversation = allConversations[0];
        console.log("Auto-selecting first conversation:", firstConversation.id);
        selectConversation(firstConversation.id, firstConversation);
      }
    },
    (error) => {
      console.error("Error fetching conversations:", error);
      showMessageBox(`Error loading conversations: ${error.message}`, true);
    },
  );
}

/**
 * Load messages for a specific conversation
 */
async function loadMessagesForConversation(convId) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !convId || !db) {
    console.log("[DEBUG] loadMessagesForConversation: Missing requirements", {
      hasCurrentUser: !!currentUser,
      hasConvId: !!convId,
      hasDb: !!db,
    });
    return;
  }

  console.log(
    "[DEBUG] loadMessagesForConversation: Starting for convId:",
    convId,
  );

  if (unsubscribeCurrentMessages) {
    unsubscribeCurrentMessages();
    console.log("[DEBUG] Unsubscribed from previous messages listener");
  }

  const messagesCol = collection(
    db,
    `artifacts/arcator-web/users/${currentUser.uid}/dms/${convId}/messages`,
  );
  const q = query(messagesCol, orderBy("createdAt", "asc"));

  console.log(
    "[DEBUG] Setting up messages listener for path:",
    `artifacts/arcator-web/users/${currentUser.uid}/dms/${convId}/messages`,
  );

  unsubscribeCurrentMessages = onSnapshot(
    q,
    async (snapshot) => {
      console.log("[DEBUG] Messages snapshot received:", {
        empty: snapshot.empty,
        size: snapshot.size,
      });

      currentMessages = [];

      if (snapshot.empty) {
        console.log("[DEBUG] No messages found, rendering empty state");
        await renderConversationMessages(convId);
        return;
      }

      snapshot.forEach((doc) => {
        const msg = doc.data();
        currentMessages.push({
          id: doc.id,
          ...msg,
          timestamp: msg.createdAt?.toDate?.() || msg.createdAt || new Date(),
        });
      });

      console.log(
        "[DEBUG] Loaded",
        currentMessages.length,
        "messages with embedded profile data",
      );
      await renderConversationMessages(convId);
    },
    (error) => {
      console.error("Error fetching messages:", error);
      showMessageBox(`Error loading messages: ${error.message}`, true);
    },
  );
}

/**
 * Load conversations (alias for setupConversationsListener)
 */
export async function loadConversations() {
  await setupConversationsListener();
}

/**
 * Populate user handles datalist for autocomplete
 */
export async function populateUserHandlesDatalist() {
  if (!db) return;
  const userHandlesDatalist = document.getElementById("user-handles-list");
  if (!userHandlesDatalist) return;
  userHandlesDatalist.innerHTML = "";
  const userProfilesRef = collection(
    db,
    `artifacts/arcator-web/public/data/user_profiles`,
  );
  try {
    const querySnapshot = await getDocs(userProfilesRef);
    const usernameCount = {};
    querySnapshot.forEach((docSnap) => {
      const profile = docSnap.data();
      if (profile.displayName) {
        const uname = profile.displayName.trim().toLowerCase();
        usernameCount[uname] = (usernameCount[uname] || 0) + 1;
      }
    });
    querySnapshot.forEach((docSnap) => {
      const profile = docSnap.data();
      if (profile.handle && profile.displayName) {
        const uname = profile.displayName.trim();
        const unameKey = uname.toLowerCase();
        const showHandle = usernameCount[unameKey] > 1;
        const option = document.createElement("option");
        option.value = showHandle ? `${uname} (@${profile.handle})` : uname;
        userHandlesDatalist.appendChild(option);
      }
    });
    console.log(
      "User handles datalist populated (username primary, handle fallback)",
    );
  } catch (error) {
    console.error("Error fetching user handles for datalist:", error);
  }
}

/**
 * Unsubscribe from listeners
 */
export function unsubscribeConversationsListListener() {
  if (unsubscribeConversationsList) {
    unsubscribeConversationsList();
    unsubscribeConversationsList = null;
  }
}

export function unsubscribeCurrentMessagesListener() {
  if (unsubscribeCurrentMessages) {
    unsubscribeCurrentMessages();
    unsubscribeCurrentMessages = null;
  }
}

/**
 * Event handlers
 */
export async function handleCreateConversation(event) {
  event.preventDefault();

  const typeSelect = document.getElementById("new-chat-type");
  const groupNameInput = document.getElementById("group-chat-name");
  const groupImageInput = document.getElementById("group-chat-image");
  const privateNameInput = document.getElementById("private-chat-name");
  const privateImageInput = document.getElementById("private-chat-image");

  const type = typeSelect?.value || "private";
  let groupName = "";
  let groupImage = "";
  let privateName = "";
  let privateImage = "";

  if (type === "group") {
    groupName = groupNameInput?.value?.trim() || "";
    groupImage = groupImageInput?.value?.trim() || "";
  } else {
    privateName = privateNameInput?.value?.trim() || "";
    privateImage = privateImageInput?.value?.trim() || "";
  }

  // Check if we have selected recipients
  if (selectedRecipients.size === 0) {
    showMessageBox("Please select at least one recipient for the chat.", true);
    return;
  }

  await createConversation(
    type,
    [],
    groupName,
    groupImage,
    privateName,
    privateImage,
  );
}

export async function handleSendMessage(event) {
  event.preventDefault();

  const messageInput = document.getElementById("message-content-input");
  const content = messageInput?.value?.trim();

  if (content && selectedConversationId) {
    await sendMessage(content);
    if (messageInput) messageInput.value = "";
  }
}

export async function handleDeleteMessage(event) {
  event.preventDefault();

  const messageId = event.target.dataset.messageId;
  if (selectedConversationId && messageId) {
    await deleteMessage(messageId);
  }
}

export async function handleDeleteConversationClick(event) {
  event.preventDefault();

  const convId = event.target.dataset.conversationId;
  if (convId) {
    await deleteConversation(convId);
  }
}

function handleSelectConversationClick(event) {
  event.preventDefault();
  event.stopPropagation();

  const convId = event.currentTarget.dataset.conversationId;
  if (!convId) {
    console.error("No conversation ID found in click event");
    return;
  }

  const conversation = allConversations.find((c) => c.id === convId);
  if (conversation) {
    console.log("Selecting conversation:", convId, conversation);
    selectConversation(convId, conversation);
  } else {
    console.error("Conversation not found in allConversations:", convId);
  }
}

/**
 * Attach all DM event listeners
 */
export function attachDmEventListeners() {
  // Create conversation form
  const createForm = document.getElementById("create-conversation-form");
  if (createForm) {
    createForm.addEventListener("submit", handleCreateConversation);
  }

  // Send message form
  const sendForm = document.getElementById("send-message-form");
  if (sendForm) {
    sendForm.addEventListener("submit", handleSendMessage);
  }

  // Chat dropdown selection
  const chatDropdown = document.getElementById("selected-chat-dropdown");
  if (chatDropdown) {
    chatDropdown.addEventListener("change", (event) => {
      const selectedChatId = event.target.value;
      if (selectedChatId) {
        const conversation = allConversations.find(
          (c) => c.id === selectedChatId,
        );
        if (conversation) {
          selectConversation(selectedChatId, conversation);
        }
      } else {
        updateDmUiForNoConversationSelected();
      }
    });
  }

  // Delete conversation button
  const deleteBtn = document.getElementById("delete-conversation-btn");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", handleDeleteConversationClick);
  }

  // Chat type switching
  const chatTypeSelect = document.getElementById("new-chat-type");
  if (chatTypeSelect) {
    chatTypeSelect.addEventListener("change", () => {
      const privateFields = document.getElementById("private-chat-fields");
      const groupFields = document.getElementById("group-chat-fields");
      selectedRecipients.clear();
      renderRecipients("private");
      renderRecipients("group");
      renderUserCardList("private");
      renderUserCardList("group");
      if (chatTypeSelect.value === "private") {
        privateFields.classList.remove("hidden");
        groupFields.classList.add("hidden");
      } else {
        privateFields.classList.add("hidden");
        groupFields.classList.remove("hidden");
      }
    });
  }

  // Back button for conversations
  const backBtn = document.getElementById("back-to-chats-btn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      updateDmUiForNoConversationSelected();
    });
  }

  // Conversation items (handled in renderConversationsList)
}

/**
 * Deletes an entire conversation and all its messages.
 * @param {string} convId - The ID of the conversation to delete.
 */
export async function deleteConversation(convId) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !currentUser.uid) {
    showMessageBox("You must be logged in to delete a conversation.", true);
    return;
  }
  if (!db) {
    showMessageBox(
      "Database not initialized. Cannot delete conversation.",
      true,
    );
    return;
  }

  const confirmation = await showCustomConfirm(
    "Are you sure you want to delete this entire chat?",
    "This will delete the conversation and all its messages for everyone. This action cannot be undone.",
  );
  if (!confirmation) {
    showMessageBox("Conversation deletion cancelled.", false);
    return;
  }

  // Use the correct path structure
  const conversationDocRef = doc(
    db,
    `artifacts/arcator-web/users/${currentUser.uid}/dms`,
    convId,
  );
  const messagesColRef = collection(conversationDocRef, "messages");

  try {
    const messagesSnapshot = await getDocs(messagesColRef);
    const batch = writeBatch(db);
    messagesSnapshot.docs.forEach((msgDoc) => {
      batch.delete(msgDoc.ref);
    });
    await batch.commit();

    await deleteDoc(conversationDocRef);

    showMessageBox("Conversation deleted successfully!", false);
    updateDmUiForNoConversationSelected();
  } catch (error) {
    console.error("Error deleting conversation:", error);
    showMessageBox(`Error deleting conversation: ${error.message}`, true);
  }
}

/**
 * Initialize participant management for group chat editing
 */
function initializeParticipantManagement(convId, currentParticipants) {
  const addParticipantsList = document.getElementById("add-participants-list");
  const addParticipantInput = document.getElementById("add-participant-input");
  const addParticipantSuggestions = document.getElementById(
    "add-participant-suggestions",
  );

  // Filter out current participants from available users
  const availableUsers = allUserProfiles.filter(
    (profile) => !currentParticipants.includes(profile.uid),
  );

  // Render available users table
  if (addParticipantsList) {
    const table = document.createElement("table");
    table.className = "w-full border-collapse";
    table.innerHTML = `
      <thead>
        <tr class="border-b border-input-border">
          <th class="text-left p-2 font-semibold text-sm">Name</th>
          <th class="text-left p-2 font-semibold text-sm">Handle</th>
        </tr>
      </thead>
      <tbody>
        ${availableUsers
          .map(
            (profile) => `
          <tr class="user-card-row" data-uid="${profile.uid}">
            <td class="p-2 cursor-pointer hover:bg-input-border transition-colors">
              <div class="flex items-center gap-2">
                <img src="${profile.photoURL}" alt="${profile.displayName}" class="w-6 h-6 rounded-full object-cover" onerror="this.src='${DEFAULT_PROFILE_PIC}'">
                <span class="font-medium text-sm">${escapeHtml(profile.displayName)}</span>
              </div>
            </td>
            <td class="p-2 text-sm text-text-secondary cursor-pointer hover:bg-input-border transition-colors">
              @${escapeHtml(profile.handle)}
            </td>
          </tr>
        `,
          )
          .join("")}
      </tbody>
    `;

    addParticipantsList.appendChild(table);

    // Add click handlers to user rows
    addParticipantsList.querySelectorAll(".user-card-row").forEach((row) => {
      row.addEventListener("click", () => {
        const uid = row.dataset.uid;
        const profile = availableUsers.find((p) => p.uid === uid);

        if (profile) {
          addParticipantToGroup(uid, profile);
          row.remove(); // Remove from available list
        }
      });
    });
  }

  // Handle remove participant buttons
  document.querySelectorAll(".remove-participant-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const uid = btn.dataset.uid;
      removeParticipantFromGroup(uid);
    });
  });

  // Handle add participant input
  if (addParticipantInput) {
    addParticipantInput.addEventListener("input", (e) =>
      handleAddParticipantInput(e, availableUsers),
    );
    addParticipantInput.addEventListener("keydown", (e) =>
      handleAddParticipantKeydown(e, availableUsers),
    );
  }
}

/**
 * Add participant to group
 */
function addParticipantToGroup(uid, profile) {
  const currentParticipantsList = document.getElementById(
    "current-participants-list",
  );
  const currentUser = getCurrentUser();
  const isCurrentUser = uid === currentUser.uid;

  const participantHtml = `
    <div class="flex items-center justify-between p-2 bg-input-border rounded" data-uid="${uid}">
      <div class="flex items-center gap-2">
        <img src="${profile.photoURL}" alt="${profile.displayName}"
             class="w-6 h-6 rounded-full object-cover" onerror="this.src='${DEFAULT_PROFILE_PIC}'">
        <span class="text-sm">${escapeHtml(profile.displayName)}</span>
        ${isCurrentUser ? '<span class="text-xs text-text-secondary">(You)</span>' : ""}
      </div>
      ${
        !isCurrentUser
          ? `
        <button type="button" class="remove-participant-btn text-red-500 hover:text-red-700 text-sm"
                data-uid="${uid}" title="Remove participant">
          Remove
        </button>
      `
          : ""
      }
    </div>
  `;

  currentParticipantsList.insertAdjacentHTML("beforeend", participantHtml);

  // Add event listener to new remove button
  const newRemoveBtn = currentParticipantsList.querySelector(
    `[data-uid="${uid}"] .remove-participant-btn`,
  );
  if (newRemoveBtn) {
    newRemoveBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      removeParticipantFromGroup(uid);
    });
  }
}

/**
 * Remove participant from group
 */
function removeParticipantFromGroup(uid) {
  const participantElement = document.querySelector(
    `#current-participants-list [data-uid="${uid}"]`,
  );
  if (participantElement) {
    participantElement.remove();
  }

  // Add back to available users list
  const profile = allUserProfiles.find((p) => p.uid === uid);
  if (profile) {
    const addParticipantsList = document.getElementById(
      "add-participants-list",
    );
    const tbody = addParticipantsList.querySelector("tbody");

    const newRow = document.createElement("tr");
    newRow.className = "user-card-row";
    newRow.dataset.uid = uid;
    newRow.innerHTML = `
      <td class="p-2 cursor-pointer hover:bg-input-border transition-colors">
        <div class="flex items-center gap-2">
          <img src="${profile.photoURL}" alt="${profile.displayName}" class="w-6 h-6 rounded-full object-cover" onerror="this.src='${DEFAULT_PROFILE_PIC}'">
          <span class="font-medium text-sm">${escapeHtml(profile.displayName)}</span>
        </div>
      </td>
      <td class="p-2 text-sm text-text-secondary cursor-pointer hover:bg-input-border transition-colors">
        @${escapeHtml(profile.handle)}
      </td>
    `;

    tbody.appendChild(newRow);

    // Add click handler to new row
    newRow.addEventListener("click", () => {
      addParticipantToGroup(uid, profile);
      newRow.remove();
    });
  }
}

/**
 * Handle add participant input for suggestions
 */
function handleAddParticipantInput(event, availableUsers) {
  const input = event.target;
  const value = input.value.trim();
  const suggestionsContainer = document.getElementById(
    "add-participant-suggestions",
  );

  if (!value || value.length < 1) {
    suggestionsContainer.style.display = "none";
    return;
  }

  const searchTerm = value.replace(/^@/, "").toLowerCase();
  const filteredProfiles = availableUsers
    .filter((profile) => {
      const uname = profile.displayName.trim().toLowerCase();
      const handle = profile.handle.toLowerCase();
      return uname.includes(searchTerm) || handle.includes(searchTerm);
    })
    .slice(0, 5);

  if (filteredProfiles.length === 0) {
    suggestionsContainer.style.display = "none";
    return;
  }

  suggestionsContainer.innerHTML = filteredProfiles
    .map(
      (profile) => `
    <div class="handle-suggestion" data-uid="${profile.uid}">
      <img src="${profile.photoURL}" alt="${profile.displayName}" class="w-6 h-6 rounded-full object-cover mr-2" onerror="this.src='${DEFAULT_PROFILE_PIC}'">
      <div class="suggestion-info">
        <div class="suggestion-name text-sm">${escapeHtml(profile.displayName)}</div>
      </div>
    </div>
  `,
    )
    .join("");

  suggestionsContainer.style.display = "block";

  suggestionsContainer
    .querySelectorAll(".handle-suggestion")
    .forEach((suggestion) => {
      suggestion.addEventListener("click", () => {
        const uid = suggestion.dataset.uid;
        const profile = availableUsers.find((p) => p.uid === uid);
        if (profile) {
          addParticipantToGroup(uid, profile);
          input.value = "";
          suggestionsContainer.style.display = "none";

          // Remove from available users list
          const availableRow = document.querySelector(
            `#add-participants-list [data-uid="${uid}"]`,
          );
          if (availableRow) availableRow.remove();
        }
      });
    });
}

/**
 * Handle add participant keydown events
 */
function handleAddParticipantKeydown(event, availableUsers) {
  if (event.key === "Enter") {
    event.preventDefault();
    const input = event.target;
    const value = input.value.trim();
    if (value) {
      const searchTerm = value.replace(/^@/, "").toLowerCase();
      const profile = availableUsers.find(
        (p) =>
          p.displayName.trim().toLowerCase() === searchTerm ||
          p.handle.toLowerCase() === searchTerm,
      );

      if (profile) {
        addParticipantToGroup(profile.uid, profile);
        input.value = "";
        document.getElementById("add-participant-suggestions").style.display =
          "none";

        // Remove from available users list
        const availableRow = document.querySelector(
          `#add-participants-list [data-uid="${profile.uid}"]`,
        );
        if (availableRow) availableRow.remove();
      } else {
        showMessageBox(`User not found. Please select from suggestions.`, true);
      }
    }
  }
}

/**
 * Creates a new conversation (private or group chat) in Firestore.
 * @param {string} type - 'private' or 'group'.
 * @param {string[]} participantHandles - Handles of all participants (including current user for groups).
 * @param {string} [groupName=''] - Optional name for group chats.
 * @param {string} [groupImage=''] - Optional image URL for group chats.
 * @param {string} [privateName=''] - Optional name for private chats.
 * @param {string} [privateImage=''] - Optional image URL for private chats.
 */
export async function createConversation(
  type,
  participantHandles,
  groupName = "",
  groupImage = "",
  privateName = "",
  privateImage = "",
) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !currentUser.uid || !currentUser.handle) {
    showMessageBox(
      "You must be logged in and have a handle to start a chat.",
      true,
    );
    return;
  }
  if (!db) {
    showMessageBox("Database not initialized. Cannot create chat.", true);
    return;
  }

  // Use selected recipients if available, otherwise fall back to participantHandles
  let participantUids = [];

  if (selectedRecipients.size > 0) {
    // Use selected recipients
    participantUids = Array.from(selectedRecipients.keys());
  } else {
    // Fall back to old method with handle resolution
    const uniqueParticipantHandles = new Set(
      participantHandles.map((h) =>
        sanitizeHandle(h.startsWith("@") ? h.substring(1) : h),
      ),
    );
    uniqueParticipantHandles.add(currentUser.handle);
    participantUids = await resolveHandlesToUids(
      Array.from(uniqueParticipantHandles),
    );
  }

  // Add current user to participants
  if (!participantUids.includes(currentUser.uid)) {
    participantUids.push(currentUser.uid);
  }

  if (participantUids.length === 0) {
    showMessageBox(
      "Please provide at least one valid participant handle.",
      true,
    );
    return;
  }

  // Specific validation for private chat (can be self-DM or 1-to-1 with another user)
  if (type === "private") {
    if (participantUids.length > 2) {
      showMessageBox(
        "Private chats can only have yourself and/or one other participant.",
        true,
      );
      return;
    }
  }
  // Group chat must have at least 2 distinct participants (including self)
  else if (type === "group" && participantUids.length < 2) {
    showMessageBox(
      "Group chats require at least two participants (including yourself).",
      true,
    );
    return;
  }

  // Use the correct path structure for conversations
  const conversationsCol = collection(
    db,
    `artifacts/arcator-web/users/${currentUser.uid}/dms`,
  );

  const conversationData = {
    type: type,
    participants: participantUids.sort(), // Store sorted UIDs for consistency
    name:
      type === "group"
        ? groupName.trim() || "Unnamed Group"
        : privateName.trim() || "",
    createdAt: serverTimestamp(),
    createdBy: currentUser.uid,
    lastMessageAt: serverTimestamp(), // Initialize with creation time
    lastMessageContent:
      type === "private"
        ? "Chat started"
        : `${currentUser.handle} started the group chat.`,
    lastMessageSenderHandle: currentUser.handle,
    lastMessageSenderId: currentUser.uid,
  };

  // Add image if provided (for both group and private chats)
  if (type === "group" && groupImage.trim()) {
    conversationData.groupImage = groupImage.trim();
  } else if (type === "private" && privateImage.trim()) {
    conversationData.privateImage = privateImage.trim();
  }

  try {
    const newConvRef = await addDoc(conversationsCol, conversationData);

    // Add initial server message with proper formatting
    const messagesCol = collection(
      db,
      `artifacts/arcator-web/users/${currentUser.uid}/dms/${newConvRef.id}/messages`,
    );

    // Get recipient names for the message
    let recipientNames = [];
    if (selectedRecipients.size > 0) {
      recipientNames = Array.from(selectedRecipients.values()).map(
        (profile) => profile.displayName || profile.handle || "Unknown User",
      );
    }

    const currentTime = new Date().toLocaleString();
    let serverMessageContent = "";

    if (type === "private") {
      if (recipientNames.length > 0) {
        serverMessageContent = `@${currentUser.handle} created chat with ${recipientNames.join(", ")} started ${currentTime}`;
      } else {
        serverMessageContent = `@${currentUser.handle} created self chat started ${currentTime}`;
      }

      const serverMessageData = {
        createdBy: "system",
        creatorDisplayName: "System",
        content: serverMessageContent,
        createdAt: serverTimestamp(),
        isServerMessage: true,
      };

      await addDoc(messagesCol, serverMessageData);
    }

    showMessageBox(`New ${type} chat created successfully!`, false);
    console.log(`[DM] Success: Created ${type} chat (id: ${newConvRef.id})`);

    // Clear form and selected recipients
    clearCreateConversationForm();

    // Automatically select the new conversation
    const newConvSnap = await getDoc(newConvRef);
    if (newConvSnap.exists()) {
      selectConversation(newConvRef.id, newConvSnap.data());
    }
  } catch (error) {
    console.error(`[DM] Failed to create ${type} chat:`, error);
    showMessageBox(`Error creating chat: ${error.message}`, true);
  }
}

/**
 * Clear the create conversation form
 */
function clearCreateConversationForm() {
  const createForm = document.getElementById("create-conversation-form");
  if (createForm) createForm.reset();
  selectedRecipients.clear();
  renderRecipients("private");
  renderRecipients("group");
  renderUserCardList("private");
  renderUserCardList("group");
  document.getElementById("private-chat-suggestions").style.display = "none";
  document.getElementById("group-chat-suggestions").style.display = "none";
  const privateFields = document.getElementById("private-chat-fields");
  const groupFields = document.getElementById("group-chat-fields");
  if (privateFields) privateFields.classList.remove("hidden");
  if (groupFields) groupFields.classList.add("hidden");

  // Clear group image field
  const groupImageInput = document.getElementById("group-chat-image");
  if (groupImageInput) groupImageInput.value = "";

  // Clear private chat fields
  const privateNameInput = document.getElementById("private-chat-name");
  const privateImageInput = document.getElementById("private-chat-image");
  if (privateNameInput) privateNameInput.value = "";
  if (privateImageInput) privateImageInput.value = "";
}

/**
 * Renders the list of conversations for the current user.
 * Subscribes to real-time updates and shows messages inline.
 */
export function renderConversationsList() {
  const conversationsListEl = document.getElementById("conversations-list");
  const noConversationsEl = document.getElementById("no-conversations-message");
  const chatDropdownEl = document.getElementById("selected-chat-dropdown");

  if (!conversationsListEl) return;

  if (!allConversations || allConversations.length === 0) {
    conversationsListEl.innerHTML = "";
    if (noConversationsEl) noConversationsEl.style.display = "block";
    if (chatDropdownEl) {
      chatDropdownEl.innerHTML =
        '<option value="">Select a conversation...</option>';
    }
    return;
  }

  if (noConversationsEl) noConversationsEl.style.display = "none";

  try {
    // Sort conversations based on current sort option
    const sortBy =
      document.getElementById("sort-conversations-by")?.value ||
      "lastMessageAt_desc";
    const [sortField, sortDirection] = sortBy.split("_");

    const sortedConversations = [...allConversations].sort((a, b) => {
      const getDisplayNameForSorting = (conv) => {
        if (conv.type === "group") {
          return conv.name || "Unnamed Group";
        } else {
          // For private chats, prioritize custom name, then otherUsername
          return conv.name || conv.otherUsername || "Unknown User";
        }
      };

      let aVal, bVal;

      switch (sortField) {
        case "lastMessageAt":
          aVal =
            a.lastMessageAt?.toDate?.() ||
            a.lastMessageAt ||
            a.createdAt?.toDate?.() ||
            a.createdAt ||
            0;
          bVal =
            b.lastMessageAt?.toDate?.() ||
            b.lastMessageAt ||
            b.createdAt?.toDate?.() ||
            b.createdAt ||
            0;
          break;
        case "createdAt":
          aVal = a.createdAt?.toDate?.() || a.createdAt || 0;
          bVal = b.createdAt?.toDate?.() || b.createdAt || 0;
          break;
        case "otherUsername":
          aVal = getDisplayNameForSorting(a).toLowerCase();
          bVal = getDisplayNameForSorting(b).toLowerCase();
          break;
        case "groupName":
          aVal = (a.name || "Unnamed Group").toLowerCase();
          bVal = (b.name || "Unnamed Group").toLowerCase();
          break;
        default:
          aVal =
            a.lastMessageAt?.toDate?.() ||
            a.lastMessageAt ||
            a.createdAt?.toDate?.() ||
            a.createdAt ||
            0;
          bVal =
            b.lastMessageAt?.toDate?.() ||
            b.lastMessageAt ||
            b.createdAt?.toDate?.() ||
            b.createdAt ||
            0;
      }

      if (sortDirection === "desc") {
        return aVal > bVal ? -1 : 1;
      } else {
        return aVal < bVal ? -1 : 1;
      }
    });

    // Update chat dropdown
    if (chatDropdownEl) {
      chatDropdownEl.innerHTML =
        '<option value="">Select a conversation...</option>' +
        sortedConversations
          .map((conv) => {
            const displayName =
              conv.type === "group"
                ? conv.name || "Unnamed Group"
                : conv.name || conv.otherUsername || "Unknown User";
            return `<option value="${conv.id}">${escapeHtml(displayName)}</option>`;
          })
          .join("");

      // Set selected value if there's a current conversation
      if (selectedConversationId) {
        chatDropdownEl.value = selectedConversationId;
      }
    }

    // Render as table with actions
    conversationsListEl.innerHTML = `
      <table class="w-full border-collapse">
        <thead>
          <tr class="border-b border-input-border">
            <th class="text-left p-1 font-semibold text-xs">Conversation</th>
            <th class="text-right p-1 font-semibold text-xs">Last Message</th>
            <th class="text-center p-1 font-semibold text-xs w-16">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${sortedConversations
            .map((conv) => {
              const isActive = selectedConversationId === conv.id;
              const displayName =
                conv.type === "group"
                  ? conv.name || "Unnamed Group"
                  : conv.name || conv.otherUsername || "Unknown User";
              const lastMessageTime = conv.lastMessageAt
                ? new Date(
                    conv.lastMessageAt.toDate?.() || conv.lastMessageAt,
                  ).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "No messages";

              // Get conversation avatar
              let avatarUrl = DEFAULT_PROFILE_PIC;
              if (conv.type === "group") {
                avatarUrl =
                  conv.groupImage ||
                  "https://placehold.co/40x40/1F2937/E5E7EB?text=GC";
              } else {
                avatarUrl =
                  conv.privateImage ||
                  conv.otherUserAvatar ||
                  DEFAULT_PROFILE_PIC;
              }

              return `
              <tr class="conversation-row${isActive ? " active" : ""}" data-conversation-id="${conv.id}" style="height:32px;min-height:32px;">
                <td class="p-1 cursor-pointer hover:bg-input-border transition-colors align-middle" style="vertical-align:middle;">
                  <div class="flex items-center gap-1" style="min-height:24px;">
                    <img src="${avatarUrl}" alt="${escapeHtml(displayName)}" class="w-6 h-6 rounded-full object-cover" style="width:24px;height:24px;min-width:24px;min-height:24px;max-width:24px;max-height:24px;" onerror="this.src='${DEFAULT_PROFILE_PIC}'">
                    <div class="flex-1 flex items-center gap-1">
                      <span class="font-medium text-xs">${escapeHtml(displayName)}</span>
                      ${conv.type === "group" ? '<span class="text-xs ml-1" style="font-size:1.1em;">👥</span>' : ""}
                    </div>
                  </div>
                </td>
                <td class="p-1 text-xs text-text-secondary text-right align-middle" style="vertical-align:middle;">${lastMessageTime}</td>
                <td class="p-1 text-center align-middle" style="vertical-align:middle;">
                  <div class="flex items-center justify-center gap-1">
                    <button class="edit-conversation-btn p-0.5 rounded hover:bg-input-border transition-colors"
                            data-conversation-id="${conv.id}"
                            data-conversation-type="${conv.type}"
                            data-current-name="${escapeHtml(displayName)}"
                            title="Edit conversation name">
                      ✏️
                    </button>
                    <button class="delete-conversation-btn p-0.5 rounded hover:bg-red-500 hover:text-white transition-colors"
                            data-conversation-id="${conv.id}"
                            title="Delete conversation">
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            `;
            })
            .join("")}
        </tbody>
      </table>
    `;

    // Add click handlers to conversation rows
    conversationsListEl.querySelectorAll(".conversation-row").forEach((row) => {
      row.addEventListener("click", (event) => {
        // Don't trigger if clicking on action buttons
        if (
          event.target.closest(".edit-conversation-btn") ||
          event.target.closest(".delete-conversation-btn")
        ) {
          return;
        }

        const convId = row.dataset.conversationId;
        const conversation = allConversations.find((c) => c.id === convId);
        if (conversation) {
          selectConversation(convId, conversation);
        }
      });
    });

    // Add edit conversation handlers
    conversationsListEl
      .querySelectorAll(".edit-conversation-btn")
      .forEach((btn) => {
        btn.addEventListener("click", (event) => {
          event.stopPropagation();
          const convId = btn.dataset.conversationId;
          const convType = btn.dataset.conversationType;
          const currentName = btn.dataset.currentName;
          openEditConversationModal(convId, convType, currentName);
        });
      });

    // Add delete conversation handlers
    conversationsListEl
      .querySelectorAll(".delete-conversation-btn")
      .forEach((btn) => {
        btn.addEventListener("click", (event) => {
          event.stopPropagation();
          const convId = btn.dataset.conversationId;
          deleteConversation(convId);
        });
      });

    // Auto-select first conversation if none is currently selected
    if (!selectedConversationId && sortedConversations.length > 0) {
      const firstConversation = sortedConversations[0];
      console.log(
        "Auto-selecting first conversation from render:",
        firstConversation.id,
      );
      selectConversation(firstConversation.id, firstConversation);
    }
  } catch (error) {
    console.error("Error rendering conversations list:", error);
    conversationsListEl.innerHTML =
      '<div class="error">Error loading conversations</div>';
  }
}

/**
 * Selects a conversation, loads its messages, and updates the right panel UI.
 * Handles self-DMs, group DMs, and missing user profiles gracefully.
 * Always renders inline, never crashes.
 * @param {string} convId - The ID of the conversation to select.
 * @param {object} conversationData - The conversation object data.
 */
export async function selectConversation(convId, conversationData) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !convId) {
    console.error("No current user or conversation ID for selection.");
    return;
  }

  console.log("[DEBUG] selectConversation called with:", {
    convId,
    conversationData,
  });
  selectedConversationId = convId;

  // Update chat dropdown to reflect the selected conversation
  const chatDropdown = document.getElementById("selected-chat-dropdown");
  if (chatDropdown) {
    chatDropdown.value = convId;
  }

  // Update conversation header
  const conversationTitleEl = document.getElementById("conversation-title");
  const conversationSubtitleEl = document.getElementById(
    "conversation-subtitle",
  );
  const conversationAvatarEl = document.getElementById("conversation-avatar");
  const deleteConversationBtn = document.getElementById(
    "delete-conversation-btn",
  );

  // Default values
  let displayName = "Unknown Conversation";
  let subtitle = "Loading...";
  let avatarUrl = DEFAULT_PROFILE_PIC;

  try {
    if (conversationData) {
      if (conversationData.type === "group") {
        displayName = conversationData.name || "Unnamed Group";
        subtitle = `${conversationData.participants?.length || 0} members`;
        avatarUrl =
          conversationData.groupImage ||
          "https://placehold.co/40x40/1F2937/E5E7EB?text=GC";
      } else {
        // Private chat - use set title if present, else fallback to other user
        if (conversationData.name && conversationData.name.trim() !== "") {
          displayName = conversationData.name;
          // Show the other user's handle as subtitle if possible
          const otherUid = conversationData.participants?.find(
            (uid) => uid !== currentUser.uid,
          );
          if (otherUid) {
            try {
              const otherProfile = await getUserProfileFromFirestore(otherUid);
              subtitle =
                otherProfile && otherProfile.handle
                  ? `@${otherProfile.handle}`
                  : "User";
              avatarUrl =
                conversationData.privateImage ||
                (otherProfile && otherProfile.photoURL
                  ? otherProfile.photoURL
                  : DEFAULT_PROFILE_PIC);
            } catch {
              subtitle = "User";
              avatarUrl = conversationData.privateImage || DEFAULT_PROFILE_PIC;
            }
          } else {
            subtitle = currentUser.handle
              ? `@${currentUser.handle}`
              : "Your personal chat";
            avatarUrl =
              conversationData.privateImage ||
              currentUser.photoURL ||
              DEFAULT_PROFILE_PIC;
          }
        } else {
          // Fallback to other user's profile
          const otherUid = conversationData.participants?.find(
            (uid) => uid !== currentUser.uid,
          );
          if (otherUid) {
            try {
              const otherProfile = await getUserProfileFromFirestore(otherUid);
              displayName =
                otherProfile.displayName ||
                otherProfile.handle ||
                "Unknown User";
              subtitle = otherProfile.handle
                ? `@${otherProfile.handle}`
                : "User";
              avatarUrl =
                conversationData.privateImage ||
                otherProfile.photoURL ||
                DEFAULT_PROFILE_PIC;
            } catch (error) {
              displayName = "Unknown User";
              subtitle = "User not found";
              avatarUrl = conversationData.privateImage || DEFAULT_PROFILE_PIC;
            }
          } else {
            // Self-DM: always show the chat interface inline
            displayName =
              currentUser.displayName || currentUser.handle || "You";
            subtitle = currentUser.handle
              ? `@${currentUser.handle}`
              : "Your personal chat";
            avatarUrl =
              conversationData.privateImage ||
              currentUser.photoURL ||
              DEFAULT_PROFILE_PIC;
          }
        }
      }
    }
  } catch (error) {
    displayName = "Unknown Conversation";
    subtitle = "Error loading conversation";
    avatarUrl = DEFAULT_PROFILE_PIC;
  }

  // Teams-style chat header
  if (conversationTitleEl) {
    conversationTitleEl.innerHTML = `
      <div class="conversation-title flex items-center gap-3">
        <img src="${avatarUrl}" alt="${displayName}" class="w-8 h-8 rounded-full object-cover" onerror="this.src='${DEFAULT_PROFILE_PIC}'">
        <div class="flex flex-col">
          <span class="font-bold text-lg">${escapeHtml(displayName)}</span>
          <span class="text-sm text-text-secondary">${escapeHtml(subtitle)}</span>
        </div>
      </div>
    `;
  }
  if (conversationAvatarEl) {
    conversationAvatarEl.src = avatarUrl;
    conversationAvatarEl.alt = displayName;
    conversationAvatarEl.onerror = () => {
      conversationAvatarEl.src = DEFAULT_PROFILE_PIC;
    };
  }

  // Show delete button for conversations the user can delete
  if (deleteConversationBtn) {
    deleteConversationBtn.style.display = "block";
    deleteConversationBtn.dataset.conversationId = convId;
  }

  // Update active conversation styling
  document.querySelectorAll(".conversation-row").forEach((row) => {
    row.classList.remove("active");
  });
  const activeConversationRow = document.querySelector(
    `[data-conversation-id="${convId}"]`,
  );
  if (activeConversationRow) {
    activeConversationRow.classList.add("active");
  }

  // Load and render messages
  await loadMessagesForConversation(convId);
}

/**
 * Update UI when no conversation is selected
 */
export function updateDmUiForNoConversationSelected() {
  selectedConversationId = null;

  // Update chat dropdown to show no selection
  const chatDropdown = document.getElementById("selected-chat-dropdown");
  if (chatDropdown) {
    chatDropdown.value = "";
  }

  // Clear active conversation styling
  document.querySelectorAll(".conversation-row").forEach((row) => {
    row.classList.remove("active");
  });

  // Clear messages
  currentMessages = [];
  const messagesContainer = document.getElementById(
    "conversation-messages-container",
  );
  if (messagesContainer) {
    messagesContainer.innerHTML = "";
  }

  // Hide delete button
  const deleteConversationBtn = document.getElementById(
    "delete-conversation-btn",
  );
  if (deleteConversationBtn) {
    deleteConversationBtn.style.display = "none";
  }
}

/**
 * Renders messages for a specific conversation in real-time.
 * Always renders inline, never crashes, even if data is missing.
 * @param {string} convId - The ID of the conversation whose messages to render.
 */
async function renderConversationMessages(convId) {
  const messagesContainer = document.getElementById(
    "conversation-messages-container",
  );
  const noMessagesEl = document.getElementById("no-messages-message");

  if (!messagesContainer) return;
  if (!currentMessages || currentMessages.length === 0) {
    messagesContainer.innerHTML = "";
    if (noMessagesEl) noMessagesEl.style.display = "block";
    return;
  }
  if (noMessagesEl) noMessagesEl.style.display = "none";

  const currentUser = await getCurrentUser();
  if (!currentUser) return;

  // Helper: render content with emoji, media, and line breaks
  function renderContent(text) {
    if (!text) return "";

    // Create a temporary element to render into
    const tempDiv = document.createElement("div");
    renderMarkdownWithMedia(text, tempDiv);
    return tempDiv.innerHTML;
  }

  messagesContainer.innerHTML = currentMessages
    .map((message) => {
      if (message.isServerMessage) {
        return `
        <div class="server-message text-center text-xs py-2 text-text-secondary">🔧 ${escapeHtml(message.content)}</div>
      `;
      }
      const isOwn = message.createdBy === currentUser.uid;
      let senderName =
        message.senderProfile?.displayName ||
        message.creatorDisplayName ||
        "Unknown";
      let senderAvatar = message.senderProfile?.photoURL || DEFAULT_PROFILE_PIC;
      const sentTime = message.timestamp
        ? new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "";
      let updatedTime = "";
      if (message.updatedAt) {
        const updatedDate = message.updatedAt.toDate
          ? message.updatedAt.toDate()
          : message.updatedAt;
        updatedTime = new Date(updatedDate).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
      } else if (message.editedAt) {
        const editedDate = message.editedAt.toDate
          ? message.editedAt.toDate()
          : message.editedAt;
        updatedTime = new Date(editedDate).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
      }
      const editedIndicator = message.isEdited
        ? ' <span class="text-xs text-blue-400">(edited)</span>'
        : "";
      const align = isOwn ? "justify-end" : "justify-start";
      const bubbleClass = isOwn
        ? "dm-bubble-out bg-blue-600 text-white ml-auto"
        : "dm-bubble-in bg-card text-text-primary mr-auto";
      const shadow = "shadow-md";
      return `
      <div class="flex ${align} mb-2">
        <div class="flex flex-col max-w-full w-fit">
          <div class="${bubbleClass} ${shadow} px-4 py-2 rounded-2xl relative min-w-[120px] max-w-full">
            <div class="flex items-center gap-1 mb-1">
              <img src="${senderAvatar}" alt="${escapeHtml(senderName)}" class="w-5 h-5 rounded-full object-cover" onerror="this.src='${DEFAULT_PROFILE_PIC}'">
              <span class="text-[11px] text-text-secondary">${escapeHtml(senderName)}</span>
              ${isOwn ? `<span class="flex ml-auto gap-1">
                <button class="edit-message-btn text-xs ml-2" data-message-id="${message.id}" title="Edit">✏️</button>
                <button class="delete-message-btn text-xs ml-1" data-message-id="${message.id}" title="Delete">🗑️</button>
              </span>` : ""}
            </div>
            <div class="message-content text-base">${renderContent(message.content)}</div>
          </div>
          <div class="flex items-center gap-2 mt-1 text-xs text-text-secondary ${isOwn ? "justify-end" : ""}">
            <span>${sentTime}</span>
            ${updatedTime && updatedTime !== sentTime ? `<span class="text-blue-400">Updated: ${updatedTime}</span>` : ""}
            ${editedIndicator}
          </div>
        </div>
      </div>
    `;
    })
    .join("");
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  messagesContainer.querySelectorAll(".delete-message-btn").forEach((btn) => {
    btn.addEventListener("click", handleDeleteMessage);
  });
  messagesContainer.querySelectorAll(".edit-message-btn").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      const messageId = event.target.dataset.messageId;
      if (messageId) openEditMessageModal(messageId);
    });
  });
}

/**
 * Sends a message within the currently selected conversation.
 * Also updates the parent conversation's last message info.
 * @param {string} content - The message content.
 */
export async function sendMessage(content) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !currentUser.uid || !currentUser.handle) {
    showMessageBox(
      "You must be logged in and have a handle to send messages.",
      true,
    );
    return;
  }
  if (!db) {
    showMessageBox("Database not initialized. Cannot send message.", true);
    return;
  }
  if (content.trim() === "") {
    showMessageBox("Message cannot be empty.", true);
    return;
  }

  // Get the selected conversation from the dropdown
  const chatDropdown = document.getElementById("selected-chat-dropdown");
  const selectedChatId = chatDropdown?.value;

  if (!selectedChatId) {
    showMessageBox(
      "Please select a conversation to send the message to.",
      true,
    );
    return;
  }

  // Find the selected conversation
  const targetConversation = allConversations.find(
    (conv) => conv.id === selectedChatId,
  );
  if (!targetConversation) {
    showMessageBox("Selected conversation not found. Please try again.", true);
    return;
  }

  // Use the correct path structure for messages
  const messagesCol = collection(
    db,
    `artifacts/arcator-web/users/${currentUser.uid}/dms/${selectedChatId}/messages`,
  );
  const conversationDocRef = doc(
    db,
    `artifacts/arcator-web/users/${currentUser.uid}/dms`,
    selectedChatId,
  );

  // Get current user's complete profile data to embed in the message
  let userProfile = null;
  try {
    userProfile = await getUserProfileFromFirestore(currentUser.uid);
  } catch (error) {
    console.warn("Could not fetch user profile for message:", error);
  }

  // Use the most reliable source for each field
  const senderProfile = {
    uid: currentUser.uid,
    handle: currentUser.handle,
    displayName:
      userProfile?.displayName ||
      currentUser.displayName ||
      currentUser.handle ||
      "Unknown User",
    photoURL:
      userProfile?.photoURL || currentUser.photoURL || DEFAULT_PROFILE_PIC,
    username:
      userProfile?.displayName ||
      currentUser.displayName ||
      currentUser.handle ||
      "Unknown User",
  };

  const messageData = {
    createdBy: currentUser.uid,
    creatorDisplayName: senderProfile.displayName,
    content: content,
    createdAt: serverTimestamp(),
    // Embed complete sender profile data in the message
    senderProfile: senderProfile,
  };

  try {
    await addDoc(messagesCol, messageData);
    // Update the parent conversation with last message info
    await updateDoc(conversationDocRef, {
      lastMessageAt: serverTimestamp(),
      lastMessageContent: content,
      lastMessageSenderHandle: currentUser.handle,
      lastMessageSenderId: currentUser.uid,
    });

    // Clear the input
    const messageInput = document.getElementById("message-content-input");
    if (messageInput) messageInput.value = "";

    showMessageBox("Message sent!", false);

    // If the selected conversation is not currently displayed, select it
    if (selectedConversationId !== selectedChatId) {
      selectConversation(selectedChatId, targetConversation);
    }
  } catch (error) {
    console.error("Error sending message:", error);
    showMessageBox(`Error sending message: ${error.message}`, true);
  }
}

/**
 * Deletes a specific message from the current conversation.
 * @param {string} messageId - The ID of the message to delete.
 */
export async function deleteMessage(messageId) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !currentUser.uid || !selectedConversationId) {
    showMessageBox(
      "Cannot delete message. User not logged in or no conversation selected.",
      true,
    );
    return;
  }
  if (!db) {
    showMessageBox("Database not initialized. Cannot delete message.", true);
    return;
  }

  const confirmation = await showCustomConfirm(
    "Are you sure you want to delete this message?",
    "This message will be removed for everyone in this chat. This action cannot be undone.",
  );
  if (!confirmation) {
    showMessageBox("Message deletion cancelled.", false);
    return;
  }

  // Use the correct path structure for messages
  const messageDocRef = doc(
    db,
    `artifacts/arcator-web/users/${currentUser.uid}/dms/${selectedConversationId}/messages`,
    messageId,
  );
  try {
    await deleteDoc(messageDocRef);
    showMessageBox("Message deleted!", false);

    // Re-evaluate last message in conversation if the deleted one was the last
    const messagesCol = collection(
      db,
      `artifacts/arcator-web/users/${currentUser.uid}/dms/${selectedConversationId}/messages`,
    );
    const q = query(messagesCol, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q); // Use getDocs instead of onSnapshot for a one-time fetch here
    const conversationDocRef = doc(
      db,
      `artifacts/arcator-web/users/${currentUser.uid}/dms`,
      selectedConversationId,
    );

    if (!snapshot.empty) {
      const lastMsg = snapshot.docs[0].data();
      await updateDoc(conversationDocRef, {
        lastMessageAt: lastMsg.createdAt,
        lastMessageContent: lastMsg.content,
        lastMessageSenderHandle: currentUser.handle,
        lastMessageSenderId: currentUser.uid,
      });
    } else {
      await updateDoc(conversationDocRef, {
        lastMessageAt: null,
        lastMessageContent: "No messages yet.",
        lastMessageSenderHandle: "",
        lastMessageSenderId: "",
      });
    }
  } catch (error) {
    console.error("Error deleting message:", error);
    showMessageBox(`Error deleting message: ${error.message}`, true);
  }
}

/**
 * Edits a specific message in the current conversation.
 * @param {string} messageId - The ID of the message to edit.
 * @param {string} newContent - The new content for the message.
 */
export async function editMessage(messageId, newContent) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !currentUser.uid || !selectedConversationId) {
    showMessageBox(
      "Cannot edit message. User not logged in or no conversation selected.",
      true,
    );
    return;
  }
  if (!db) {
    showMessageBox("Database not initialized. Cannot edit message.", true);
    return;
  }
  if (!newContent.trim()) {
    showMessageBox("Message content cannot be empty.", true);
    return;
  }

  // Use the correct path structure for messages
  const messageDocRef = doc(
    db,
    `artifacts/arcator-web/users/${currentUser.uid}/dms/${selectedConversationId}/messages`,
    messageId,
  );
  try {
    await updateDoc(messageDocRef, {
      content: newContent.trim(),
      updatedAt: serverTimestamp(),
      isEdited: true,
    });
    showMessageBox("Message edited successfully!", false);
  } catch (error) {
    console.error("Error editing message:", error);
    showMessageBox(`Error editing message: ${error.message}`, true);
  }
}

/**
 * Opens the edit interface for a message.
 * @param {string} messageId - The ID of the message to edit.
 */
function openEditMessageModal(messageId) {
  const message = currentMessages.find((m) => m.id === messageId);
  if (!message) return;

  // Create modal HTML
  const modalHTML = `
    <div id="edit-message-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-card border border-input-border rounded-lg p-6 max-w-md w-full mx-4">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-bold">Edit Message</h3>
          <button class="close-edit-message-modal text-2xl hover:text-red-500 transition-colors">&times;</button>
        </div>

        <form id="edit-message-form" class="space-y-4">
          <div class="form-group">
            <label class="form-label" for="edit-message-content">Message</label>
            <textarea id="edit-message-content" class="form-input bg-card text-text-primary border-none rounded w-full"
                     rows="4" required>${escapeHtml(message.content)}</textarea>
          </div>

          <div class="flex gap-2">
            <button type="submit" class="btn-modern flex-1">Save Changes</button>
            <button type="button" class="btn-modern flex-1 close-edit-message-modal">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Add modal to page
  document.body.insertAdjacentHTML("beforeend", modalHTML);

  const modal = document.getElementById("edit-message-modal");
  const form = document.getElementById("edit-message-form");
  const closeButtons = modal.querySelectorAll(".close-edit-message-modal");

  // Close modal handlers
  closeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      modal.remove();
    });
  });

  // Close on outside click
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });

  // Form submission
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const newContent = document
      .getElementById("edit-message-content")
      .value.trim();

    if (!newContent) {
      showMessageBox("Message content cannot be empty.", true);
      return;
    }

    try {
      await editMessage(messageId, newContent);
      modal.remove();
    } catch (error) {
      console.error("Error editing message:", error);
      showMessageBox(`Error editing message: ${error.message}`, true);
    }
  });
}
