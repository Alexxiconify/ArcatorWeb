/* forms.js: Forum-specific functionality for thémata, threads, and comments */

// Import existing modules
import {
  auth,
  db,
  appId,
  getUserProfileFromFirestore,
  setUserProfileInFirestore,
} from "./firebase-init.js";
import { showMessageBox, showCustomConfirm } from "./utils.js";
import { loadFooter } from "./navbar.js";
import { renderMarkdownWithMedia, escapeHtml } from "./utils.js";

// Import Firebase functions
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  orderBy,
  addDoc,
  serverTimestamp,
  onSnapshot,
  getDocs,
  where,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// DOM elements
const createThemaForm = document.getElementById("create-thema-form");
const newThemaNameInput = document.getElementById("new-thema-name");
const newThemaDescriptionInput = document.getElementById(
  "new-thema-description",
);
const themaList = document.getElementById("thema-boxes");

// DM elements
const dmTabBtn = document.getElementById("tab-dms");
const dmTabContent = document.getElementById("dm-tab-content");
const themataTabContent = document.getElementById("thema-all-tab-content");

let unsubscribeThematas = null;

// DM Tab Functionality
let currentSortOption = "lastMessageAt_desc";

// Helper: get current user info
function getCurrentUserInfo() {
  if (window.currentUser) {
    return {
      uid: window.currentUser.uid,
      displayName: window.currentUser.displayName || "Anonymous",
      photoURL:
        window.currentUser.photoURL ||
        "https://placehold.co/32x32/1F2937/E5E7EB?text=AV",
      isAdmin: window.currentUser.isAdmin || false,
    };
  }
  if (auth.currentUser) {
    return {
      uid: auth.currentUser.uid,
      displayName: auth.currentUser.displayName || "Anonymous",
      photoURL:
        auth.currentUser.photoURL ||
        "https://placehold.co/32x32/1F2937/E5E7EB?text=AV",
      isAdmin: false,
    };
  }
  return { uid: null, displayName: "Anonymous", photoURL: "", isAdmin: false };
}

// Add new thema
async function addThema(name, description) {
  if (!auth.currentUser) {
    showMessageBox("You must be logged in to create a théma.", true);
    return;
  }
  if (!db) {
    showMessageBox("Database not initialized.", true);
    return;
  }

  try {
    const thematasCol = collection(
      db,
      `artifacts/${appId}/public/data/thematas`,
    );
    await addDoc(thematasCol, {
      name: name,
      description: description,
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser.uid,
      creatorDisplayName: window.currentUser
        ? window.currentUser.displayName
        : "Anonymous",
    });
    showMessageBox("Théma created successfully!", false);
    newThemaNameInput.value = "";
    newThemaDescriptionInput.value = "";
  } catch (error) {
    console.error("Error creating théma:", error);
    showMessageBox(`Error creating théma: ${error.message}`, true);
  }
}

