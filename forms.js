/* forms.js: Forum-specific functionality for thémata, threads, and comments */

// Import existing modules
import {appId, auth, db, getUserProfileFromFirestore,} from "./firebase-init.js";
import {escapeHtml, renderMarkdownWithMedia, showCustomConfirm, showMessageBox} from "./utils.js";
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
  if (dmTabBtn && dmTabContent) {
    dmTabBtn.addEventListener('click', function () {
      document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
      document.getElementById('dm-tab-content').classList.add('active');
      this.classList.add('active');
      setupDmEventListeners();
    });
  }

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

// Firestore DM path: artifacts/{appId}/users/{userId}/dms/{conversationId}/messages/{messageId}

function getCurrentUser() {
  return window.currentUser || auth.currentUser || null;
}

async function getUserProfile(uid) {
  if (!uid || typeof uid !== 'string' || !uid.trim()) return {displayName: 'Anonymous', photoURL: ''};
  try {
    return (await getUserProfileFromFirestore(uid)) || {displayName: 'Anonymous', photoURL: ''};
  } catch {
    return {displayName: 'Anonymous', photoURL: ''};
  }
}

let dmUnsubConvos = null;
let dmUnsubMessages = null;
let currentConversationId = null;

// --- Conversation Edit/Delete ---
function showEditConversationModal(convoId, convo, otherProfiles) {
  // Remove any existing modal
  document.getElementById('edit-convo-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'edit-convo-modal';
  modal.style = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;';
  modal.innerHTML = `<div style='background:#222;color:#fff;padding:2rem;border-radius:1rem;min-width:320px;max-width:90vw;'>
    <h3 class='text-lg font-bold mb-2'>Edit Conversation</h3>
    <form id='edit-convo-form'>
      <div class='mb-2'><label>Name:<br><input id='edit-convo-name' class='form-input w-full' value='${escapeHtml(convo.name || '')}'></label></div>
      <div class='mb-2'><label>Image URL:<br><input id='edit-convo-image' class='form-input w-full' value='${escapeHtml(convo.groupImage || convo.image || '')}'></label></div>
      <div class='mb-2'><label>Participants (comma UIDs, group only):<br><input id='edit-convo-participants' class='form-input w-full' value='${(convo.participants || []).join(",")}' ${convo.type === 'group' ? '' : 'readonly'}></label></div>
      <div class='flex gap-2 mt-4'>
        <button type='submit' class='btn-primary btn-blue'>Save</button>
        <button type='button' id='cancel-edit-convo' class='btn-primary btn-red'>Cancel</button>
      </div>
    </form>
  </div>`;
  document.body.appendChild(modal);
  document.getElementById('cancel-edit-convo').onclick = () => modal.remove();
  document.getElementById('edit-convo-form').onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('edit-convo-name').value.trim();
    const image = document.getElementById('edit-convo-image').value.trim();
    const participants = document.getElementById('edit-convo-participants').value.split(',').map(x => x.trim()).filter(Boolean);
    const update = {name, groupImage: image};
    if (convo.type === 'group' && participants.length > 1) update.participants = participants;
    await setDoc(doc(db, `artifacts/${appId}/users/${getCurrentUser().uid}/dms`, convoId), update, {merge: true});
    modal.remove();
    showMessageBox('Conversation updated.');
  };
}

