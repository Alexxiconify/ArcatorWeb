/* forms.js: Forum-specific functionality for thémata, threads, and comments */

// Import existing modules
import {appId, auth, db, getUserProfileFromFirestore,} from "./firebase-init.js";
import {escapeHtml, showCustomConfirm, showMessageBox} from "./utils.js";
import {loadFooter} from "./navbar.js";

// Import Firebase functions
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
  setDoc,
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
const allThematasTabBtn = document.getElementById("tab-themata-all");

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
      console.log("[forms] No thémata found");
      return;
    }
    console.log(`[forms] Loaded ${snapshot.size} thémata`);
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
      editBtn.className = "edit-themata-btn icon-btn";
      editBtn.title = "Edit Themata";
      editBtn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>';
      editBtn.onclick = () => openEditThemaModal(themaId, thema);

      const delBtn = document.createElement("button");
      delBtn.className = "delete-themata-btn icon-btn";
      delBtn.title = "Delete Themata";
      delBtn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>';
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
                <div class="flex gap-2 ml-auto actions-right">
                  ${canEditThread ? `
                    <button class="edit-thread-btn icon-btn" title="Edit Thread">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                      </svg>
                    </button>
                    <button class="delete-thread-btn icon-btn" title="Delete Thread">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

// --- Helper: Flatten comment tree with depth ---
function flattenCommentTree(comments, depth = 0) {
  let flat = [];
  for (const c of comments) {
    flat.push({ ...c, depth });
    if (c.children && c.children.length) {
      flat = flat.concat(flattenCommentTree(c.children, depth + 1));
    }
  }
  return flat;
}

// --- Render nested Reddit-style comment tree ---
function renderNestedComments(comments, themaId, threadId, depth = 0) {
  return comments.map(c => {
    const canEdit = window.currentUser && (window.currentUser.isAdmin || window.currentUser.uid === c.createdBy);
    let photoURL = c.photoURL;
    if (!photoURL || photoURL === 'null' || photoURL === 'undefined') photoURL = "https://placehold.co/32x32/1F2937/E5E7EB?text=AV";
    let connectors = '';
    if (depth > 0) {
      connectors = `<div class='vertical-connector'></div><div class='horizontal-connector'></div>`;
    }
    return `
      <div class="thread-header depth-${depth} flex items-start text-text-primary mb-2 p-3" data-comment-id="${c.id}" style="position:relative;min-height:40px;">
        ${connectors}
        <img src="${photoURL}" alt="User" class="w-8 h-8 rounded-full object-cover mr-2 flex-shrink-0" style="width:32px;height:32px;border-radius:50%;object-fit:cover;" onerror="this.onerror=null;this.src='https://placehold.co/32x32/1F2937/E5E7EB?text=AV'">
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between">
            <span class="text-xs text-text-secondary truncate">${escapeHtml(c.displayName || "Anonymous")} <span class="text-[10px] text-link text-text-primary ml-1">@${escapeHtml(c.handle || "user")}</span></span>
            <div class="flex gap-1 ml-2 actions-right">
              ${canEdit ? `
                <button class="edit-comment-btn icon-btn" title="Edit Comment"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg></button>
                <button class="delete-comment-btn icon-btn" title="Delete Comment"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
              ` : ""}
            </div>
          </div>
          <div class="text-sm mt-0.5 mb-0.5 comment-content">${renderContent(c.content)}</div>
          <div class="flex items-center justify-between mt-1 w-full">
            <div class="flex items-center gap-2">
              <button class="reply-comment-btn btn-primary btn-blue text-xs px-2 py-0.5" data-comment-id="${c.id}">Reply</button>
              <div class="flex items-center gap-2 reactions-bar">${renderReactionButtons(c.reactions, themaId, threadId, c.id)}</div>
            </div>
            <span class="meta-info text-xs text-right ml-2 whitespace-nowrap">${c.createdAt}</span>
          </div>
          <div class="reply-form-container" id="reply-form-${c.id}" style="display:none;"></div>
          ${c.children && c.children.length ? `<div class="mt-2">${renderNestedComments(c.children, themaId, threadId, depth + 1)}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// --- Update loadCommentsForThread to use nested rendering ---
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
        children: [],
      });
    });
    const tree = buildCommentTree(comments);
    const flat = flattenCommentTree(tree);
    let html = '';
    if (flat.length === 0) {
      html = `<div class="flex items-center gap-4 no-comments-row w-full">
        <button class="toggle-add-comment btn-primary btn-blue mb-0 mr-4">＋ Add Comment</button>
        <div class="flex-1 text-center no-comments text-sm text-gray-500 mb-0">No comments yet.</div>
      </div>
      <div class="add-comment-collapsible" style="display:none;"></div>`;
    } else {
      html = renderNestedComments(tree, themaId, threadId);
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
    }
    commentsContainer.innerHTML = html;
    // Attach toggle for empty state
    if (flat.length === 0) {
      const btn = commentsContainer.querySelector('.toggle-add-comment');
      const formDiv = commentsContainer.querySelector('.add-comment-collapsible');
      if (btn && formDiv) {
        btn.onclick = () => {
          btn.style.display = 'none';
          formDiv.style.display = 'block';
          formDiv.innerHTML = `<form class=\"add-comment-form flex flex-row items-center gap-2 ml-0\" data-thema-id=\"${themaId}\" data-thread-id=\"${threadId}\" style=\"margin-bottom:0;\">
            <textarea class=\"form-input flex-1 min-w-0 mb-0 text-sm\" placeholder=\"Add a comment...\" rows=\"1\" required style=\"margin-bottom:0; min-width:120px; resize:vertical;\"></textarea>
            <button type=\"submit\" class=\"btn-primary btn-blue text-sm ml-0\" style=\"margin-bottom:0;\">Add Comment</button>
          </form>`;
          setupCommentEventListeners(themaId, threadId);
        };
      }
    } else {
      setupCommentEventListeners(themaId, threadId);
    }
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
    `.thread-comments[data-thread-id="${threadId}"]`,
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

  // Reply button logic
  commentsContainer.querySelectorAll(".reply-comment-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const commentId = button.dataset.commentId;
      const replyFormDiv = commentsContainer.querySelector(`#reply-form-${commentId}`);
      if (!replyFormDiv) return;
      // If already open, do nothing
      if (replyFormDiv.style.display === "block") return;
      // Hide all other reply forms
      commentsContainer.querySelectorAll('.reply-form-container').forEach(div => { div.style.display = 'none'; div.innerHTML = ''; });
      replyFormDiv.style.display = "block";
      replyFormDiv.innerHTML = `<form class='reply-form flex flex-row items-center gap-2 ml-0' data-parent-id='${commentId}' style='margin-bottom:0;'>
        <textarea class='form-input flex-1 min-w-0 mb-0 text-sm' placeholder='Reply...' rows='1' required style='margin-bottom:0; min-width:120px; resize:vertical;'></textarea>
        <button type='submit' class='btn-primary btn-blue text-sm ml-0' style='margin-bottom:0;'>Reply</button>
        <button type='button' class='btn-primary btn-red text-sm ml-0 cancel-reply-btn' style='margin-bottom:0;'>Cancel</button>
      </form>`;
      // Submit handler
      const form = replyFormDiv.querySelector('form');
      form.onsubmit = async (e) => {
        e.preventDefault();
        const textarea = form.querySelector('textarea');
        if (textarea.value.trim()) {
          await addComment(themaId, threadId, textarea.value.trim(), commentId);
          replyFormDiv.style.display = 'none';
          replyFormDiv.innerHTML = '';
        }
      };
      // Cancel handler
      form.querySelector('.cancel-reply-btn').onclick = () => {
        replyFormDiv.style.display = 'none';
        replyFormDiv.innerHTML = '';
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

  // Move this block to the end of DOMContentLoaded to ensure all variables are initialized
  document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  if (themataTabContent) themataTabContent.style.display = 'block';
  if (allThematasTabBtn) allThematasTabBtn.classList.add('active');
  if (dmTabContent) dmTabContent.style.display = 'none';
  if (dmTabBtn) dmTabBtn.classList.remove('active');
  renderThematas();

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

  // Hash-based tab navigation
  function activateTabFromHash() {
    const hash = window.location.hash;
    if (hash === '#dm') {
      document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
      document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
      if (dmTabContent) dmTabContent.style.display = 'block';
      if (dmTabBtn) dmTabBtn.classList.add('active');
      setupDmEventListenersSafe();
    } else {
      document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
      document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
      if (themataTabContent) themataTabContent.style.display = 'block';
      if (allThematasTabBtn) allThematasTabBtn.classList.add('active');
      renderThematas();
    }
  }
  window.addEventListener('hashchange', activateTabFromHash);
  // Tab button click handlers update hash
  dmTabBtn?.addEventListener('click', function () {
    window.location.hash = '#dm';
  });
  allThematasTabBtn?.addEventListener('click', function () {
    window.location.hash = '#thema';
  });
  // Activate tab on load
  activateTabFromHash();

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

  // Wire up DM send message form
  const sendMessageForm = document.getElementById("send-message-form");
  if (sendMessageForm) {
    sendMessageForm.addEventListener("submit", sendMessage);
  }
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

// --- DM SYSTEM ---
// All DM logic is grouped here for easier debugging and maintenance.

// 1. DM State/Vars
let currentConversationId = null;
let dmUnsubMessages = null;

// 2. DM Helpers
function getCurrentUser() {
  return window.currentUser || auth.currentUser || null;
}

function showDmSections() {
}

function updateChatTypeField() {
  const recipientsInput = document.getElementById('chat-recipients');
  const chatTypeValue = document.getElementById('chat-type-value');
  if (!recipientsInput || !chatTypeValue) return;
  const recipients = recipientsInput.value.split(',').map(x => x.trim()).filter(Boolean);
  chatTypeValue.value = recipients.length > 1 ? 'Group Chat' : 'Private Chat';
}

// 3. DM Event Setup
function waitForUserAuthReady(callback) {
  if (window.currentUser || auth.currentUser) {
    callback();
  } else {
    const unsub = auth.onAuthStateChanged((user) => {
      if (user) {
        unsub();
        callback();
      }
    });
  }
}

// --- Render conversations as table ---
async function renderConversationsTable() {
  const user = getCurrentUser();
  const tableBody = document.getElementById('conversations-table-body');
  if (!user || !tableBody) return;
  const userDmsCol = collection(db, `artifacts/${appId}/users/${user.uid}/dms`);
  const q = query(userDmsCol, orderBy('lastMessageAt', 'desc'));
  const snap = await getDocs(q);
  if (snap.empty) {
    tableBody.innerHTML = `<tr><td colspan="4" class="text-center text-text-secondary py-4">No conversations found.</td></tr>`;
    return;
  }
  let html = '';
  snap.forEach(docSnap => {
    const convo = docSnap.data();
    const convoId = docSnap.id;
    const name = convo.name || (convo.type === 'group' ? 'Group Chat' : 'Private Chat');
    const participants = (convo.participants || []).map(uid => `<span class='text-xs'>${uid}</span>`).join(', ');
    const lastMsg = convo.lastMessageContent ? escapeHtml(convo.lastMessageContent) : '';
    const lastAt = convo.lastMessageAt && convo.lastMessageAt.toDate ? new Date(convo.lastMessageAt.toDate()).toLocaleString() : '';
    html += `<tr class="conversation-row${currentConversationId === convoId ? ' active' : ''}" data-convo-id="${convoId}">
      <td class="font-semibold">${escapeHtml(name)}</td>
      <td>${participants}</td>
      <td><div class="conversation-preview">${lastMsg}</div><div class="conversation-time">${lastAt}</div></td>
      <td><button class="delete-conversation-btn" title="Delete" data-convo-id="${convoId}">🗑️</button></td>
    </tr>`;
  });
  tableBody.innerHTML = html;
  // Row click: load messages
  tableBody.querySelectorAll('.conversation-row').forEach(row => {
    row.onclick = () => {
      const convoId = row.getAttribute('data-convo-id');
      openConversation(convoId);
      tableBody.querySelectorAll('.conversation-row').forEach(r => r.classList.remove('active'));
      row.classList.add('active');
    };
  });
  // Delete button
  tableBody.querySelectorAll('.delete-conversation-btn').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const convoId = btn.getAttribute('data-convo-id');
      if (await showCustomConfirm('Delete this conversation?', 'This cannot be undone.')) {
        await deleteConversation(convoId);
        renderConversationsTable();
        document.getElementById('conversation-messages-container').innerHTML = '';
      }
    };
  });
}