// Render thémata with Reddit-style layout
function renderThematas() {
  if (unsubscribeThematas) unsubscribeThematas();
  if (!db) {
    themaList.innerHTML =
      '<li class="thema-item text-center text-red-400">Database not initialized.</li>';
    return;
  }

  const thematasCol = collection(db, `artifacts/${appId}/public/data/thematas`);
  const q = query(thematasCol, orderBy("createdAt", "desc"));

  unsubscribeThematas = onSnapshot(q, async (snapshot) => {
    themaList.innerHTML = "";
    if (snapshot.empty) {
      themaList.innerHTML =
        '<li class="thema-item text-center text-text-secondary">No thémata found.</li>';
      return;
    }

    snapshot.forEach((docSnap) => {
      const thema = docSnap.data();
      const themaId = docSnap.id;
      if (themaId === "temp-page-SQ1f81es7k4PMdS4f1pr") return; // Hide this temp page
      const li = document.createElement("li");
      li.className = "thema-item mb-6 p-4 bg-card rounded-lg shadow";

      const header = document.createElement("div");
      header.className = "flex items-center justify-between mb-2";

      const collapseBtn = document.createElement("span");
      collapseBtn.className = "collapse-btn";
      collapseBtn.innerHTML = `<svg class="chevron transition-transform duration-200 text-link" width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 8L10 12L14 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      collapseBtn.title = "Collapse/Expand Théma";
      collapseBtn.style.cursor = "pointer";
      collapseBtn.style.display = "inline-flex";
      collapseBtn.style.alignItems = "center";
      collapseBtn.style.marginRight = "4px";
      header.prepend(collapseBtn);

      const titleBox = document.createElement("div");
      titleBox.innerHTML = `
        <span class="font-bold text-lg">${escapeHtml(thema.name)}</span>
        <div class="thema-description text-text-secondary text-sm">${escapeHtml(thema.description)}</div>
      `;

      const actions = document.createElement("div");
      actions.className = "actions-right absolute top-2 right-2 flex gap-2 z-10";

      const editBtn = document.createElement("button");
      editBtn.className =
        "edit-themata-btn text-blue-400 hover:text-blue-300 p-1";
      editBtn.title = "Edit Themata";
      editBtn.innerHTML =
        '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>';
      editBtn.onclick = () => openEditThemaModal(themaId, thema);

      const delBtn = document.createElement("button");
      delBtn.className =
        "delete-themata-btn text-red-400 hover:text-red-300 p-1";
      delBtn.title = "Delete Themata";
      delBtn.innerHTML =
        '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>';
      delBtn.onclick = () => deleteThemaAndSubcollections(themaId);

      const canEditThema = (window.currentUser && (window.currentUser.isAdmin || window.currentUser.uid === thema.createdBy));
      if (canEditThema) {
        actions.append(editBtn, delBtn);
      }

      header.append(titleBox, actions);
      li.append(header);

      const threadsDiv = document.createElement("div");
      threadsDiv.id = `threads-for-${themaId}`;
      threadsDiv.className = "mt-2";
      li.append(threadsDiv);
      themaList.appendChild(li);

      loadThreadsForThema(themaId);
    });
  });
}

// Load threads for thema inline (real-time)
async function loadThreadsForThema(themaId) {
  if (!db) return;

  const threadsContainer = document.querySelector(`#threads-for-${themaId}`);
  if (!threadsContainer) return;

  // Remove previous listener if any
  if (threadsContainer._unsubscribeThreads) {
    threadsContainer._unsubscribeThreads();
    threadsContainer._unsubscribeThreads = null;
  }

  const threadsCol = collection(
    db,
    `artifacts/${appId}/public/data/thematas/${themaId}/threads`,
  );
  const q = query(threadsCol, orderBy("createdAt", "desc"));

  threadsContainer._unsubscribeThreads = onSnapshot(q, async (threadsSnapshot) => {
    let threadsHtml = [];
    threadsHtml.push(`
      <div class="create-thread-section mb-2">
        <button type="button" class="toggle-create-thread btn-primary btn-blue mb-2">＋ New Thread</button>
        <div class="create-thread-collapsible" style="display:none;">
          <form class="create-thread-form form-container flex flex-col md:flex-row items-center gap-2 p-2 bg-card rounded-lg shadow mb-2" data-thema-id="${themaId}" style="margin-bottom:0;">
            <input type="text" class="form-input flex-1 min-w-0 mb-0" placeholder="Thread title" required style="margin-bottom:0; min-width:120px;" />
            <textarea class="form-input flex-1 min-w-0 mb-0" placeholder="Initial comment" rows="1" required style="margin-bottom:0; min-width:120px; resize:vertical;" ></textarea>
            <button type="submit" class="btn-primary btn-blue ml-0" style="margin-bottom:0;">Create</button>
          </form>
        </div>
      </div>
    `);
    if (threadsSnapshot.empty) {
      threadsHtml.push(
        '<div class="no-threads">No threads yet. Be the first to start one!</div>',
      );
    } else {
      threadsHtml.push('<div class="threads-list space-y-3">');
      for (const threadDoc of threadsSnapshot.docs) {
        const thread = threadDoc.data();
        const createdAt = thread.createdAt
          ? new Date(thread.createdAt.toDate()).toLocaleString()
          : "N/A";
        let userProfile = {
          displayName: thread.creatorDisplayName || "Anonymous",
          photoURL: null,
        };
        if (thread.createdBy) {
          try {
            userProfile =
              (await getUserProfileFromFirestore(thread.createdBy)) ||
              userProfile;
          } catch {}
        }
        const photoURL =
          userProfile.photoURL ||
          "https://placehold.co/32x32/1F2937/E5E7EB?text=AV";
        const canEditThread = (window.currentUser && (window.currentUser.isAdmin || window.currentUser.uid === thread.createdBy));
        const threadCollapseBtn = `<span class="collapse-btn" title="Collapse/Expand Thread" style="min-width:24px;min-height:24px;"><svg class="chevron transition-transform duration-200 text-link" width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 8L10 12L14 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
        threadsHtml.push(`
          <div class="thread-header flex items-center gap-3 bg-card text-text-primary" data-thread-id="${threadDoc.id}" style="position:relative;">
            <img src="${photoURL}" alt="User" class="w-8 h-8 rounded-full object-cover mr-2" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">
            <div class="flex flex-col justify-center flex-1">
              <div class="flex items-center w-full">
                <span class="text-xs text-text-secondary">${escapeHtml(userProfile.displayName || "Anonymous")} <span class="text-10 text-link text-text-primary ml-1">@${escapeHtml(userProfile.handle || "user")}</span></span>
                <div class="flex gap-2 ml-auto">
                  ${canEditThread ? `
                    <button class="edit-thread-btn btn-primary btn-blue" title="Edit Thread">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                      </svg>
                    </button>
                    <button class="delete-thread-btn btn-primary btn-red" title="Delete Thread">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                      </svg>
                    </button>
                  ` : ""}
                </div>
              </div>
              <span class="font-bold text-lg leading-tight mb-0.5">${escapeHtml(thread.title)}</span>
              <p class="comment-content text-sm mt-1 mb-0">${renderContent(thread.initialComment)}</p>
              <div class="flex items-center justify-between mt-1 w-full">
                <div class="reactions-bar">${renderReactionButtons(thread.reactions, themaId, threadDoc.id)}</div>
                <span class="meta-info text-xs ml-4" style="margin-left:auto;">${createdAt}</span>
              </div>
            </div>
          </div>
          <div class="thread-comments" data-thread-id="${threadDoc.id}"></div>
        `);
      }
      threadsHtml.push("</div>");
    }
    threadsContainer.innerHTML = threadsHtml.join("");
    // Load comments for each thread
    for (const threadDoc of threadsSnapshot.docs) {
      await loadCommentsForThread(themaId, threadDoc.id);
    }
    setupThreadEventListeners(themaId);
  });
}

// --- Helper: Build comment tree by parentId ---
function buildCommentTree(comments) {
  const map = new Map();
  const roots = [];
  comments.forEach(c => {
    c.children = [];
    map.set(c.id, c);
  });
  comments.forEach(c => {
    if (c.parentId) {
      const parent = map.get(c.parentId);
      if (parent) parent.children.push(c);
      else roots.push(c); // orphaned
    } else {
      roots.push(c);
    }
  });
  return roots;
}

// --- Recursive render ---
function renderCommentTree(comments, level, themaId, threadId) {
  return comments.map(c => {
    const canEdit = window.currentUser && (window.currentUser.isAdmin || window.currentUser.uid === c.createdBy);
    const photoURL = c.photoURL || "https://placehold.co/32x32/1F2937/E5E7EB?text=AV";
    return `
      <div class="thread-header flex items-center gap-3 bg-card text-text-primary ml-${level * 4} border-l-2 border-gray-700" data-comment-id="${c.id}" style="position:relative;">
        <div class="actions-right absolute top-2 right-2 flex gap-2 z-10">
          ${canEdit ? `
            <button class="edit-comment-btn btn-primary btn-blue" title="Edit Comment">...</button>
            <button class="delete-comment-btn btn-primary btn-red" title="Delete Comment">...</button>
          ` : ""}
        </div>
        <img src="${photoURL}" alt="User" class="w-8 h-8 rounded-full object-cover mr-2" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">
        <div class="flex flex-col justify-center flex-1">
          <span class="text-xs text-text-secondary">${escapeHtml(c.displayName || "Anonymous")} <span class="text-[10px] text-link text-text-primary ml-1">@${escapeHtml(c.handle || "user")}</span></span>
          <p class="comment-content text-sm mt-1 mb-0">${renderContent(c.content)}</p>
          <div class="flex items-center justify-between mt-1 w-full">
            <div class="reactions-bar">${renderReactionButtons(c.reactions, themaId, threadId, c.id)}</div>
            <span class="meta-info text-xs ml-4" style="margin-left:auto;">${c.createdAt}</span>
          </div>
          <div class="flex gap-2 mt-1">
            <button class="reply-comment-btn btn-primary btn-blue text-xs" data-comment-id="${c.id}">Reply</button>
            <div class="reply-form-container" id="reply-form-${c.id}" style="display:none;"></div>
          </div>
          ${c.children && c.children.length ? renderCommentTree(c.children, level + 1, themaId, threadId) : ''}
        </div>
      </div>
    `;
  }).join('');
}

// --- Update loadCommentsForThread to use tree ---
async function loadCommentsForThread(themaId, threadId) {
  if (!db) return;
  const commentsContainer = document.querySelector(
    `.thread-comments[data-thread-id="${threadId}"]`,
  );
  if (!commentsContainer) return;
  if (commentsContainer._unsubscribeComments) {
    commentsContainer._unsubscribeComments();
    commentsContainer._unsubscribeComments = null;
  }
  const commentsCol = collection(
    db,
    `artifacts/${appId}/public/data/thematas/${themaId}/threads/${threadId}/comments`,
  );
  const q = query(commentsCol, orderBy("createdAt", "asc"));
  commentsContainer._unsubscribeComments = onSnapshot(q, async (commentsSnapshot) => {
    const comments = [];
    commentsSnapshot.forEach(docSnap => {
      const d = docSnap.data();
      comments.push({
        id: docSnap.id,
        content: d.content,
        createdAt: d.createdAt ? new Date(d.createdAt.toDate()).toLocaleString() : "N/A",
        createdBy: d.createdBy,
        displayName: d.creatorDisplayName || "Anonymous",
        handle: d.creatorHandle || "user",
        photoURL: d.creatorPhotoURL,
        reactions: d.reactions || {},
        parentId: d.parentId || null,
      });
    });
    const tree = buildCommentTree(comments);
    let html = '';
    if (tree.length === 0) {
      html = '<div class="no-comments text-sm text-gray-500">No comments yet.</div>';
    } else {
      html = renderCommentTree(tree, 0, themaId, threadId);
    }
    html += `
      <div class="add-comment-section mt-3">
        <button type="button" class="toggle-add-comment btn-primary btn-blue mb-2">＋ Add Comment</button>
        <div class="add-comment-collapsible" style="display:none;">
          <form class="add-comment-form form-container flex flex-col md:flex-row items-center gap-2 p-2 bg-card rounded-lg shadow mb-2" data-thema-id="${themaId}" data-thread-id="${threadId}">
            <textarea class="form-input flex-1 min-w-0 mb-0 text-sm" placeholder="Add a comment..." rows="1" required style="margin-bottom:0; min-width:120px; resize:vertical;"></textarea>
            <button type="submit" class="btn-primary btn-blue text-sm ml-0" style="margin-bottom:0;">Add Comment</button>
          </form>
        </div>
      </div>
    `;
    commentsContainer.innerHTML = html;
    setupCommentEventListeners(themaId, threadId);
  });
}

// Setup thread event listeners
function setupThreadEventListeners(themaId) {
  const threadsContainer = document.querySelector(`#threads-for-${themaId}`);
  if (!threadsContainer) return;

  // Create thread form
  threadsContainer.querySelectorAll(".create-thread-form").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const titleInput = form.querySelector('input[type="text"]');
      const commentInput = form.querySelector("textarea");

      if (titleInput.value.trim() && commentInput.value.trim()) {
        await addCommentThread(
          themaId,
          titleInput.value.trim(),
          commentInput.value.trim(),
        );
        titleInput.value = "";
        commentInput.value = "";
      }
    });
  });

  // Thread actions
  threadsContainer.querySelectorAll(".edit-thread-btn").forEach((button) => {
    button.addEventListener("click", async (event) => {
      const threadElem = event.target.closest("[data-thread-id]");
      const threadId = threadElem.dataset.threadId;
      const titleElem = threadElem.querySelector(".font-bold");
      const descElem = threadElem.querySelector(".comment-content");
      const oldTitle = titleElem ? titleElem.textContent : "";
      const oldDesc = descElem ? descElem.textContent : "";
      const newTitle = prompt("Edit thread title:", oldTitle);
      if (newTitle === null) return;
      const newDesc = prompt("Edit thread description:", oldDesc);
      if (newDesc === null) return;
      await setDoc(doc(db, `artifacts/${appId}/public/data/thematas/${themaId}/threads`, threadId), { title: newTitle, initialComment: newDesc }, { merge: true });
      showMessageBox("Thread updated.");
    });
  });

  threadsContainer.querySelectorAll(".delete-thread-btn").forEach((button) => {
    button.addEventListener("click", async (event) => {
      const threadId = event.target.closest(".thread-item").dataset.threadId;
      const confirmed = await showCustomConfirm(
        "Delete this thread?",
        "All comments will also be deleted.",
      );
      if (confirmed) {
        await deleteThreadAndSubcollection(themaId, threadId);
      }
    });
  });
}

// Setup comment event listeners
function setupCommentEventListeners(themaId, threadId) {
  const commentsContainer = document.querySelector(
    `[data-thread-id="${threadId}"] .thread-comments`,
  );
  if (!commentsContainer) return;

  // Add comment form
  commentsContainer.querySelectorAll(".add-comment-form").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const commentInput = form.querySelector("textarea");

      if (commentInput.value.trim()) {
        await addComment(themaId, threadId, commentInput.value.trim());
        commentInput.value = "";
      }
    });
  });

  // Comment actions
  commentsContainer.querySelectorAll(".edit-comment-btn").forEach((button) => {
    button.addEventListener("click", async (event) => {
      const commentElem = event.target.closest("[data-comment-id]");
      const commentId = commentElem.dataset.commentId;
      const contentElem = commentElem.querySelector(".comment-content");
      const oldContent = contentElem.textContent;
      // Replace with input field and Save/Cancel
      contentElem.innerHTML = `<textarea id="edit-comment-content" class="form-input w-full" rows="2">${escapeHtml(oldContent)}</textarea>
        <div class='flex gap-2 mt-1'>
          <button class='save-edit-comment-btn btn-primary btn-blue text-xs'>Save</button>
          <button class='cancel-edit-comment-btn btn-primary btn-red text-xs'>Cancel</button>
        </div>`;
      // Save handler
      contentElem.querySelector('.save-edit-comment-btn').onclick = async () => {
        const newContent = contentElem.querySelector('#edit-comment-content').value.trim();
        if (!newContent) return showMessageBox('Content required', true);
        await setDoc(doc(db, `artifacts/${appId}/public/data/thematas/${themaId}/threads/${threadId}/comments`, commentId), { content: newContent }, { merge: true });
        showMessageBox('Comment updated.');
        await loadCommentsForThread(themaId, threadId);
      };
      // Cancel handler
      contentElem.querySelector('.cancel-edit-comment-btn').onclick = () => {
        contentElem.textContent = oldContent;
      };
    });
  });

  commentsContainer
    .querySelectorAll(".delete-comment-btn")
    .forEach((button) => {
      button.addEventListener("click", async (event) => {
        const commentId =
          event.target.closest(".comment-item").dataset.commentId;
        const confirmed = await showCustomConfirm(
          "Delete this comment?",
          "This action cannot be undone.",
        );
        if (confirmed) {
          await deleteComment(themaId, threadId, commentId);
        }
      });
    });
}

