import {
    auth,
    collection,
    COLLECTIONS,
    db,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
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

    async getDM(dmId) {
        if (!this.currentUser || !dmId) return null;

        try {
            const dmRef = doc(db, COLLECTIONS.DMS(this.currentUser.uid), dmId);
            const dmDoc = await getDoc(dmRef);

            if (!dmDoc.exists()) return null;

            return {
                id: dmDoc.id,
                ...dmDoc.data()
            };
        } catch (error) {
            console.error('Error getting DM:', error);
            return null;
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
            const dm = await this.getDM(dmId);
            if (!dm) new Error('DM not found');

            // Create message document
            const messageData = {
                content,
                sender: this.currentUser.uid,
                createdAt: serverTimestamp(),
                edited: false
            };

            const messageRef = doc(collection(db, COLLECTIONS.MESSAGES(this.currentUser.uid, dmId)));
            await setDoc(messageRef, messageData);

            // Update DM documents for all participants
            await Promise.all(dm.participants.map(async (participantId) => {
                const participantDMRef = doc(db, COLLECTIONS.DMS(participantId), dmId);
                await updateDoc(participantDMRef, {
                    lastMessage: content,
                    lastMessageAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
            }));

            return {id: messageRef.id, ...messageData};
        } catch (error) {
            console.error('Error sending message:', error);
            showMessageBox('Failed to send message', true);
            return null;
        }
    }

    async editMessage(dmId, messageId, newContent) {
        if (!this.currentUser || !dmId || !messageId || !newContent) return false;

        try {
            const messageRef = doc(db, COLLECTIONS.MESSAGES(this.currentUser.uid, dmId), messageId);
            const messageDoc = await getDoc(messageRef);

            if (!messageDoc.exists()) new Error('Message not found');
            if (messageDoc.data().sender !== this.currentUser.uid) {
                new Error('Cannot edit messages from other users');
            }

            await updateDoc(messageRef, {
                content: newContent,
                edited: true,
                editedAt: serverTimestamp()
            });

            return true;
        } catch (error) {
            console.error('Error editing message:', error);
            showMessageBox('Failed to edit message', true);
            return false;
        }
    }

    async deleteMessage(dmId, messageId) {
        if (!this.currentUser || !dmId || !messageId) return false;

        try {
            const messageRef = doc(db, COLLECTIONS.MESSAGES(this.currentUser.uid, dmId), messageId);
            const messageDoc = await getDoc(messageRef);

            if (!messageDoc.exists()) new Error('Message not found');
            if (messageDoc.data().sender !== this.currentUser.uid) {
                new Error('Cannot delete messages from other users');
            }

            await deleteDoc(messageRef);

            // Update last message in DM if this was the last message
            const dm = await this.getDM(dmId);
            if (dm && dm.lastMessage === messageDoc.data().content) {
                const messages = await this.getRecentMessages(dmId, 1);
                const lastMessage = messages[0] || null;

                await Promise.all(dm.participants.map(async (participantId) => {
                    const participantDMRef = doc(db, COLLECTIONS.DMS(participantId), dmId);
                    await updateDoc(participantDMRef, {
                        lastMessage: lastMessage?.content || null,
                        lastMessageAt: lastMessage?.createdAt || serverTimestamp()
                    });
                }));
            }

            return true;
        } catch (error) {
            console.error('Error deleting message:', error);
            showMessageBox('Failed to delete message', true);
            return false;
        }
    }

    async getRecentMessages(dmId, limit = 1) {
        if (!this.currentUser || !dmId) return [];

        try {
            const messagesRef = collection(db, COLLECTIONS.MESSAGES(this.currentUser.uid, dmId));
            const q = query(messagesRef, orderBy('createdAt', 'desc'), (limit));
            const snapshot = await getDocs(q);

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error getting recent messages:', error);
            return [];
        }
    }

    subscribeToMessages(dmId, callback) {
        if (!this.currentUser || !dmId || !callback) return null;

        try {
            const messagesRef = collection(db, COLLECTIONS.MESSAGES(this.currentUser.uid, dmId));
            const q = query(messagesRef, orderBy('createdAt', 'asc'));

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const messages = [];
                snapshot.forEach(doc => {
                    messages.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
                callback(messages);
            }, error => {
                console.error('Error in messages subscription:', error);
                callback([]);
            });

            this.messageListeners.set(dmId, unsubscribe);
            return unsubscribe;
        } catch (error) {
            console.error('Error subscribing to messages:', error);
            return null;
        }
    }

    cleanup() {
        this.messageListeners.forEach(unsubscribe => unsubscribe());
        this.messageListeners.clear();
        this.activeChats.clear();
    }
}

export const dmsManager = new DMsManager();