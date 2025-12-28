import {
    auth,
    COLLECTIONS,
    db,
    getUserProfileFromFirestore,
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    deleteDoc,
    where,
    onSnapshot
} from './firebase-init.js';
import {showMessageBox} from './utils.js';
import {initializePage, loadNavbar} from './core.js';
import {themeManager} from './theme-manager.js';
import {HARD_CODED_ADMIN_UID} from './constants.js';

const ASSETS = {DEFAULT_USER: './defaultuser.png'};

class ForumsManager {
    currentUser = null;
    userProfile = null;
    selectedUserId = null;
    currentDMId = null;
    messageUnsubscribe = null;

    getDMSRef() { return collection(db, COLLECTIONS.DMS); }
    getDMDocRef(dmId) { return doc(db, COLLECTIONS.DMS, dmId); }
    getMessagesRef() { return collection(db, COLLECTIONS.MESSAGES); }

    async init() {
        try {
            this.currentUser = auth.currentUser;
            if (this.currentUser) this.userProfile = await getUserProfileFromFirestore(this.currentUser.uid);
            await initializePage('forms');
            await themeManager.init();
            await loadNavbar(this.currentUser, this.userProfile);
            this.setupTabs();
            this.setupCreateThread();
            this.setupCreateMessage();
            await this.loadForums();
            await this.loadMessages();
        } catch (error) { console.error('Init error:', error); }
    }

    setupTabs() {
        const btns = { forums: document.getElementById('forums-tab-btn'), messages: document.getElementById('messages-tab-btn') };
        const tabs = { forums: document.getElementById('forums-tab'), messages: document.getElementById('messages-tab') };
        const switchTab = (active) => Object.keys(btns).forEach(k => {
            btns[k]?.classList.toggle('active', k === active);
            tabs[k]?.classList.toggle('active', k === active);
        });
        btns.forums?.addEventListener('click', () => switchTab('forums'));
        btns.messages?.addEventListener('click', () => switchTab('messages'));
    }