// Add comment thread
async function addCommentThread(themaId, title, initialComment) {
  if (!auth.currentUser) {
    showMessageBox("You must be logged in to create a thread.", true);
    return;
  }

  try {
    const threadsCol = collection(
      db,
      `artifacts/${appId}/public/data/thematas/${themaId}/threads`,
    );
    await addDoc(threadsCol, {
      title: title,
      initialComment: initialComment,
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser.uid,
      creatorDisplayName: window.currentUser
        ? window.currentUser.displayName
        : "Anonymous",
    });
    showMessageBox("Thread created successfully!", false);
  } catch (error) {
    console.error("Error creating thread:", error);
    showMessageBox(`Error creating thread: ${error.message}`, true);
  }
}

// In addComment, accept parentId and set it in Firestore
async function addComment(themaId, threadId, content, parentId = null) {
  if (!auth.currentUser) {
    showMessageBox("You must be logged in to add a comment.", true);
    return;
  }
  try {
    const commentsCol = collection(
      db,
      `artifacts/${appId}/public/data/thematas/${themaId}/threads/${threadId}/comments`,
    );
    await addDoc(commentsCol, {
      content,
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser.uid,
      creatorDisplayName: window.currentUser ? window.currentUser.displayName : "Anonymous",
      creatorHandle: window.currentUser ? window.currentUser.handle : "user",
      creatorPhotoURL: window.currentUser ? window.currentUser.photoURL : null,
      parentId,
    });
    showMessageBox("Comment posted successfully!", false);
  } catch (error) {
    console.error("Error posting comment:", error);
    showMessageBox(`Error posting comment: ${error.message}`, true);
  }
}

