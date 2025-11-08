import {loadFooter} from "./core.js";
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
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import {appId, auth, db, getUserProfileFromFirestore} from "./firebase-init.js";
import {escapeHtml} from "./index.js";


/* forms.js: Forum-specific functionality for thémata, threads, and comments */

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
        const thematasCol = collection(db, `artifacts/${appId}/public/data/thematas`);
        const docRef = await addDoc(thematasCol, {
            name: name,
            description: description,
            createdAt: serverTimestamp(),
            createdBy: auth.currentUser.uid,
            creatorDisplayName: window.currentUser ? window.currentUser.displayName : "Anonymous",
        });

        await docRef.get(); // Ensure document is written
        showMessageBox("Théma created successfully!", false);

        // Clear form
        newThemaNameInput.value = "";
        newThemaDescriptionInput.value = "";

        return docRef.id;
    } catch (error) {
        console.error("Error creating théma:", error);
        showMessageBox(`Error creating théma: ${error.message}`, true);
        throw error;
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
      li.className = "thema-box";

      const header = document.createElement("div");
      header.className = "flex items-center justify-between mb-2";

      const collapseBtn = document.createElement("span");
      collapseBtn.className = "collapse-btn";
        collapseBtn.innerHTML = `<svg class="chevron transition-transform duration-200 text-link" width="16" height="16" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M6 8L10 12L14 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
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
      editBtn.className = "edit-thread-btn icon-btn btn-edit";
      editBtn.title = "Edit Thread";
        editBtn.innerHTML = '<svg class="w-5 h-5" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>';
      editBtn.onclick = () => openEditModal('thema', { themaId }, thema);

      const delBtn = document.createElement("button");
      delBtn.className = "delete-thread-btn icon-btn btn-delete";
      delBtn.title = "Delete Thread";
        delBtn.innerHTML = '<svg class="w-5 h-5" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>';
      delBtn.onclick = () => handleDelete('thema', { themaId });

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
      <div class="create-thread-form form-container flex flex-col md:flex-row items-center gap-2 bg-card rounded-lg shadow mb-2" data-thema-id="${themaId}" style="margin-bottom:0;">
        <input type="text" class="form-input flex-1 min-w-0 mb-0 bg-card text-text-primary border-input-border" placeholder="Thread title" required />
        <input type="text" class="form-input flex-1 min-w-0 mb-0 bg-card text-text-primary border-input-border" placeholder="Thread description" required />
        <button type="submit" class="btn-modern ml-0">Create Thread</button>
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
          const threadCollapseBtn = `<span class="collapse-btn" title="Collapse/Expand Thread" style="min-width:24px;min-height:24px;"><svg class="chevron transition-transform duration-200 text-link" width="16" height="16" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M6 8L10 12L14 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
        threadsHtml.push(`
          <div class="thread-header flex items-center gap-3 bg-card text-text-primary" data-thread-id="${threadDoc.id}" style="position:relative;">
            <img src="${photoURL}" alt="User" class="w-8 h-8 rounded-full object-cover mr-2" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">
            <div class="flex flex-col justify-center flex-1">
              <div class="flex items-center w-full">
                <span class="text-xs text-text-primary font-semibold">${escapeHtml(userProfile.displayName || "Anonymous")} <span class="text-meta-info ml-1">@${escapeHtml(userProfile.handle || "user")}</span></span>
                <div class="flex gap-2 ml-auto actions-right">
                  ${canEditThread ? `
                    <button class="edit-thread-btn btn-edit" title="Edit Thread">
                      <svg class="w-4 h-4" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                      </svg>
                    </button>
                    <button class="delete-thread-btn btn-delete" title="Delete Thread">
                      <svg class="w-4 h-4" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                      </svg>
                    </button>
                  ` : ""}
                </div>
              </div>
              <span class="font-bold text-lg leading-tight mb-0.5">${escapeHtml(thread.title || "Untitled Thread")}</span>
              <p class="comment-content text-sm mt-1 mb-0">${renderContent(thread.initialComment || "No description provided.")}</p>
              <div class="flex items-center justify-between mt-1 w-full">
                <div class="reactions-bar">${renderReactionButtons(thread.reactions, themaId, threadDoc.id)}</div>
                <span class="meta-info text-xs text-text-secondary ml-4">${createdAt}</span>
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
    // SVG connector for nested replies
    let connector = '';
    if (depth > 0) {
        connector = `<svg class="comment-connector-svg" width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><line x1='16' y1='0' x2='16' y2='100%' stroke='var(--color-input-border)' stroke-width='2' /><line x1='10' y1='24' x2='20' y2='24' stroke='var(--color-input-border)' stroke-width='2' /></svg>`;
    }
    return `
      <div class="thread-header depth-${depth} flex items-start text-text-primary mb-2 p-3" data-comment-id="${c.id}">
        ${connector}
        <img src="${photoURL}" alt="User" class="w-8 h-8 rounded-full object-cover mr-2 flex-shrink-0">
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between">
            <span class="text-xs text-text-primary font-semibold truncate">${escapeHtml(c.displayName || "Anonymous")} <span class="text-[10px] text-link ml-1">@${escapeHtml(c.handle || "user")}</span></span>
            <div class="flex gap-1 ml-2 actions-right">
              ${canEdit ? `
                <button class="edit-comment-btn btn-edit" title="Edit Comment">✏️</button>
                <button class="delete-comment-btn btn-delete" title="Delete Comment">🗑️</button>
              ` : ""}
            </div>
          </div>
          <div class="text-sm mt-0.5 mb-0.5 comment-content">${renderContent(c.content)}</div>
          <div class="flex items-center justify-between mt-1 w-full">
            <div class="flex items-center gap-2">
              <button class="reply-comment-btn btn-primary btn-blue text-xs px-2 py-0.5" data-comment-id="${c.id}">Reply</button>
              <div class="flex items-center gap-2 reactions-bar">${renderReactionButtons(c.reactions, themaId, threadId, c.id)}</div>
            </div>
            <span class="meta-info text-xs text-text-secondary text-right ml-2 whitespace-nowrap">${c.createdAt}</span>
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
    html += `<form class="add-comment-form form-container flex flex-col md:flex-row items-center gap-2 bg-card rounded-lg shadow mb-2" data-thema-id="${themaId}" data-thread-id="${threadId}">
      <textarea class="form-input flex-1 min-w-0 mb-0 text-sm bg-card text-text-primary border-input-border" placeholder="Add a comment..." rows="1" required style="min-width:120px;resize:vertical;"></textarea>
      <button type="submit" class="btn-modern text-sm ml-0">Add Comment</button>
    </form>`;
    // Render comments if any
    if (flat.length > 0) {
      html += renderNestedComments(tree, themaId, threadId);
    }
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
      const titleInput = form.querySelector('input[placeholder="Thread title"]');
      const descInput = form.querySelector('input[placeholder="Thread description"]');
      const commentInput = form.querySelector("textarea");
      if (titleInput.value.trim() && descInput.value.trim() && commentInput.value.trim()) {
        await addCommentThread(
          themaId,
          titleInput.value.trim(),
          descInput.value.trim(),
          commentInput.value.trim(),
        );
        titleInput.value = "";
        descInput.value = "";
        commentInput.value = "";
      }
    });
  });

  // Thread actions
  threadsContainer.querySelectorAll(".edit-thread-btn").forEach((button) => {
    button.addEventListener("click", async (event) => {
      const threadElem = event.target.closest("[data-thread-id]");
      if (!threadElem) return;
      const threadId = threadElem.dataset.threadId;
      const titleElem = threadElem.querySelector(".font-bold");
      const descElem = threadElem.querySelector(".comment-content");
      const oldTitle = titleElem ? titleElem.textContent : "";
      const oldDesc = descElem ? descElem.textContent : "";
      // Replace with input fields and Save/Cancel
      titleElem.innerHTML = `<input class='form-input w-full mb-1' value='${escapeHtml(oldTitle)}' />`;
      descElem.innerHTML = `<textarea class='form-input w-full mb-1' rows='2'>${escapeHtml(oldDesc)}</textarea>
        <div class='flex gap-2 mt-1'>
          <button class='save-edit-thread-btn btn-edit text-xs'>Save</button>
          <button class='cancel-edit-thread-btn btn-delete text-xs'>Cancel</button>
        </div>`;
      // Save handler
      descElem.querySelector('.save-edit-thread-btn').onclick = async () => {
        const newTitle = titleElem.querySelector('input').value.trim();
        const newDesc = descElem.querySelector('textarea').value.trim();
        if (!newTitle || !newDesc) return showMessageBox('Title and description required', true);
        await setDoc(doc(db, `artifacts/${appId}/public/data/thematas/${themaId}/threads`, threadId), { title: newTitle, initialComment: newDesc }, { merge: true });
        showMessageBox('Thread updated.');
        await loadThreadsForThema(themaId);
      };
      // Cancel handler
      descElem.querySelector('.cancel-edit-thread-btn').onclick = () => {
        titleElem.textContent = oldTitle;
        descElem.textContent = oldDesc;
      };
    });
  });

  threadsContainer.querySelectorAll(".delete-thread-btn").forEach((button) => {
    button.addEventListener("click", async (event) => {
      const threadElem = event.target.closest("[data-thread-id]");
      if (!threadElem) return;
      const threadId = threadElem.dataset.threadId;
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
          <button class='save-edit-comment-btn btn-modern text-xs'>Save</button>
          <button class='cancel-edit-comment-btn btn-modern text-xs'>Cancel</button>
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
        <button type='submit' class='btn-modern text-sm ml-0' style='margin-bottom:0;'>Reply</button>
        <button type='button' class='btn-modern text-sm ml-0 cancel-reply-btn' style='margin-bottom:0;'>Cancel</button>
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
async function addCommentThread(themaId, title, description, initialComment) {
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
      description: description,
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

// Helper: get current user info
async function getCurrentUserInfo() {
    try {
        if (window.currentUser) {
            return {
                uid: window.currentUser.uid,
                displayName: window.currentUser.displayName || "Anonymous",
                photoURL: window.currentUser.photoURL || "./defaultuser.png",
                isAdmin: window.currentUser.isAdmin || false,
            };
        }

        if (auth.currentUser) {
            const userProfile = await getUserProfileFromFirestore(auth.currentUser.uid);
            return {
                uid: auth.currentUser.uid,
                displayName: userProfile?.displayName || auth.currentUser.displayName || "Anonymous",
                photoURL: userProfile?.photoURL || auth.currentUser.photoURL || "./defaultuser.png",
                isAdmin: userProfile?.isAdmin || false,
            };
        }

        return {
            uid: null,
            displayName: "Anonymous",
            photoURL: "./defaultuser.png",
            isAdmin: false
        };
    } catch (error) {
        console.error("Error getting user info:", error);
        return {
            uid: null,
            displayName: "Anonymous",
            photoURL: "./defaultuser.png",
            isAdmin: false
        };
    }
}

// Initialize forms module
export async function init() {
    try {
        const userInfo = await getCurrentUserInfo();
        if (createThemaForm && userInfo.uid) {
            createThemaForm.classList.remove("hidden");
        }

        await Promise.all([
            initThemataListener(),
            loadFooter()
        ]);
    } catch (error) {
        console.error("Error initializing forms:", error);
        showMessageBox("Failed to initialize forms.", true);
    }
}

// Initialize themata listener
async function initThemataListener() {
    try {
        if (unsubscribeThematas) {
            await unsubscribeThematas();
        }

        const thematasRef = collection(db, `artifacts/${appId}/public/data/thematas`);
        const q = query(thematasRef, orderBy("createdAt", "desc"));

        unsubscribeThematas = onSnapshot(q, async (snapshot) => {
            try {
                const thematas = [];
                for (const doc of snapshot.docs) {
                    const data = doc.data();
                    thematas.push({
                        id: doc.id,
                        ...data,
                        createdAt: data.createdAt?.toDate?.() || new Date()
                    });
                }
                await renderThematas(thematas);
            } catch (error) {
                console.error("Error processing themata data:", error);
                showMessageBox("Error loading themata list.", true);
            }
        }, (error) => {
            console.error("Error in themata listener:", error);
            showMessageBox("Error watching themata updates.", true);
        });

        return unsubscribeThematas;
    } catch (error) {
        console.error("Error initializing themata listener:", error);
        showMessageBox("Failed to initialize themata updates.", true);
        throw error;
    }
}

// Cleanup function
export function cleanup() {
    if (unsubscribeThematas) {
        unsubscribeThematas()
            .catch(error => console.error("Error unsubscribing from thematas:", error));
        unsubscribeThematas = null;
    }
}

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
  const messagesContainer = document.getElementById('conversation-messages-container');
  if (!user || !tableBody || !messagesContainer) return;
  const userDmsCol = collection(db, `artifacts/${appId}/users/${user.uid}/dms`);
  const q = query(userDmsCol, orderBy('lastMessageAt', 'desc'));
  const snap = await getDocs(q);
  if (snap.empty) {
    tableBody.innerHTML = `<tr><td colspan=4 class="text-center text-text-secondary py-4">No conversations found.</td></tr>`;
    messagesContainer.style.display = 'none';
    return;
  }
  let html = '';
  let firstConvoId = null;
  for (const [idx, docSnap] of snap.docs.entries()) {
    const convo = docSnap.data();
    const convoId = docSnap.id;
    if (idx === 0) firstConvoId = convoId;
    const isActive = currentConversationId === convoId;
    // Fetch handles for participants (async, but render as loading first)
    let participantsHtml = '<span class="text-xs text-gray-400">Loading...</span>';
      await (async () => {
          const handles = await Promise.all((convo.participants || []).map(async uid => {
              if (uid === user.uid) return '';
              const p = await getUserProfile(uid);
              return p && p.handle ? `@${escapeHtml(p.handle)}` : `<span class='text-xs text-gray-400'>unknown</span>`;
          }));
          const row = tableBody.querySelector(`.conversation-row[data-convo-id='${convoId}'] td:nth-child(2)`);
          if (row) row.innerHTML = handles.filter(Boolean).join(', ');
    })();
    // Last message and date on same line, date in shorthand
    let lastMsg = convo.lastMessageContent ? escapeHtml(convo.lastMessageContent) : '';
    let lastDate = '';
    if (convo.lastMessageAt && convo.lastMessageAt.toDate) {
      const d = convo.lastMessageAt.toDate();
      lastDate = `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}, ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    }
    let photoURL = convo.image || convo.groupImage || '';
    if (!photoURL && convo.participants && convo.participants.length > 1) {
      const p = await getUserProfile(convo.participants.find(uid => uid !== user.uid));
      photoURL = p.photoURL || '';
    }
    html += `<tr class="conversation-row${isActive ? ' active' : ''}" data-convo-id="${convoId}" style="font-size:0.95em;">
      <td class="font-semibold"><img src="${photoURL || 'https://placehold.co/32x32/1F2937/E5E7EB?text=AV'}" alt="" class="dm-table-avatar" style="width:1.5em;height:1.5em;border-radius:50%;object-fit:cover;display:inline-block;margin-right:0.4em;vertical-align:middle;">${escapeHtml(convo.name || (convo.type === 'group' ? 'Group Chat' : 'Private Chat'))}</td>
      <td>${participantsHtml}</td>
      <td><span class="conversation-preview">${lastMsg}</span><span class="conversation-time">${lastDate}</span></td>
      <td class="actions-cell">
        <button class="edit-conversation-btn btn-edit" title="Edit" data-convo-id="${convoId}">✏️</button>
        <button class="delete-conversation-btn btn-delete" title="Delete" data-convo-id="${convoId}">🗑️</button>
      </td>
    </tr>`;
  }
  tableBody.innerHTML = html;
  // Row click: load messages and show message area
  tableBody.querySelectorAll('.conversation-row').forEach(row => {
    row.onclick = () => {
      const convoId = row.getAttribute('data-convo-id');
      openConversation(convoId);
      tableBody.querySelectorAll('.conversation-row').forEach(r => r.classList.remove('active'));
      row.classList.add('active');
      messagesContainer.style.display = '';
    };
  });
  // Delete button
  tableBody.querySelectorAll('.delete-conversation-btn').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const convoId = btn.getAttribute('data-convo-id');
      if (await showCustomConfirm('Delete this conversation?', 'This cannot be undone.')) {
        await deleteConversation(convoId);
          await renderConversationsTable();
        messagesContainer.style.display = 'none';
      }
    };
  });
  // Edit button
  tableBody.querySelectorAll('.edit-conversation-btn').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const convoId = btn.getAttribute('data-convo-id');
      const user = getCurrentUser();
      if (!user) return;
      const convoRef = doc(db, `artifacts/${appId}/users/${user.uid}/dms`, convoId);
      const convoSnap = await getDoc(convoRef);
      if (!convoSnap.exists()) return;
      const convo = convoSnap.data();
      const oldName = convo.name || '';
      const oldImage = convo.image || convo.groupImage || '';
      const newName = prompt('Edit DM name:', oldName);
      if (newName === null) return;
      const newImage = prompt('Edit DM photo URL:', oldImage);
      if (newImage === null) return;
      // Update for all participants
      for (const uid of convo.participants || []) {
        await setDoc(doc(db, `artifacts/${appId}/users/${uid}/dms`, convoId), {
          name: newName,
          image: convo.type === 'private' ? newImage : undefined,
          groupImage: convo.type === 'group' ? newImage : undefined,
        }, {merge: true});
      }
        await renderConversationsTable();
    };
  });
  // Auto-open the first conversation if none selected
  if (!currentConversationId && firstConvoId) {
      await openConversation(firstConvoId);
    const firstRow = tableBody.querySelector('.conversation-row[data-convo-id="' + firstConvoId + '"]');
    if (firstRow) firstRow.classList.add('active');
    messagesContainer.style.display = '';
  } else if (!currentConversationId) {
    messagesContainer.style.display = 'none';
  }
}

// Patch DM event setup to use new table
function setupDmEventListenersSafe() {
  waitForUserAuthReady(() => {
    showDmSections();
    const form = document.getElementById('send-message-form');
    if (form) form.onsubmit = sendMessage;
    const createForm = document.getElementById('create-conversation-form');
    if (createForm) createForm.onsubmit = createConversation;
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
  let name = document.getElementById('chat-name')?.value?.trim() || '';
  let image = document.getElementById('chat-image')?.value?.trim() || '';
  const recipientsInput = document.getElementById('chat-recipients');
  let handles = recipientsInput?.value?.split(',').map(x => x.trim().replace(/^@/, '')).filter(Boolean) || [];
  // Remove self from handles if present
  handles = handles.filter(h => h !== (user.handle || user.displayName || user.uid));
  // Convert handles to UIDs
  const handleToUid = async (handle) => {
    if (handle === (user.handle || user.displayName || user.uid)) return user.uid;
    const p = await getUserProfileFromFirestore(handle);
    return p && p.uid ? p.uid : handle;
  };
  const recipientUids = [];
  for (const h of handles) {
    const uid = await handleToUid(h);
    if (uid && !recipientUids.includes(uid)) recipientUids.push(uid);
  }
  // Auto-detect type
  let type = 'private';
  if (recipientUids.length > 1) type = 'group';
  // Always include self for group
  let allUids = type === 'group' ? [user.uid, ...recipientUids] : [user.uid, ...recipientUids];
  // Fallbacks
  if (!name) {
    if (type === 'private') {
      const p = await getUserProfile(recipientUids[0]);
      name = p.displayName || p.handle || 'DM';
    } else {
      name = allUids.map(uid => uid === user.uid ? (user.displayName || user.uid) : uid).join(', ');
    }
  }
  if (!image) {
    if (type === 'private') {
      const p = await getUserProfile(recipientUids[0]);
      image = p.photoURL || '';
    } else {
      const p = await getUserProfile(recipientUids[0]);
      image = p.photoURL || '';
    }
  }
  const convoId = allUids.sort().join('_');
  const convoData = {
    participants: allUids,
    name,
    image,
    type,
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    lastMessage: '',
    lastMessageAt: serverTimestamp(),
  };
  for (const uid of allUids) {
    await setDoc(doc(db, `artifacts/${appId}/users/${uid}/dms`, convoId), convoData, {merge: true});
  }
    await openConversation(convoId);
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
      let html = '';
      if (snap.empty) {
        html = '<div class="text-center text-gray-400">No messages yet</div>';
      } else {
        for (const docSnap of snap.docs) {
          const msg = docSnap.data();
          const isOwn = user && (msg.sender === user.uid || msg.sender === 'Alexxiconify');
          const profile = await getUserProfile(msg.sender);
          const handle = profile.handle ? `@${escapeHtml(profile.handle)}` : escapeHtml(msg.sender);
          const photoURL = profile.photoURL || 'https://placehold.co/32x32/1F2937/E5E7EB?text=AV';
          const bubbleClass = isOwn ? 'sent own-message' : 'received';
          const msgId = docSnap.id;
            html += `<div class="message-bubble ${bubbleClass}" style="max-width:70vw;margin:${isOwn ? '0 0 0 auto' : '0 auto 0 0'};border-radius:1.2em 1.2em ${isOwn ? '0.4em 1.2em' : '1.2em 0.4em'};padding:0.5em 0.9em;display:flex;align-items:flex-start;gap:0.5em;position:relative;width:fit-content;height:fit-content;">
            <div class="bubble-header">
              <img src="${photoURL}" alt="User" class="dm-message-profile-pic">
              <span class="message-author">${escapeHtml(profile.displayName)} <span class="text-xs text-link ml-1">${handle}</span></span>
            </div>
            <div style="flex:1;min-width:0;">
              <div class="message-content">${escapeHtml(msg.content)}</div>
              <div class="message-timestamp">${msg.createdAt ? new Date(msg.createdAt.toDate()).toLocaleString() : ''}</div>
            </div>
            <div class="bubble-actions flex gap-1 ml-2" style="position:absolute;top:0.3em;right:0.7em;z-index:2;">
              <button class="edit-msg-btn btn-edit icon-btn" data-msg-id="${msgId}" title="Edit"><svg class="w-4 h-4" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg></button>
              <button class="delete-msg-btn btn-delete icon-btn" data-msg-id="${msgId}" title="Delete"><svg class="w-4 h-4" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
            </div>
          </div>`;
        }
      }
      // Add the message input field below the messages
      html += `<div id="message-input-area" class="p-4 border-t border-input-border">
        <form class="flex flex-row gap-2 items-end w-full" id="send-message-form">
          <input class="form-input bg-card text-text-primary border-none rounded w-full flex-1" id="message-content-input" placeholder="Type a message..." autocomplete="off" />
          <button class="btn-modern ml-auto" type="submit">➤</button>
        </form>
      </div>`;
      container.innerHTML = html;
      container.scrollTop = container.scrollHeight;
      // Re-attach send message event
      const form = document.getElementById('send-message-form');
      if (form) form.onsubmit = sendMessage;
      // Attach edit/delete handlers
      container.querySelectorAll('.edit-msg-btn').forEach(btn => {
        btn.onclick = async (e) => {
          const msgId = btn.getAttribute('data-msg-id');
          const msgDiv = btn.closest('.message-bubble');
          const oldContent = msgDiv.querySelector('.message-content').textContent;
          const newContent = prompt('Edit message:', oldContent);
          if (newContent !== null && newContent.trim() && newContent !== oldContent) {
            const msgRef = doc(db, `artifacts/${appId}/users/${user.uid}/dms/${convoId}/messages`, msgId);
            await setDoc(msgRef, {content: newContent}, {merge: true});
          }
        };
      });
      container.querySelectorAll('.delete-msg-btn').forEach(btn => {
        btn.onclick = async (e) => {
          const msgId = btn.getAttribute('data-msg-id');
          if (confirm('Delete this message?')) {
            const msgRef = doc(db, `artifacts/${appId}/users/${user.uid}/dms/${convoId}/messages`, msgId);
            await deleteDoc(msgRef);
          }
        };
      });
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

// Minimal helper for DM user profile
async function getUserProfile(uid) {
  const p = await getUserProfileFromFirestore(uid);
  return p || {displayName: 'Anonymous', handle: 'user', photoURL: null};
}

// --- Edit and Delete Button Logic Unification ---
// Helper: Open edit modal or prompt for all editable fields
function openEditModal(type, ids, data) {
  // type: 'thema', 'thread', 'comment'
  // ids: {themaId, threadId, commentId}
  // data: {name, description, title, content, ...}
  let fields = [];
  let labels = [];
  let values = [];
  if (type === 'thema') {
    fields = ['name', 'description'];
    labels = ['Théma Name', 'Théma Description'];
    values = [data.name || '', data.description || ''];
  } else if (type === 'thread') {
    fields = ['title', 'description'];
    labels = ['Thread Title', 'Thread Description'];
    values = [data.title || '', data.description || ''];
  } else if (type === 'comment') {
    fields = ['content'];
    labels = ['Comment'];
    values = [data.content || ''];
  }
  // Use prompt for each field (simple, can be replaced with modal)
  let newValues = [];
  for (let i = 0; i < fields.length; ++i) {
    const v = prompt(`Edit ${labels[i]}:`, values[i]);
    if (v === null) return; // Cancelled
    newValues.push(v);
  }
  // Save changes
  if (type === 'thema') {
    setDoc(doc(db, `artifacts/${appId}/public/data/thematas`, ids.themaId), { name: newValues[0], description: newValues[1] }, { merge: true });
    showMessageBox('Théma updated.');
  } else if (type === 'thread') {
    setDoc(doc(db, `artifacts/${appId}/public/data/thematas/${ids.themaId}/threads`, ids.threadId), { title: newValues[0], description: newValues[1] }, { merge: true });
    showMessageBox('Thread updated.');
  } else if (type === 'comment') {
    setDoc(doc(db, `artifacts/${appId}/public/data/thematas/${ids.themaId}/threads/${ids.threadId}/comments`, ids.commentId), { content: newValues[0] }, { merge: true });
    showMessageBox('Comment updated.');
  }
}

let ids;
ids.commentId = function () {

};

// Helper: Unified delete confirmation and action
async function handleDelete(type, ids) {
  let msg = '';
  if (type === 'thema') msg = 'Delete this Théma and all its threads and comments?';
  else if (type === 'thread') msg = 'Delete this thread and all its comments?';
  else if (type === 'comment') msg = 'Delete this comment?';
  const confirmed = await showCustomConfirm(msg, 'This action cannot be undone.');
  if (!confirmed) return;
  if (type === 'thema') await deleteThemaAndSubcollections(ids.themaId);
  else if (type === 'thread') await deleteThreadAndSubcollection(ids.themaId, ids.threadId);
  else if (type === 'comment') await deleteComment(ids.themaId, ids.threadId, ids.commentId);
}

// Blocked users management
async function showBlockedUsers() {
    const user = getCurrentUser();
    if (!user) {
        showMessageBox("You must be logged in to view blocked users.", true);
        return;
    }

    try {
        // Get the user's blocked users list from Firestore
        const userRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, user.uid);
        const userDoc = await getDoc(userRef);
        const blockedUsers = userDoc.data()?.blockedUsers || [];

        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.className = 'modal';
        modalContent.innerHTML = `
            <div class="modal-content bg-card text-text-primary p-6 rounded-lg shadow-xl max-w-lg mx-auto">
                <h2 class="text-2xl font-bold mb-4">Blocked Users</h2>
                <div class="blocked-users-list space-y-3">
                    ${blockedUsers.length ? blockedUsers.map(blockedId => `
                        <div class="blocked-user-item flex items-center justify-between p-3 bg-bg-secondary rounded-lg" data-user-id="${blockedId}">
                            <div class="flex items-center gap-3">
                                <img src="./defaultuser.png" alt="User avatar" class="w-8 h-8 rounded-full">
                                <div class="flex flex-col">
                                    <span class="font-semibold text-text-primary loading-user-name">Loading...</span>
                                    <span class="text-sm text-text-secondary loading-user-handle">@loading...</span>
                                </div>
                            </div>
                            <button class="unblock-user-btn btn-modern" onclick="unblockUser('${blockedId}')">
                                Unblock
                            </button>
                        </div>
                    `).join('') : '<p class="text-text-secondary text-center py-4">No blocked users</p>'}
                </div>
                <div class="mt-6 flex justify-end">
                    <button class="btn-modern" onclick="this.closest('.modal').remove()">Close</button>
                </div>
            </div>
        `;

        // Add modal to body
        document.body.appendChild(modalContent);

        // Load user details for each blocked user
        for (const blockedId of blockedUsers) {
            try {
                const blockedUserRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, blockedId);
                const blockedUserDoc = await getDoc(blockedUserRef);
                const blockedUserData = blockedUserDoc.data();

                const userItem = modalContent.querySelector(`[data-user-id="${blockedId}"]`);
                if (userItem && blockedUserData) {
                    const nameElem = userItem.querySelector('.loading-user-name');
                    const handleElem = userItem.querySelector('.loading-user-handle');
                    const avatarElem = userItem.querySelector('img');

                    if (nameElem) nameElem.textContent = blockedUserData.displayName || 'Unknown User';
                    if (handleElem) handleElem.textContent = blockedUserData.handle ? `@${blockedUserData.handle}` : '@unknown';
                    if (avatarElem && blockedUserData.photoURL) avatarElem.src = blockedUserData.photoURL;
                }
            } catch (error) {
                console.error(`Error loading blocked user ${blockedId}:`, error);
            }
        }
    } catch (error) {
        console.error('Error showing blocked users:', error);
        showMessageBox('Failed to load blocked users', true);
    }
}

// Function to unblock a user
async function unblockUser(blockedUserId) {
    const user = getCurrentUser();
    if (!user) {
        showMessageBox("You must be logged in to unblock users.", true);
        return;
    }

    try {
        const userRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, user.uid);
        const userDoc = await getDoc(userRef);
        const currentBlockedUsers = userDoc.data()?.blockedUsers || [];

        // Remove the user from blocked list
        const updatedBlockedUsers = currentBlockedUsers.filter(id => id !== blockedUserId);

        // Update Firestore
        await updateDoc(userRef, {
            blockedUsers: updatedBlockedUsers
        });

        // Update UI
        const blockedUserElem = document.querySelector(`[data-user-id="${blockedUserId}"]`);
        if (blockedUserElem) {
            blockedUserElem.remove();
        }

        // Show success message
        showMessageBox("User unblocked successfully");

        // Refresh blocked users list if empty
        const blockedListContainer = document.querySelector('.blocked-users-list');
        if (blockedListContainer && !blockedListContainer.children.length) {
            blockedListContainer.innerHTML = '<p class="text-text-secondary text-center py-4">No blocked users</p>';
        }
    } catch (error) {
        console.error('Error unblocking user:', error);
        showMessageBox('Failed to unblock user', true);
    }
}

// Initialize global functions
window.showBlockedUsers = showBlockedUsers;
window.unblockUser = unblockUser;