    setupCreateThread() {
        const form = document.getElementById('create-thread-form');
        document.getElementById('create-thread-btn')?.addEventListener('click', () => form?.classList.toggle('visible'));
        document.getElementById('cancel-thread-btn')?.addEventListener('click', () => form?.classList.remove('visible'));
        document.getElementById('new-thread-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!auth.currentUser) return showMessageBox('Sign in required', true);
            try {
                await addDoc(collection(db, COLLECTIONS.FORMS), {
                    title: document.getElementById('thread-title')?.value.trim(),
                    description: document.getElementById('thread-description')?.value.trim(),
                    category: document.getElementById('thread-category')?.value,
                    tags: (document.getElementById('thread-tags')?.value || '').split(',').map(t => t.trim()).filter(Boolean),
                    createdAt: serverTimestamp(),
                    authorId: auth.currentUser.uid,
                    createdBy: auth.currentUser.displayName || auth.currentUser.email,
                    pinned: false, reactions: {}
                });
                showMessageBox('Thread created!');
                form?.classList.remove('visible');
                e.target.reset();
                await this.loadForums();
            } catch (error) { showMessageBox('Failed to create thread', true); }
        });
    }

    setupCreateMessage() {
        const form = document.getElementById('create-message-form');
        const searchInput = document.getElementById('recipient-search');
        const searchResults = document.getElementById('search-results');
        const startBtn = document.getElementById('start-conversation-btn');

        document.getElementById('create-message-btn')?.addEventListener('click', () => {
            form.style.display = form.style.display === 'none' ? 'block' : 'none';
            if (form.style.display !== 'none') searchInput?.focus();
        });

        document.getElementById('cancel-message-btn')?.addEventListener('click', () => {
            form.style.display = 'none';
            searchInput.value = '';
            searchResults.style.display = 'none';
            this.selectedUserId = null;
            startBtn.disabled = true;
        });

        searchInput?.addEventListener('input', async (e) => {
            const q = e.target.value.trim().toLowerCase();
            if (q.length < 2) return searchResults.style.display = 'none';
            const users = await this.searchUsers(q);
            this.displaySearchResults(users, searchResults);
            searchResults.querySelectorAll('.user-search-result').forEach(res => {
                res.addEventListener('click', () => {
                    this.selectedUserId = res.dataset.userId;
                    startBtn.disabled = false;
                    searchResults.style.display = 'none';
                    searchInput.value = res.dataset.userName;
                });
            });
        });

        startBtn?.addEventListener('click', async () => {
            if (!this.selectedUserId || !auth.currentUser) return;
            const dmId = await this.createOrGetConversation(auth.currentUser.uid, this.selectedUserId);
            form.style.display = 'none';
            await this.loadMessages();
            const dmItem = document.querySelector(`[data-dm-id="${dmId}"]`);
            if (dmItem) dmItem.click();
        });
    }

    async searchUsers(queryStr) {
        const snapshot = await getDocs(collection(db, COLLECTIONS.USER_PROFILES));
        const results = [];
        snapshot.forEach(doc => {
            const user = doc.data();
            if (doc.id === auth.currentUser?.uid) return;
            if (doc.id.toLowerCase().includes(queryStr) || (user.displayName || '').toLowerCase().includes(queryStr) || (user.handle || '').toLowerCase().includes(queryStr)) {
                results.push({ id: doc.id, displayName: user.displayName || user.email || 'User', handle: user.handle || '', photoURL: user.photoURL || ASSETS.DEFAULT_USER });
            }
        });
        return results;
    }

    displaySearchResults(users, container) {
        container.innerHTML = users.length ? users.map(u => `
            <div class="user-search-result" data-user-id="${u.id}" data-user-name="${u.displayName}" style="padding:0.75rem;border-bottom:1px solid var(--color-accent-dark);cursor:pointer;display:flex;gap:0.75rem;align-items:center;">
                <img src="${u.photoURL}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;">
                <div>
                    <div style="font-weight:600;">${u.displayName}</div>
                    ${u.handle ? `<div style="font-size:0.75rem;color:var(--color-text-2);">@${u.handle}</div>` : ''}
                </div>
            </div>`).join('') : '<div style="padding:0.75rem;">No users found</div>';
        container.style.display = 'block';
    }

    async createOrGetConversation(currentUserId, recipientUserId) {
        const q = query(this.getDMSRef(), where('participants', 'array-contains', currentUserId));
        const existing = await getDocs(q);
        for (const d of existing.docs) if (d.data().participants?.includes(recipientUserId)) return d.id;
        const recipient = await getUserProfileFromFirestore(recipientUserId);
        const current = await getUserProfileFromFirestore(currentUserId);
        const id = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await setDoc(this.getDMDocRef(id), {
            participants: [currentUserId, recipientUserId], createdAt: serverTimestamp(), lastMessage: '', lastMessageTime: serverTimestamp(),
            participantNames: { [currentUserId]: current?.displayName || 'User', [recipientUserId]: recipient?.displayName || 'User' }
        });
        return id;
    }

    async loadForums() {
        const list = document.getElementById('forums-list');
        if (!list) return;
        list.innerHTML = 'Loading...';
        const threads = await getDocs(query(collection(db, COLLECTIONS.FORMS), orderBy('createdAt', 'desc')));
        const elements = await Promise.all(threads.docs.map(d => this.createThreadElement(d)));
        list.innerHTML = elements.join('');
    }

    async createThreadElement(doc) {
        const t = doc.data();
        const id = doc.id;
        const emoji = {announcements: '📢', gaming: '🎮', discussion: '💬', support: '🤝', feedback: '💡'}[t.category] || '📝';
        let authorDisplay = t.createdBy || 'Unknown';
        if (t.authorId) {
            const p = await getUserProfileFromFirestore(t.authorId);
            authorDisplay = p?.handle ? `${p.displayName} <span style="font-size:0.75rem;color:var(--color-text-2);">@${p.handle}</span>` : (p?.displayName || authorDisplay);
        }
        const posts = (await getDocs(collection(db, COLLECTIONS.FORMS, id, COLLECTIONS.SUBMISSIONS))).size;
        return `<div class="forum-thread" id="thread-${id}">
            <div class="forum-thread-header" data-thread-id="${id}">
                <button class="forum-toggle-btn">▼</button>
                <div class="forum-content">
                    <h3 class="forum-title">${emoji} ${t.title}</h3>
                    <div class="forum-meta">By ${authorDisplay} • ${posts} posts</div>
                </div>
            </div>
            <div class="forum-body" id="body-${id}">
                <p>${t.description}</p>
                <div id="comments-${id}"></div>
                ${auth.currentUser ? `<form data-thread-id="${id}" class="comment-form"><textarea placeholder="Comment..."></textarea><button type="submit">Post</button></form>` : ''}
            </div>
        </div>`;
    }

    async toggleThread(id) {
        const body = document.getElementById(`body-${id}`);
        if (!body) return;
        if (body.classList.toggle('expanded')) await this.loadComments(id);
    }

    async loadComments(threadId) {
        const container = document.getElementById(`comments-${threadId}`);
        if (!container) return;
        const list = await getDocs(query(collection(db, COLLECTIONS.FORMS, threadId, COLLECTIONS.SUBMISSIONS), orderBy('createdAt', 'asc')));
        const comments = await Promise.all(list.docs.map(async d => {
            const data = d.data();
            const author = data.authorId ? await getUserProfileFromFirestore(data.authorId) : null;
            return {
                ...data,
                id: d.id,
                replies: [],
                authorName: author?.displayName || 'Anonymous',
                authorHandle: author?.handle || null,
                authorPhoto: author?.photoURL || ASSETS.DEFAULT_USER
            };
        }));
        const map = new Map(comments.map(c => [c.id, c]));
        const roots = [];
        comments.forEach(c => c.parentCommentId ? map.get(c.parentCommentId)?.replies.push(c) : roots.push(c));
        container.innerHTML = roots.map(c => this.renderComment(c, threadId, 0)).join('');
    }

    calculateVotes(reactions) {
        let score = 0, userVote = null;
        Object.keys(reactions || {}).forEach(k => {
            const [emoji, uid] = k.split('_');
            if (emoji === '👍') { score++; if (uid === auth.currentUser?.uid) userVote = '👍'; }
            else if (emoji === '👎') { score--; if (uid === auth.currentUser?.uid) userVote = '👎'; }
        });
        return { score, userVote };
    }

    renderComment(c, threadId, depth) {
        const { score, userVote } = this.calculateVotes(c.reactions);
        const canEdit = auth.currentUser?.uid === c.authorId;
        const isAdmin = auth.currentUser?.uid === HARD_CODED_ADMIN_UID;
        return `<div class="comment depth-${Math.min(depth, 3)}" data-comment-id="${c.id}">
            <div class="comment-header" style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;">
                <img src="${c.authorPhoto}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">
                <span style="font-weight:600;">${c.authorName}</span>
                ${c.authorHandle ? `<span style="font-size:0.75rem;color:var(--color-text-2);">@${c.authorHandle}</span>` : ''}
            </div>
            <div class="comment-text" id="text-${c.id}">${c.content}</div>
            <div class="comment-actions">
                <button data-action="reply" data-comment-id="${c.id}">Reply</button>
                <button data-action="vote" data-comment-id="${c.id}" data-thread-id="${threadId}" data-emoji="👍" class="${userVote === '👍' ? 'active' : ''}">👍</button>
                <button data-action="vote" data-comment-id="${c.id}" data-thread-id="${threadId}" data-emoji="👎" class="${userVote === '👎' ? 'active' : ''}">👎</button>
                <span>${score}</span>
                <button data-action="emoji" data-comment-id="${c.id}" data-thread-id="${threadId}">😊</button>
                ${canEdit ? `<button data-action="edit" data-comment-id="${c.id}" data-thread-id="${threadId}">Edit</button>` : ''}
                ${(canEdit || isAdmin) ? `<button data-action="delete" data-comment-id="${c.id}" data-thread-id="${threadId}" data-is-admin="${isAdmin && !canEdit}">Delete</button>` : ''}
            </div>
            <div id="emoji-picker-${c.id}" style="display:none;"></div>
            <div id="edit-form-${c.id}" style="display:none;"><textarea id="edit-text-${c.id}">${c.content}</textarea><button data-action="save-edit" data-comment-id="${c.id}" data-thread-id="${threadId}">Save</button></div>
            <div id="reply-${c.id}" style="display:none;"><textarea></textarea><button data-action="submit-reply" data-comment-id="${c.id}" data-thread-id="${threadId}">Post</button></div>
            ${c.replies?.length ? `<div class="replies">${c.replies.map(r => this.renderComment(r, threadId, depth + 1)).join('')}</div>` : ''}
        </div>`;
    }

    async handleAction(btn) {
        const { action, commentId, threadId, emoji, isAdmin } = btn.dataset;
        const toggle = (id) => { const el = document.getElementById(id); if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none'; };
        if (action === 'reply') toggle(`reply-${commentId}`);
        if (action === 'edit') toggle(`edit-form-${commentId}`);
        if (action === 'emoji') this.toggleEmojiPicker(commentId, threadId);
        if (action === 'vote') await this.voteComment(threadId, commentId, emoji);
        if (action === 'delete') await this.deleteComment(commentId, threadId, isAdmin);
        if (action === 'custom-react') await this.reactComment(threadId, commentId, emoji);
        if (action === 'save-edit') await this.submitEdit(commentId, threadId);
        if (action === 'submit-reply') await this.submitReply(commentId, threadId);
    }

    toggleEmojiPicker(commentId, threadId) {
        const el = document.getElementById(`emoji-picker-${commentId}`);
        if (!el) return;
        if (el.style.display === 'none') {
            const ems = ['❤️', '😂', '🔥', '👀', '😍', '🙏', '💯', '✨', '🎉', '🚀'];
            el.innerHTML = ems.map(e => `<button data-action="custom-react" data-comment-id="${commentId}" data-thread-id="${threadId}" data-emoji="${e}">${e}</button>`).join('');
            el.style.display = 'block';
        } else el.style.display = 'none';
    }

    async voteComment(tId, cId, emoji) {
        if (!auth.currentUser) return;
        const ref = doc(db, COLLECTIONS.FORMS, tId, COLLECTIONS.SUBMISSIONS, cId);
        const snap = await getDoc(ref);
        const reacts = snap.data()?.reactions || {};
        const key = `${emoji}_${auth.currentUser.uid}`;
        const other = `${emoji === '👍' ? '👎' : '👍'}_${auth.currentUser.uid}`;
        delete reacts[other];
        reacts[key] ? delete reacts[key] : reacts[key] = true;
        await updateDoc(ref, { reactions: reacts });
        await this.loadComments(tId);
    }

    async reactComment(tId, cId, emoji) {
        if (!auth.currentUser) return;
        const ref = doc(db, COLLECTIONS.FORMS, tId, COLLECTIONS.SUBMISSIONS, cId);
        const snap = await getDoc(ref);
        const reacts = snap.data()?.reactions || {};
        const key = `${emoji}_${auth.currentUser.uid}`;
        reacts[key] ? delete reacts[key] : reacts[key] = true;
        await updateDoc(ref, { reactions: reacts });
        await this.loadComments(tId);
    }

    async submitEdit(cId, tId) {
        const text = document.getElementById(`edit-text-${cId}`)?.value.trim();
        if (!text) return;
        await updateDoc(doc(db, COLLECTIONS.FORMS, tId, COLLECTIONS.SUBMISSIONS, cId), { content: text, editedAt: serverTimestamp() });
        await this.loadComments(tId);
    }

    async submitReply(cId, tId) {
        const text = document.querySelector(`#reply-${cId} textarea`).value.trim();
        if (!text) return;
        await addDoc(collection(db, COLLECTIONS.FORMS, tId, COLLECTIONS.SUBMISSIONS), {
            content: text, authorId: auth.currentUser.uid, parentCommentId: cId, createdAt: serverTimestamp(), reactions: {}
        });
        await this.loadComments(tId);
    }

    async deleteComment(cId, tId, isAdmin) {
        if (isAdmin === 'true') await updateDoc(doc(db, COLLECTIONS.FORMS, tId, COLLECTIONS.SUBMISSIONS, cId), { content: '===REMOVED BY ADMIN===', censored: true });
        else if (confirm('Delete?')) await deleteDoc(doc(db, COLLECTIONS.FORMS, tId, COLLECTIONS.SUBMISSIONS, cId));
        await this.loadComments(tId);
    }

    async loadMessages() {
        const list = document.getElementById('dm-list');
        if (!list || !auth.currentUser) return;
        const q = query(this.getDMSRef(), where('participants', 'array-contains', auth.currentUser.uid));
        const dms = await getDocs(q);
        if (dms.empty) {
            await this.ensureNotes();
            await this.loadMessages(); // Re-run to show notes
            return;
        }
        const items = await Promise.all(dms.docs.map(async d => {
            const data = d.data();
            const other = data.participants.find(p => p !== auth.currentUser.uid);
            const p = other ? await getUserProfileFromFirestore(other) : null;
            return { id: d.id, name: p?.displayName || 'My Notes', photo: p?.photoURL || ASSETS.DEFAULT_USER };
        }));
        list.innerHTML = items.map(i => `<div class="dm-item" data-dm-id="${i.id}"><img src="${i.photo}"><span>${i.name}</span></div>`).join('');
    }

    async ensureNotes() {
        const id = `notes_${auth.currentUser.uid}`;
        await setDoc(this.getDMDocRef(id), { participants: [auth.currentUser.uid], createdAt: serverTimestamp(), lastMessage: 'Notes', lastMessageTime: serverTimestamp() });
    }

    async loadDMMessages(dmId) {
        if (this.messageUnsubscribe) this.messageUnsubscribe();
        this.currentDMId = dmId;
        
        // Update header
        const dmDoc = await getDoc(this.getDMDocRef(dmId));
        if (dmDoc.exists()) {
            const data = dmDoc.data();
            const other = data.participants.find(p => p !== auth.currentUser.uid);
            const p = other ? await getUserProfileFromFirestore(other) : null;
            document.getElementById('dm-header').textContent = p?.displayName || 'My Notes';
        }

        const q = query(this.getMessagesRef(), where('conversationId', '==', dmId), orderBy('createdAt', 'asc'));
        this.messageUnsubscribe = onSnapshot(q, (snapshot) => {
            document.getElementById('dm-body').innerHTML = snapshot.docs.map(d => `<div class="msg ${d.data().sender === auth.currentUser.uid ? 'mine' : 'theirs'}">${d.data().content}</div>`).join('');
            document.getElementById('dm-body').scrollTop = document.getElementById('dm-body').scrollHeight;
        });
        document.getElementById('dm-form').style.display = 'flex';
    }

    async sendDMMessage() {
        const input = document.getElementById('dm-input');
        const content = input.value.trim();
        if (!content || !this.currentDMId) return;
        const snap = await getDoc(this.getDMDocRef(this.currentDMId));
        await addDoc(this.getMessagesRef(), {
            conversationId: this.currentDMId, content, sender: auth.currentUser.uid,
            receiverIds: snap.data().participants.filter(p => p !== auth.currentUser.uid), createdAt: serverTimestamp()
        });
        input.value = '';
    }

    setupEventDelegation() {
        document.addEventListener('click', e => {
            const header = e.target.closest('.forum-thread-header');
            if (header) return this.toggleThread(header.dataset.threadId);
            const dmItem = e.target.closest('.dm-item');
            if (dmItem) return this.loadDMMessages(dmItem.dataset.dmId);
            const btn = e.target.closest('[data-action]');
            if (btn) this.handleAction(btn);
        });
        document.addEventListener('submit', e => {
            if (e.target.classList.contains('comment-form')) { e.preventDefault(); this.postComment(e, e.target.dataset.threadId); }
        });
        document.getElementById('dm-send-btn')?.addEventListener('click', () => this.sendDMMessage());
        document.getElementById('dm-input')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendDMMessage(); }
        });
    }

    async postComment(e, tId) {
        const text = e.target.querySelector('textarea').value.trim();
        if (!text) return;
        await addDoc(collection(db, COLLECTIONS.FORMS, tId, COLLECTIONS.SUBMISSIONS), { content: text, authorId: auth.currentUser.uid, createdAt: serverTimestamp(), reactions: {} });
        e.target.reset();
        await this.loadComments(tId);
    }
}

const forumsManager = new ForumsManager();
window.forumsManager = forumsManager;
document.addEventListener('DOMContentLoaded', () => { forumsManager.init(); forumsManager.setupEventDelegation(); });
export { forumsManager, ForumsManager };