// Delete thema and subcollections
async function deleteThemaAndSubcollections(themaId) {
  try {
    const threadsRef = collection(
      db,
      `artifacts/${appId}/public/data/thematas/${themaId}/threads`,
    );
    const threadsSnapshot = await getDocs(threadsRef);

    for (const threadDoc of threadsSnapshot.docs) {
      const commentsRef = collection(
        db,
        `artifacts/${appId}/public/data/thematas/${themaId}/threads/${threadDoc.id}/comments`,
      );
      const commentsSnapshot = await getDocs(commentsRef);

      for (const commentDoc of commentsSnapshot.docs) {
        await deleteDoc(doc(commentsRef, commentDoc.id));
      }
      await deleteDoc(doc(threadsRef, threadDoc.id));
    }

    await deleteDoc(
      doc(db, `artifacts/${appId}/public/data/thematas`, themaId),
    );
    showMessageBox("Théma and all content deleted successfully!", false);
  } catch (error) {
    console.error("Error deleting théma:", error);
    showMessageBox(`Error deleting théma: ${error.message}`, true);
  }
}

// Delete thread and subcollection
async function deleteThreadAndSubcollection(themaId, threadId) {
  try {
    const commentsRef = collection(
      db,
      `artifacts/${appId}/public/data/thematas/${themaId}/threads/${threadId}/comments`,
    );
    const commentsSnapshot = await getDocs(commentsRef);

    for (const commentDoc of commentsSnapshot.docs) {
      await deleteDoc(doc(commentsRef, commentDoc.id));
    }

    await deleteDoc(
      doc(
        db,
        `artifacts/${appId}/public/data/thematas/${themaId}/threads`,
        threadId,
      ),
    );
    showMessageBox("Thread and comments deleted successfully!", false);
  } catch (error) {
    console.error("Error deleting thread:", error);
    showMessageBox(`Error deleting thread: ${error.message}`, true);
  }
}