// Patch DM event setup to use new table
function setupDmEventListenersSafe() {
  waitForUserAuthReady(() => {
    showDmSections();
    const form = document.getElementById('send-message-form');
    if (form) form.onsubmit = sendMessage;
    const createForm = document.getElementById('create-conversation-form');
    if (createForm) createForm.onsubmit = createConversation;
    renderConversationsTable();
  });
}

dmTabBtn?.addEventListener('click', setupDmEventListenersSafe);
if (dmTabContent?.classList.contains('active') || dmTabContent?.style.display !== 'none') setupDmEventListenersSafe();
window.addEventListener('DOMContentLoaded', () => {
  const recipientsInput = document.getElementById('chat-recipients');
  if (recipientsInput) {
    recipientsInput.addEventListener('input', updateChatTypeField);
  }
});

// 4. DM Core Actions
async function sendMessage(event) {
  event.preventDefault();
  const user = getCurrentUser();
  if (!user || !currentConversationId) return;
  const input = document.getElementById('message-content-input');
  if (!input || !input.value.trim()) return;
  const content = input.value.trim();
  input.value = '';
  const convoRef = doc(db, `artifacts/${appId}/users/${user.uid}/dms`, currentConversationId);
  const convoSnap = await getDoc(convoRef);
  const convo = convoSnap.exists() ? convoSnap.data() : null;
  if (!convo || !Array.isArray(convo.participants)) return;
  for (const uid of convo.participants) {
    const msgCol = collection(db, `artifacts/${appId}/users/${uid}/dms/${currentConversationId}/messages`);
    await addDoc(msgCol, {content, sender: user.uid, createdAt: serverTimestamp()});
    await setDoc(doc(db, `artifacts/${appId}/users/${uid}/dms`, currentConversationId), {
      lastMessage: content,
      lastMessageAt: serverTimestamp(),
      lastMessageContent: content,
      lastMessageSenderId: user.uid,
      lastMessageSenderHandle: user.displayName || user.uid,
    }, {merge: true});
  }
}

