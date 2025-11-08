import {
    auth,
    collection,
    COLLECTIONS,
    db,
    doc,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    where
} from './firebase-init.js';
import {showMessageBox} from './utils.js';

class DMsManager {
    constructor() {
        this.currentUser = null;
        this.activeChats = new Map();
        this.messageListeners = new Map();
    }

    async init() {
        this.currentUser = auth.currentUser;
        if (!this.currentUser) return;

        try {
            return await this.loadUserDMs();
        } catch (error) {
            console.error('Error initializing DMs:', error);
            showMessageBox('Failed to load messages', true);
        }
    }

    async loadUserDMs() {
        if (!this.currentUser) return [];

        try {
            const dmsRef = collection(db, COLLECTIONS.DMS(this.currentUser.uid));
            const dmsSnap = await getDocs(dmsRef);
            return dmsSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error loading DMs:', error);
            return [];
        }
    }

    async getOrCreateDM(otherUserId) {
        if (!this.currentUser || !otherUserId) return null;

        try {
            // Check if DM already exists
            const dmsRef = collection(db, COLLECTIONS.DMS(this.currentUser.uid));
            const q = query(dmsRef, where('participants', 'array-contains', otherUserId));
            const dmsSnap = await getDocs(q);

            if (!dmsSnap.empty) {
                return {id: dmsSnap.docs[0].id, ...dmsSnap.docs[0].data()};
            }

            // Create new DM
            const dmData = {
                createdAt: serverTimestamp(),
                participants: [this.currentUser.uid, otherUserId],
                lastMessage: null,
                lastMessageAt: null
            };

            const newDmRef = doc(collection(db, COLLECTIONS.DMS(this.currentUser.uid)));
            await setDoc(newDmRef, dmData);

            // Create reciprocal DM document
            await setDoc(doc(db, COLLECTIONS.DMS(otherUserId), newDmRef.id), dmData);

            return {id: newDmRef.id, ...dmData};
        } catch (error) {
            console.error('Error creating DM:', error);
            showMessageBox('Failed to create conversation', true);
            return null;
        }
    }

    async sendMessage(dmId, content) {
        if (!this.currentUser || !dmId || !content) return null;

        try {
            const messageRef = doc(collection(db, COLLECTIONS.MESSAGES(this.currentUser.uid, dmId)));
            const messageData = {
                content,
                sender: this.currentUser.uid,
                createdAt: serverTimestamp(),
                read: false
            };

            await setDoc(messageRef, messageData);

            // Update last message in DM document
            const dmRef = doc(db, COLLECTIONS.DMS(this.currentUser.uid), dmId);
            await setDoc(dmRef, {
                lastMessage: content,
                lastMessageAt: serverTimestamp()
            }, {merge: true});

            return {id: messageRef.id, ...messageData};
        } catch (error) {
            console.error('Error sending message:', error);
            showMessageBox('Failed to send message', true);
            return null;
        }
    }

    subscribeToMessages(dmId, callback) {
        if (!this.currentUser || !dmId) return;

        // Unsubscribe from existing listener
        if (this.messageListeners.has(dmId)) {
            this.messageListeners.get(dmId)();
        }

        const messagesRef = collection(db, COLLECTIONS.MESSAGES(this.currentUser.uid, dmId));
        const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(50));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const messages = [];
            snapshot.forEach(doc => {
                messages.push({id: doc.id, ...doc.data()});
            });
            callback(messages.reverse());
        }, (error) => {
            console.error('Error listening to messages:', error);
            showMessageBox('Failed to load messages', true);
        });

        this.messageListeners.set(dmId, unsubscribe);
        return unsubscribe;
    }

    unsubscribeFromMessages(dmId) {
        if (this.messageListeners.has(dmId)) {
            this.messageListeners.get(dmId)();
            this.messageListeners.delete(dmId);
        }
    }

    cleanup() {
        this.messageListeners.forEach(unsubscribe => unsubscribe());
        this.messageListeners.clear();
        this.activeChats.clear();
    }
}

export const dmsManager = new DMsManager();