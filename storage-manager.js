
class StorageManager {
    constructor() {
        this.prefix = 'arcator_';
        this.storage = window.localStorage;
    }

    getKey(key) {
        return `${this.prefix}${key}`;
    }

    set(key, value) {
        try {
            const serialized = JSON.stringify(value);
            this.storage.setItem(this.getKey(key), serialized);
            return true;
        } catch (error) {
            console.error('Error saving to storage:', error);
            return false;
        }
    }

    get(key) {
        try {
            const serialized = this.storage.getItem(this.getKey(key));
            return serialized ? JSON.parse(serialized) : null;
        } catch (error) {
            console.error('Error reading from storage:', error);
            return null;
        }
    }

    remove(key) {
        try {
            this.storage.removeItem(this.getKey(key));
            return true;
        } catch (error) {
            console.error('Error removing from storage:', error);
            return false;
        }
    }

    clear() {
        try {

            Object.keys(this.storage).forEach(key => {
                if (key.startsWith(this.prefix)) {
                    this.storage.removeItem(key);
                }
            });
            return true;
        } catch (error) {
            console.error('Error clearing storage:', error);
            return false;
        }
    }

    getAllKeys() {
        try {
            return Object.keys(this.storage)
                .filter(key => key.startsWith(this.prefix))
                .map(key => key.slice(this.prefix.length));
        } catch (error) {
            console.error('Error getting storage keys:', error);
            return [];
        }
    }

    getAll() {
        try {
            const result = {};
            this.getAllKeys().forEach(key => {
                result[key] = this.get(key);
            });
            return result;
        } catch (error) {
            console.error('Error getting all storage items:', error);
            return {};
        }
    }

    hasKey(key) {
        return this.storage.hasOwnProperty(this.getKey(key));
    }

    merge(key, value) {
        try {
            const existing = this.get(key) || {};
            const merged = {...existing, ...value};
            return this.set(key, merged);
        } catch (error) {
            console.error('Error merging storage:', error);
            return false;
        }
    }

    size() {
        return this.getAllKeys().length;
    }

    remainingSpace() {
        try {
            let totalSize = 0;
            Object.keys(this.storage).forEach(key => {
                totalSize += (key.length + this.storage[key].length) * 2;
            });
            return 5242880 - totalSize; // 5MB limit for localStorage
        } catch (error) {
            console.error('Error calculating remaining space:', error);
            return 0;
        }
    }

    isAvailable() {
        try {
            const testKey = '__test__';
            this.storage.setItem(testKey, testKey);
            this.storage.removeItem(testKey);
            return true;
        } catch {
            return false;
        }
    }
}

export const storageManager = new StorageManager();