// Patch renderConversationsList to wire up edit/delete
async function renderConversationsList(autoOpenLatest = false) {
  const user = getCurrentUser();
  const list = document.getElementById('conversations-list');
  if (!user || !list) {
    if (list) list.innerHTML = '<div class="text-center text-red-400">Not logged in</div>';
    return;
  }
  try {
    const convosCol = collection(db, `artifacts/${appId}/users/${user.uid}/dms`);
    const q = query(convosCol, orderBy('lastMessageAt', 'desc'));
    if (dmUnsubConvos) dmUnsubConvos();
    dmUnsubConvos = onSnapshot(q, async (snap) => {
      let html = `<table class='w-full text-xs'><thead><tr><th></th><th>Name</th><th>People</th><th>Last Msg</th><th></th></tr></thead><tbody>`;
      if (snap.empty) {
        html += `<tr><td colspan='5' class='text-center text-gray-400'>No conversations</td></tr>`;
        list.innerHTML = html + '</tbody></table>';
        console.log('[dm] No conversations');
        return;
      }
      console.log(`[dm] Loaded ${snap.size} conversations`);
      let firstConvoId = null;
      const convoDocs = [];
      for (const [i, docSnap] of snap.docs.entries()) {
        const convo = docSnap.data();
        const convoId = docSnap.id;
        if (i === 0) firstConvoId = convoId;
        // Remove duplicate participants
        const others = [...new Set((convo.participants || []).filter(uid => uid !== user.uid))];
        const otherProfiles = await Promise.all(others.map(getUserProfile));
        convoDocs.push({convo, convoId, otherProfiles});
        // Group chat: use groupImage, group name, all participants
        const isGroup = convo.type === 'group' || others.length > 1;
        const chatName = convo.name || (isGroup ? 'Group' : (otherProfiles[0]?.displayName || 'User'));
        const chatPic = convo.groupImage || convo.image || (isGroup ? (otherProfiles[0]?.photoURL || 'https://placehold.co/32x32/1F2937/E5E7EB?text=AV') : (otherProfiles[0]?.photoURL || 'https://placehold.co/32x32/1F2937/E5E7EB?text=AV'));
        const people = otherProfiles.map(p => escapeHtml(p.displayName)).join(', ');
        // Last message: use lastMessageContent and lastMessageSenderHandle if present
        let lastMsg = '';
        if (convo.lastMessageContent && convo.lastMessageSenderHandle) {
          lastMsg = `<span class='text-link'>@${escapeHtml(convo.lastMessageSenderHandle)}</span>: ${escapeHtml(convo.lastMessageContent)}`;
        } else if (convo.lastMessage) {
          lastMsg = escapeHtml(convo.lastMessage);
        }
        const lastMsgDate = convo.lastMessageAt && convo.lastMessageAt.toDate ? new Date(convo.lastMessageAt.toDate()).toLocaleString() : '';
        html += `<tr class='conversation-row${convoId === currentConversationId ? ' active' : ''}' data-convo-id='${convoId}'>
          <td><img src='${chatPic}' class='conversation-avatar' style='width:24px;height:24px;border-radius:50%'></td>
          <td>${escapeHtml(chatName)}</td>
          <td>${people}</td>
          <td><div>${lastMsg}</div><div class='text-xs text-gray-400'>${lastMsgDate}</div></td>
          <td>
            <button class='edit-conversation-btn icon-btn' title='Edit' data-convo-id='${convoId}'>✏️</button>
            <button class='delete-conversation-btn icon-btn' title='Delete' data-convo-id='${convoId}'>🗑️</button>
          </td>
        </tr>`;
      }
      html += '</tbody></table>';
      list.innerHTML = html;
      // Row click
      list.querySelectorAll('.conversation-row').forEach(row => {
        row.onclick = e => {
          if (e.target.closest('.edit-conversation-btn,.delete-conversation-btn')) return;
          openConversation(row.dataset.convoId);
        };
      });
      // Edit icon
      list.querySelectorAll('.edit-conversation-btn').forEach(btn => {
        btn.onclick = e => {
          e.stopPropagation();
          const convoId = btn.dataset.convoId;
          const doc = convoDocs.find(d => d.convoId === convoId);
          if (doc) showEditConversationModal(convoId, doc.convo, doc.otherProfiles);
        };
      });
      // Delete icon
      list.querySelectorAll('.delete-conversation-btn').forEach(btn => {
        btn.onclick = async e => {
          e.stopPropagation();
          if (await showCustomConfirm('Delete this conversation?', 'All messages will be deleted.')) {
            await deleteConversationAndMessages(btn.dataset.convoId);
          }
        };
      });
      // Auto-open latest DM if requested and none selected
      if (autoOpenLatest && !currentConversationId && firstConvoId) {
        openConversation(firstConvoId);
      }
    }, err => {
      list.innerHTML = '<div class="text-center text-red-400">Failed to load conversations</div>';
      console.log('[dm] Failed to load conversations', err);
    });
  } catch (e) {
    list.innerHTML = '<div class="text-center text-red-400">Error loading DMs</div>';
    console.log('[dm] Error loading DMs', e);
  }
}

// Delete conversation and all messages for user
async function deleteConversationAndMessages(convoId) {
  const user = getCurrentUser();
  if (!user) return;
  // Remove all messages
  const msgCol = collection(db, `artifacts/${appId}/users/${user.uid}/dms/${convoId}/messages`);
  const msgs = await getDocs(msgCol);
  for (const docSnap of msgs.docs) {
    await deleteDoc(doc(msgCol, docSnap.id));
  }
  // Remove conversation
  await deleteDoc(doc(db, `artifacts/${appId}/users/${user.uid}/dms`, convoId));
  showMessageBox('Conversation deleted.');
}

