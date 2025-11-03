// runtime-globals.js
// Safe getters/setters for optional runtime-injected globals used across the app.
// These variables may be injected by the hosting environment before scripts run.

// Resolve a global container (globalThis preferred, fall back to window)
const _global = typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : {});

function hasOwn(name) {
    return Object.prototype.hasOwnProperty.call(_global, name);
}

export function getAppId() {
    return hasOwn("__app_id") ? _global.__app_id : undefined;
}

export function setAppId(id) {
    if (typeof id !== "undefined") _global.__app_id = id;
    else delete _global.__app_id;
}

export function getFirebaseConfig() {
    return hasOwn("__firebase_config") ? _global.__firebase_config : undefined;
}

export function setFirebaseConfig(cfg) {
    // cfg may be an object or JSON string
    if (typeof cfg === "string") {
        try {
            _global.__firebase_config = JSON.parse(cfg);
        } catch (e) {
            // store raw string if parse fails
            _global.__firebase_config = cfg;
        }
    } else {
        _global.__firebase_config = cfg;
    }
}

export function setFirebaseConfigFromString(jsonStr) {
    try {
        _global.__firebase_config = JSON.parse(jsonStr);
    } catch (e) {
        console.error("runtime-globals: invalid JSON in setFirebaseConfigFromString", e);
        _global.__firebase_config = jsonStr;
    }
}

export function getInitialAuthToken() {
    return hasOwn("__initial_auth_token") ? _global.__initial_auth_token : undefined;
}

export function setInitialAuthToken(token) {
    if (typeof token !== "undefined") _global.__initial_auth_token = token;
    else delete _global.__initial_auth_token;
}

// Also expose a convenience function to set multiple values at once
export function setRuntimeGlobals({appId, firebaseConfig, initialAuthToken} = {}) {
    if (typeof appId !== "undefined") setAppId(appId);
    if (typeof firebaseConfig !== "undefined") setFirebaseConfig(firebaseConfig);
    if (typeof initialAuthToken !== "undefined") setInitialAuthToken(initialAuthToken);
}

// For debugging convenience, expose current values
export function debugRuntimeGlobals() {
    return {
        __app_id: getAppId(),
        __firebase_config: getFirebaseConfig(),
        __initial_auth_token: getInitialAuthToken(),
    };
}