// Delete comment
async function deleteComment(themaId, threadId, commentId) {
  try {
    await deleteDoc(
      doc(
        db,
        `artifacts/${appId}/public/data/thematas/${themaId}/threads/${threadId}/comments`,
        commentId,
      ),
    );
    showMessageBox("Comment deleted successfully!", false);
    await loadCommentsForThread(themaId, threadId);
  } catch (error) {
    console.error("Error deleting comment:", error);
    showMessageBox(`Error deleting comment: ${error.message}`, true);
  }
}

// Edit thema modal (placeholder)
function openEditThemaModal(themaId, thema) {
  const oldName = thema.name || "";
  const oldDesc = thema.description || "";
  const newName = prompt("Edit Théma name:", oldName);
  if (newName === null) return;
  const newDesc = prompt("Edit Théma description:", oldDesc);
  if (newDesc === null) return;
  setDoc(doc(db, `artifacts/${appId}/public/data/thematas`, themaId), { name: newName, description: newDesc }, { merge: true });
  showMessageBox("Théma updated.");
}

// Initialize page
document.addEventListener("DOMContentLoaded", async function () {
  // Load footer
  loadFooter("current-year-forms");

  // Create thema form
  createThemaForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = newThemaNameInput.value.trim();
    const description = newThemaDescriptionInput.value.trim();

    if (name && description) {
      await addThema(name, description);
    } else {
      showMessageBox("Please fill in both Théma Name and Description.", true);
    }
  });

  // Tab navigation
  dmTabBtn?.addEventListener("click", async () => {
    document
      .querySelectorAll(".tab-content")
      .forEach((el) => (el.style.display = "none"));
    document
      .querySelectorAll(".tab-btn")
      .forEach((el) => el.classList.remove("active"));
    dmTabContent.style.display = "block";
    dmTabBtn.classList.add("active");

    // Initialize DM functionality when tab is opened
    await initializeDmTab();
  });

  const allThematasTabBtn = document.getElementById("tab-themata-all");
  allThematasTabBtn?.addEventListener("click", () => {
    document
      .querySelectorAll(".tab-content")
      .forEach((el) => (el.style.display = "none"));
    document
      .querySelectorAll(".tab-btn")
      .forEach((el) => el.classList.remove("active"));
    themataTabContent.style.display = "block";
    allThematasTabBtn.classList.add("active");
    renderThematas();
  });

  // Collapsible sections
  document.querySelectorAll(".collapsible-header").forEach((header) => {
    header.addEventListener("click", () => {
      const content = header.nextElementSibling;
      const icon = header.querySelector(".material-icons");

      if (content.style.display === "none") {
        content.style.display = "block";
        icon.textContent = "expand_less";
      } else {
        content.style.display = "none";
        icon.textContent = "expand_more";
      }
    });
  });

  // Initialize thematas
  renderThematas();

  // Collapsible for Create New Théma
  setupCollapsibleToggles();

  // Add a single event listener for .collapse-btn clicks:
  document.body.addEventListener("click", function(e) {
    if (e.target.closest && e.target.closest(".collapse-btn")) {
      const btn = e.target.closest(".collapse-btn");
      // Find the card (thema, thread, or comment)
      const card = btn.closest(".thema-item, .thread-item, .comment-item");
      if (!card) return;
      // Find the header (first child with class thread-header or comment-header or flex)
      let header = card.querySelector(".thread-header, .comment-header, .flex");
      if (!header) header = card.firstElementChild;
      let collapsed = false;
      let foundHeader = false;
      Array.from(card.children).forEach(child => {
        if (child === header) { foundHeader = true; return; }
        if (foundHeader) {
          if (child.style.display === 'none') {
            child.style.display = '';
            collapsed = false;
          } else {
            child.style.display = 'none';
            collapsed = true;
          }
        }
      });
      const chevron = btn.querySelector('.chevron');
      if (chevron) chevron.style.transform = collapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
    }
  });
});