function showDmSections() {
  // Show all DM sections from forms.html
  document.getElementById('dm-panel')?.classList.remove('hidden');
  document.getElementById('dm-panel')?.style.setProperty('display', 'grid');
  document.getElementById('conversations-messages-panel')?.classList.remove('hidden');
  document.getElementById('conversations-list')?.classList.remove('hidden');
  document.getElementById('create-conversation-form')?.classList.remove('hidden');
}

function setupDmEventListeners() {
  showDmSections();
  const form = document.getElementById('send-message-form');
  if (form) form.onsubmit = sendMessage;
  const createForm = document.getElementById('create-conversation-form');
  if (createForm) createForm.onsubmit = createConversation;
  renderConversationsList(true);
}

dmTabBtn?.addEventListener('click', setupDmEventListeners);
if (dmTabContent?.classList.contains('active') || dmTabContent?.style.display !== 'none') setupDmEventListeners();

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
  const tabContents = document.querySelectorAll('.tab-content');
  tabContents.forEach((content) => {
    content.classList.remove('active');
    content.style.display = 'none';
  });
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach((button) => button.classList.remove('active'));
  let contentId = tabName === 'dms' ? 'dm-tab-content' : tabName + '-tab-content';
  const contentEl = document.getElementById(contentId);
  if (contentEl) {
    contentEl.classList.add('active');
    contentEl.style.display = '';
  }
  const btn = document.getElementById('tab-' + tabName);
  if (btn) btn.classList.add('active');
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
};

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

// --- Hash-based tab navigation ---
function showTabByHash() {
  const hash = window.location.hash.replace('#', '');
  let tab = 'thema-all';
  if (hash === 'dms') tab = 'dms';
  window.showTab(tab);
  if (tab === 'dms') {
    currentConversationId = null;
    setupDmEventListeners();
  }
}

window.addEventListener('hashchange', showTabByHash);
window.addEventListener('DOMContentLoaded', showTabByHash);

document.getElementById('tab-themata-all')?.addEventListener('click', function () {
  window.location.hash = 'thema-all';
});
document.getElementById('tab-dms')?.addEventListener('click', function () {
  window.location.hash = 'dms';
});

// Helper to delete a conversation (all user copies)
async function deleteConversation(convoId) {
  const user = getCurrentUser();
  if (!user) return;
  // Remove from your DMs
  await deleteDoc(doc(db, `artifacts/${appId}/users/${user.uid}/dms`, convoId));
  // Optionally, remove all messages (not shown here for brevity)
}