async function createConversation(event) {
  event.preventDefault();
  const user = getCurrentUser();
  if (!user) return;
  const name = document.getElementById('chat-name')?.value?.trim() || '';
  const image = document.getElementById('chat-image')?.value?.trim() || '';
  const recipientsInput = document.getElementById('chat-recipients');
  let recipients = recipientsInput?.value?.split(',').map(x => x.trim()).filter(Boolean) || [];
  recipients = recipients.filter(uid => uid !== user.uid);
  if (recipients.length > 1) {
    recipients.unshift(user.uid);
    const convoId = recipients.sort().join('_');
    const convoData = {
      participants: recipients,
      name,
      groupImage: image,
      type: 'group',
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      lastMessage: '',
      lastMessageAt: serverTimestamp(),
    };
    for (const uid of recipients) {
      await setDoc(doc(db, `artifacts/${appId}/users/${uid}/dms`, convoId), convoData, {merge: true});
    }
    openConversation(convoId);
  } else {
    if (recipients.length !== 1 || recipients[0] === user.uid) return showMessageBox('Invalid recipient', true);
    const recipientUid = recipients[0];
    const convoId = [user.uid, recipientUid].sort().join('_');
    const convoData = {
      participants: [user.uid, recipientUid],
      name,
      image,
      type: 'private',
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      lastMessage: '',
      lastMessageAt: serverTimestamp(),
    };
    await setDoc(doc(db, `artifacts/${appId}/users/${user.uid}/dms`, convoId), convoData, {merge: true});
    await setDoc(doc(db, `artifacts/${appId}/users/${recipientUid}/dms`, convoId), convoData, {merge: true});
    openConversation(convoId);
  }
}
async function openConversation(convoId) {
  currentConversationId = convoId;
  const user = getCurrentUser();
  const container = document.getElementById('conversation-messages-container');
  if (!container) return;
  try {
    if (!user) {
      container.innerHTML = '<div class="text-center text-gray-400">Not logged in</div>';
      return;
    }
    const convoRef = doc(db, `artifacts/${appId}/users/${user.uid}/dms`, convoId);
    const convoSnap = await getDoc(convoRef);
    if (!convoSnap.exists()) {
      container.innerHTML = '<div class="text-center text-gray-400">Conversation not found or you do not have access.</div>';
      return;
    }
    const messagesCol = collection(db, `artifacts/${appId}/users/${user.uid}/dms/${convoId}/messages`);
    const q = query(messagesCol, orderBy('createdAt', 'asc'));
    if (dmUnsubMessages) dmUnsubMessages();
    dmUnsubMessages = onSnapshot(q, async (snap) => {
      container.innerHTML = '';
      if (snap.empty) {
        container.innerHTML = '<div class="text-center text-gray-400">No messages yet</div>';
        return;
      }
      for (const docSnap of snap.docs) {
        const msg = docSnap.data();
        const isOwn = user && (msg.sender === user.uid || msg.sender === 'Alexxiconify');
        const profile = await getUserProfile(msg.sender);
        const handle = profile.handle ? `@${escapeHtml(profile.handle)}` : escapeHtml(msg.sender);
        const div = document.createElement('div');
        div.className = 'message-bubble ' + (isOwn ? 'sent own-message' : 'received');
        if (isOwn) {
          div.style.textAlign = 'right';
          div.style.marginLeft = 'auto';
          div.style.maxWidth = '320px';
          div.style.padding = '2px 6px';
        } else {
          div.style.maxWidth = '320px';
          div.style.padding = '2px 6px';
        }
        div.innerHTML = `<div class='message-author' style='${isOwn ? 'justify-content:flex-end;text-align:right;gap:4px;' : 'justify-content:flex-start;text-align:left;gap:4px;'}display:flex;align-items:center;'><img src='${profile.photoURL || 'https://placehold.co/32x32/1F2937/E5E7EB?text=AV'}' style='width:20px;height:20px;border-radius:50%;'><span style='font-size:12px;'>${escapeHtml(profile.displayName)}</span><span class='text-xs text-link ml-2' style='font-size:10px;'>${handle}</span></div><div class='message-content' style='font-size:13px;'>${escapeHtml(msg.content)}</div><div class='message-timestamp' style='font-size:10px;${isOwn ? 'text-align:right;display:block;' : ''}'>${msg.createdAt ? new Date(msg.createdAt.toDate()).toLocaleString() : ''}</div>`;
        if (isOwn) {
          const actions = document.createElement('div');
          actions.className = 'message-actions';
          actions.style = 'display:flex;justify-content:flex-end;gap:2px;margin-top:2px;';
          actions.innerHTML = `<button class='edit-message-btn icon-btn' title='Edit' style='padding:0 2px;font-size:12px;'>✏️</button><button class='delete-message-btn icon-btn' title='Delete' style='padding:0 2px;font-size:12px;'>🗑️</button>`;
          actions.querySelector('.edit-message-btn').onclick = async () => {
            const newContent = prompt('Edit message:', msg.content);
            if (newContent !== null && newContent.trim() && newContent !== msg.content) {
              await setDoc(doc(messagesCol, docSnap.id), {content: newContent}, {merge: true});
            }
          };
          actions.querySelector('.delete-message-btn').onclick = async () => {
            if (await showCustomConfirm('Delete this message?', 'This cannot be undone.')) {
              await deleteDoc(doc(messagesCol, docSnap.id));
            }
          };
          div.appendChild(actions);
        }
        container.appendChild(div);
      }
      container.scrollTop = container.scrollHeight;
    }, err => {
      container.innerHTML = '<div class="text-center text-red-400">Failed to load messages</div>';
      console.log('[dm] Failed to load messages', err);
    });
  } catch (e) {
    container.innerHTML = '<div class="text-center text-red-400">Error loading messages</div>';
    console.log('[dm] Error loading messages', e);
  }
}

async function deleteConversation(convoId) {
  const user = getCurrentUser();
  if (!user) return;
  await deleteDoc(doc(db, `artifacts/${appId}/users/${user.uid}/dms`, convoId));
}

// --- Minimal missing helpers for error-free operation ---
function renderContent(text) { return escapeHtml(text); }
function renderConversationsList() {}
function renderConversationDropdown() {}