// --- PATCH: REACTIONS ---
async function handleReaction(type, themaId, threadId, commentId = null) {
  const user = getCurrentUserInfo();
  if (!user.uid) return;

  let ref;
  if (commentId) {
    ref = doc(
      db,
      `artifacts/${appId}/public/data/thematas/${themaId}/threads/${threadId}/comments`,
      commentId,
    );
  } else {
    ref = doc(
      db,
      `artifacts/${appId}/public/data/thematas/${themaId}/threads`,
      threadId,
    );
  }

  const docSnap = await getDoc(ref);
  let reactions = docSnap.data().reactions || {};

  // Toggle reaction: if user already has this reaction, remove it; otherwise add it
  if (reactions[user.uid] === type) {
    delete reactions[user.uid];
  } else {
    delete reactions[user.uid];
    reactions[user.uid] = type;
  }

  await setDoc(ref, { reactions }, { merge: true });

  // Only update the reaction bar for the affected item
  if (commentId) {
    const commentElem = document.querySelector(`[data-comment-id="${commentId}"] .reactions-bar`);
    if (commentElem) {
      commentElem.innerHTML = renderReactionButtons(reactions, themaId, threadId, commentId);
    }
  } else {
    const threadElem = document.querySelector(`[data-thread-id="${threadId}"] .reactions-bar`);
    if (threadElem) {
      threadElem.innerHTML = renderReactionButtons(reactions, themaId, threadId);
    }
  }
}

// Helper function to count reactions by type
function countReactionsByType(reactions) {
  const counts = { "👍": 0, "❤️": 0, "😂": 0 };
  if (!reactions) return counts;

  Object.values(reactions).forEach((type) => {
    if (counts.hasOwnProperty(type)) {
      counts[type]++;
    }
  });
  return counts;
}

// Helper function to check if current user has reacted
function getUserReaction(reactions, userId) {
  if (!reactions || !userId) return null;
  return reactions[userId] || null;
}