// Patch openConversation for right flush and narrow DM bubbles for sent messages
async function openConversation(convoId) {
  currentConversationId = convoId;
  const user = getCurrentUser();
  const container = document.getElementById('conversation-messages-container');
  if (!user || !container) {
    if (container) container.innerHTML = '<div class="text-center text-red-400">Not logged in</div>';
    return;
  }
  try {
    const messagesCol = collection(db, `artifacts/${appId}/users/${user.uid}/dms/${convoId}/messages`);
    const q = query(messagesCol, orderBy('createdAt', 'asc'));
    if (dmUnsubMessages) dmUnsubMessages();
    dmUnsubMessages = onSnapshot(q, async (snap) => {
      container.innerHTML = '';
      if (snap.empty) {
        container.innerHTML = '<div class="text-center text-gray-400">No messages yet</div>';
        console.log(`[dm] No messages in convo ${convoId}`);
        return;
      }
      console.log(`[dm] Loaded ${snap.size} messages in convo ${convoId}`);
      for (const docSnap of snap.docs) {
        const msg = docSnap.data();
        const isOwn = msg.sender === user.uid || msg.sender === 'Alexxiconify';
        const profile = await getUserProfile(msg.sender);
        const div = document.createElement('div');
        div.className = 'message-bubble ' + (isOwn ? 'sent own-message' : 'received');
        // Flush right and narrow for sent
        if (isOwn) {
          div.style.textAlign = 'right';
          div.style.marginLeft = 'auto';
          div.style.maxWidth = '320px';
          div.style.padding = '2px 6px';
        } else {
          div.style.maxWidth = '320px';
          div.style.padding = '2px 6px';
        }
        div.innerHTML = `<div class='message-author' style='${isOwn ? 'justify-content:flex-end;text-align:right;gap:4px;' : 'justify-content:flex-start;text-align:left;gap:4px;'}display:flex;align-items:center;'><img src='${profile.photoURL || 'https://placehold.co/32x32/1F2937/E5E7EB?text=AV'}' style='width:20px;height:20px;border-radius:50%;'><span style='font-size:12px;'>${escapeHtml(profile.displayName)}</span><span class='text-xs text-link ml-2' style='font-size:10px;'>${escapeHtml(msg.sender)}</span></div><div class='message-content' style='font-size:13px;'>${escapeHtml(msg.content)}</div><div class='message-timestamp' style='font-size:10px;'>${msg.createdAt ? new Date(msg.createdAt.toDate()).toLocaleString() : ''}</div>`;
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

// Patch createConversation to support group chat with multiple recipients
async function createConversation(event) {
  event.preventDefault();
  const user = getCurrentUser();
  if (!user) return;
  const chatType = document.getElementById('new-chat-type')?.value;
  if (chatType === 'group') {
    // Group chat: collect all unique participant UIDs
    const groupInput = document.getElementById('group-chat-participants');
    let uids = groupInput?.value?.split(',').map(x => x.trim()).filter(Boolean) || [];
    uids = Array.from(new Set(uids.filter(uid => uid !== user.uid)));
    if (uids.length < 2) return showMessageBox('Group chat needs at least 2 other participants', true);
    uids.unshift(user.uid); // include self
    const name = document.getElementById('group-chat-name')?.value?.trim() || '';
    const image = document.getElementById('group-chat-image')?.value?.trim() || '';
    const convoId = uids.sort().join('_');
    const convoData = {
      participants: uids,
      name,
      groupImage: image,
      type: 'group',
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      lastMessage: '',
      lastMessageAt: serverTimestamp(),
    };
    for (const uid of uids) {
      await setDoc(doc(db, `artifacts/${appId}/users/${uid}/dms`, convoId), convoData, {merge: true});
    }
    openConversation(convoId);
  } else {
    // Private chat: single recipient
    const recipientInput = document.getElementById('private-chat-recipient');
    const recipientUid = recipientInput?.value?.trim();
    if (!recipientUid || recipientUid === user.uid) return showMessageBox('Invalid recipient', true);
    const name = document.getElementById('private-chat-name')?.value?.trim() || '';
    const image = document.getElementById('private-chat-image')?.value?.trim() || '';
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
    // Show recipient info in a table/list
    const recipientList = document.getElementById('private-chat-recipient-list');
    if (recipientList) {
      const profile = await getUserProfile(recipientUid);
      recipientList.innerHTML = `<table class='w-full text-xs'><tr><td><img src='${profile.photoURL || 'https://placehold.co/32x32/1F2937/E5E7EB?text=AV'}' class='rounded-full' style='width:24px;height:24px;'></td><td>${escapeHtml(profile.displayName)}</td><td>${escapeHtml(recipientUid)}</td></tr></table>`;
    }
    openConversation(convoId);
  }
}

// --- DM sendMessage implementation ---
async function sendMessage(event) {
  event.preventDefault();
  const user = getCurrentUser();
  if (!user || !currentConversationId) return;
  const input = document.getElementById('message-content-input');
  if (!input || !input.value.trim()) return;
  const content = input.value.trim();
  input.value = '';
  // Get conversation doc for current user
  const convoRef = doc(db, `artifacts/${appId}/users/${user.uid}/dms`, currentConversationId);
  // Get conversation data to find all participants
  const convoSnap = await getDoc(convoRef);
  const convo = convoSnap.exists() ? convoSnap.data() : null;
  if (!convo || !Array.isArray(convo.participants)) return;
  // Write message for all participants
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

// Patch recipient list rendering for group/private chat creation
async function renderRecipientList(uids, targetId) {
  const container = document.getElementById(targetId);
  if (!container) return;
  if (!uids || !uids.length) {
    container.innerHTML = '';
    return;
  }
  const profiles = await Promise.all(uids.map(getUserProfile));
  container.innerHTML = `<table class='w-full text-xs'>${profiles.map((p, i) => `<tr><td><img src='${p.photoURL || 'https://placehold.co/32x32/1F2937/E5E7EB?text=AV'}' class='rounded-full' style='width:24px;height:24px;'></td><td>${escapeHtml(p.displayName)}</td><td><span class='text-xs text-link'>${escapeHtml(uids[i])}</span></td></tr>`).join('')}</table>`;
}