// Helper function to render reaction buttons with counts and user state
function renderReactionButtons(reactions, themaId, threadId, commentId = null) {
  const user = getCurrentUserInfo();
  const counts = countReactionsByType(reactions);
  const userReaction = getUserReaction(reactions, user.uid);

  const reactionTypes = [
    { type: "👍", label: "Like" },
    { type: "❤️", label: "Love" },
    { type: "😂", label: "Laugh" },
  ];

  return reactionTypes
    .map(({ type, label }) => {
      const count = counts[type] || 0;
      const isUserReacted = userReaction === type;
      const buttonClass = isUserReacted
        ? "reaction-btn reacted"
        : "reaction-btn";

      return `
      <button class="${buttonClass}" 
              onclick="handleReaction('${type}', '${themaId}', '${threadId}'${commentId ? `, '${commentId}'` : ""})" 
              title="${label}">
        ${type} <span class="reaction-count text-text-secondary">${count}</span>
      </button>
    `;
    })
    .join("");
}

const inputClass =
  "form-input bg-card text-text-primary border-none rounded w-full";
const textareaClass =
  "form-input bg-card text-text-primary border-none rounded w-full";
const cardClass =
  "bg-card text-text-primary border border-input-border rounded-lg shadow";
const commentClass = "comment-item p-2 " + cardClass + " mt-2";
const threadHeaderClass =
  "thread-header flex items-center gap-3 bg-card text-text-primary";
const commentHeaderClass = threadHeaderClass;

// DM Tab Functionality
async function initializeDmTab() {
  console.log("Initializing DM tab...");

  try {
    // Initialize DM functionality
    await initializeDmSystem();

    // Set up event listeners for DM tab
    setupDmEventListeners();

    // Load initial conversations
    await loadConversations();

    console.log("DM tab initialized successfully");
  } catch (error) {
    console.error("Error initializing DM tab:", error);
  }
}

async function setupDmEventListeners() {
  // DM-specific event listeners
  attachDmEventListeners();

  // Sort conversations
  const sortSelect = document.getElementById("sort-conversations-by");
  if (sortSelect) {
    sortSelect.addEventListener("change", () => {
      currentSortOption = sortSelect.value;
      renderConversationsList();
    });
  }

  // Back to chats button
  const backBtn = document.getElementById("back-to-chats-btn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      updateDmUiForNoConversationSelected();
    });
  }

  // Create conversation form - ensure it's properly connected
  const createForm = document.getElementById("create-conversation-form");
  if (createForm) {
    // Remove any existing listeners to prevent duplicates
    createForm.removeEventListener("submit", handleCreateConversation);
    createForm.addEventListener("submit", handleCreateConversation);
  }

  // Click outside suggestions to hide them
  document.addEventListener("click", (event) => {
    const privateSuggestions = document.getElementById(
      "private-chat-suggestions",
    );
    const groupSuggestions = document.getElementById("group-chat-suggestions");

    if (
      privateSuggestions &&
      !event.target.closest(".recipient-input-container")
    ) {
      privateSuggestions.style.display = "none";
    }

    if (
      groupSuggestions &&
      !event.target.closest(".recipient-input-container")
    ) {
      groupSuggestions.style.display = "none";
    }
  });
}

// Local handleCreateConversation function that updates input fields
async function handleCreateConversation(event) {
  event.preventDefault();

  const typeSelect = document.getElementById("new-chat-type");
  const groupNameInput = document.getElementById("group-chat-name");
  const groupImageInput = document.getElementById("group-chat-image");

  const type = typeSelect?.value || "private";
  let groupName = "";
  let groupImage = "";

  if (type === "group") {
    groupName = groupNameInput?.value?.trim() || "";
    groupImage = groupImageInput?.value?.trim() || "";
  }

  // Check if we have selected recipients
  if (selectedRecipients.size === 0) {
    showMessageBox("Please select at least one recipient for the chat.", true);
    return;
  }

  await createConversation(type, [], groupName, groupImage);
}

// Make handleReaction globally accessible
window.handleReaction = handleReaction;

// --- Tab Persistence and Scroll to Top ---
function setActiveTab(tabName) {
  localStorage.setItem("formsActiveTab", tabName);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

function getActiveTab() {
  return localStorage.getItem("formsActiveTab") || "thema-all";
}

window.showTab = function (tabName) {
  setActiveTab(tabName);
  const tabContents = document.querySelectorAll(".tab-content");
  tabContents.forEach((content) => content.classList.remove("active"));
  const tabButtons = document.querySelectorAll(".tab-btn");
  tabButtons.forEach((button) => button.classList.remove("active"));
  document.getElementById(tabName + "-tab-content").classList.add("active");
  const btn = document.getElementById("tab-" + tabName);
  if (btn) btn.classList.add("active");
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
};

// On page load, restore last active tab and scroll to top
window.addEventListener("DOMContentLoaded", () => {
  const tab = getActiveTab();
  window.showTab(tab);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
});

/**
 * Renders content with media support.
 * @param {string} content - The content to render.
 * @returns {string} The rendered HTML.
 */
function renderContent(content) {
  if (!content) return "";

  // Create a temporary element to render into
  const tempDiv = document.createElement("div");
  renderMarkdownWithMedia(content, tempDiv);
  return tempDiv.innerHTML;
}

// --- DM SYSTEM PLACEHOLDERS (to prevent ReferenceError) ---
function initializeDmSystem() {
  // TODO: Implement DM system initialization
  console.log('initializeDmSystem() called (placeholder)');
}
function loadConversations() {
  // TODO: Implement DM conversations loading
  console.log('loadConversations() called (placeholder)');
}
function attachDmEventListeners() {
  // TODO: Implement DM event listeners
  console.log('attachDmEventListeners() called (placeholder)');
}
function renderConversationsList() {
  // TODO: Implement DM conversation list rendering
  console.log('renderConversationsList() called (placeholder)');
}

// Ensure DM system initializes on DM tab click or if DM tab is active on load
if (dmTabBtn && dmTabContent) {
  dmTabBtn.addEventListener('click', () => {
    initializeDmSystem();
    setupDmEventListeners();
  });
  // If DM tab is active on load, initialize immediately
  if (dmTabContent.classList.contains('active') || dmTabContent.style.display !== 'none') {
    initializeDmSystem();
    setupDmEventListeners();
  }
}

// --- Unified collapsible toggle logic ---
function setupCollapsibleToggles() {
  // Théma
  const toggleThemaBtn = document.getElementById("toggle-create-thema");
  const createThemaCollapsible = document.getElementById("create-thema-collapsible");
  if (toggleThemaBtn && createThemaCollapsible) {
    toggleThemaBtn.onclick = () => {
      createThemaCollapsible.style.display = createThemaCollapsible.style.display === "none" ? "block" : "none";
    };
  }
  // Thread & Comment
  document.body.addEventListener("click", (e) => {
    if (e.target.classList.contains("toggle-create-thread") || e.target.classList.contains("toggle-add-comment")) {
      const collapsible = e.target.nextElementSibling;
      if (collapsible) collapsible.style.display = collapsible.style.display === "none" ? "block" : "none";
    }
  });
}

// --- Inline Edit Logic for Thema, Thread, Comment ---
function makeEditable(cardElem, type, ids, oldTitle, oldDesc) {
  // type: 'thema', 'thread', 'comment'
  // ids: {themaId, threadId, commentId}
  // oldTitle: for thema/thread, oldDesc: for thema/thread/comment
  const titleElem = cardElem.querySelector('.font-bold');
  const descElem = cardElem.querySelector('.thema-description, .comment-content');
  if (!titleElem || !descElem) return;
  // Save originals
  const origTitle = titleElem.textContent;
  const origDesc = descElem.textContent;
  // Replace with inputs
  titleElem.innerHTML = `<input class="form-input inline-edit-title" value="${escapeHtml(origTitle)}" style="font-weight:700;width:100%;margin-bottom:4px;">`;
  descElem.innerHTML = `<textarea class="form-input inline-edit-desc" style="width:100%;min-height:32px;">${escapeHtml(origDesc)}</textarea>`;
  // Move Save/Cancel to actions-right (top right)
  let actions = cardElem.querySelector('.actions-right');
  if (!actions) return;
  actions.innerHTML = `
    <button class="save-edit-btn btn-primary btn-blue" title="Save">✔</button>
    <button class="cancel-edit-btn btn-primary btn-red" title="Cancel">✖</button>
  `;
  // Save handler
  actions.querySelector('.save-edit-btn').onclick = async () => {
    const newTitle = titleElem.querySelector('input')?.value.trim();
    const newDesc = descElem.querySelector('textarea')?.value.trim();
    if ((type !== 'comment' && (!newTitle || !newDesc)) || (type === 'comment' && !newDesc)) return showMessageBox('Fields required', true);
    if (type === 'thema') {
      await setDoc(doc(db, `artifacts/${appId}/public/data/thematas`, ids.themaId), { name: newTitle, description: newDesc }, { merge: true });
    } else if (type === 'thread') {
      await setDoc(doc(db, `artifacts/${appId}/public/data/thematas/${ids.themaId}/threads`, ids.threadId), { title: newTitle, initialComment: newDesc }, { merge: true });
    } else if (type === 'comment') {
      await setDoc(doc(db, `artifacts/${appId}/public/data/thematas/${ids.themaId}/threads/${ids.threadId}/comments`, ids.commentId), { content: newDesc }, { merge: true });
    }
    showMessageBox('Saved.');
    renderThematas();
  };
  // Cancel handler
  actions.querySelector('.cancel-edit-btn').onclick = () => {
    titleElem.textContent = origTitle;
    descElem.textContent = origDesc;
    actions.innerHTML = '';
    // Re-render edit/delete icons
    if (type === 'thema' || type === 'thread' || type === 'comment') renderThematas();
  };
}

