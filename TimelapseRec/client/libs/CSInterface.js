/**
 * CSInterface.js — Adobe CEP Interface Library
 * Minimal compatible implementation for CEP 9–11
 * Provides communication between panel JS and ExtendScript host
 */

/**
 * @class CSInterface
 * Main interface class for Adobe CEP extensions
 */
function CSInterface() {
    // Version info
    this.CYCLOPEDIA_DATA_KEY = "cyclopediaDataKey";
}

/**
 * Retrieve host environment information
 * @returns {Object} Host environment data
 */
CSInterface.prototype.getHostEnvironment = function () {
    var env;
    try {
        env = JSON.parse(window.__adobe_cep__.getHostEnvironment());
    } catch (e) {
        env = {};
    }
    return env;
};

/**
 * Get the system path of a given type
 * @param {string} pathType - One of: SystemPath.APPLICATION, etc.
 * @returns {string} The system path
 */
CSInterface.prototype.getSystemPath = function (pathType) {
    var path = "";
    try {
        path = window.__adobe_cep__.getSystemPath(pathType);
    } catch (e) { }
    return path;
};

/**
 * Evaluate an ExtendScript expression in the host application
 * @param {string} script - ExtendScript code to evaluate
 * @param {function} callback - Callback function with result
 */
CSInterface.prototype.evalScript = function (script, callback) {
    try {
        if (callback === null || callback === undefined) {
            callback = function () { };
        }
        window.__adobe_cep__.evalScript(script, callback);
    } catch (e) {
        if (callback) callback("EvalScript error: " + e.message);
    }
};

/**
 * Register a callback for a CEP event
 * @param {string} type - Event type
 * @param {function} listener - Event listener function
 * @param {object} obj - Optional context for the listener
 */
CSInterface.prototype.addEventListener = function (type, listener, obj) {
    try {
        window.__adobe_cep__.addEventListener(type, listener, obj);
    } catch (e) { }
};

/**
 * Remove a CEP event listener
 * @param {string} type - Event type
 * @param {function} listener - Event listener to remove
 * @param {object} obj - Optional context
 */
CSInterface.prototype.removeEventListener = function (type, listener, obj) {
    try {
        window.__adobe_cep__.removeEventListener(type, listener, obj);
    } catch (e) { }
};

/**
 * Dispatch a CEP event
 * @param {CSEvent} event - Event to dispatch
 */
CSInterface.prototype.dispatchEvent = function (event) {
    try {
        if (typeof event.data === "object") {
            event.data = JSON.stringify(event.data);
        }
        window.__adobe_cep__.dispatchEvent(event);
    } catch (e) { }
};

/**
 * Close this extension
 */
CSInterface.prototype.closeExtension = function () {
    try {
        window.__adobe_cep__.closeExtension();
    } catch (e) { }
};

/**
 * Resizes the extension window to the specified dimensions.
 * @param width The new width
 * @param height The new height
 */
CSInterface.prototype.resizeContent = function (width, height) {
    try {
        window.__adobe_cep__.resizeContent(width, height);
    } catch (e) { }
};

/**
 * Request opening a URL in the default browser
 * @param {string} url - URL to open
 */
CSInterface.prototype.openURLInDefaultBrowser = function (url) {
    try {
        if (typeof cep !== "undefined" && cep.util) {
            cep.util.openURLInDefaultBrowser(url);
        } else {
            window.__adobe_cep__.openURLInDefaultBrowser(url);
        }
    } catch (e) { }
};

/**
 * Get the extension ID
 * @returns {string} Extension ID
 */
CSInterface.prototype.getExtensionID = function () {
    try {
        return window.__adobe_cep__.getExtensionId();
    } catch (e) {
        return "";
    }
};

/**
 * Get the scale factor of the screen
 * @returns {number} Scale factor
 */
CSInterface.prototype.getScaleFactor = function () {
    try {
        return window.__adobe_cep__.getScaleFactor();
    } catch (e) {
        return 1;
    }
};

/**
 * Set the scale factor change handler
 * @param {function} handler - Handler function
 */
CSInterface.prototype.setScaleFactorChangedHandler = function (handler) {
    try {
        window.__adobe_cep__.setScaleFactorChangedHandler(handler);
    } catch (e) { }
};

/**
 * Get current API version
 * @returns {Object} API version
 */
CSInterface.prototype.getCurrentApiVersion = function () {
    try {
        var version = JSON.parse(window.__adobe_cep__.getCurrentApiVersion());
        return version;
    } catch (e) {
        return { major: 0, minor: 0, micro: 0 };
    }
};

/**
 * Set the panel flyout menu
 * @param {string} menu - XML string for the menu
 */
CSInterface.prototype.setPanelFlyoutMenu = function (menu) {
    try {
        window.__adobe_cep__.invokeSync("setPanelFlyoutMenu", menu);
    } catch (e) { }
};

/**
 * Set the context menu
 * @param {string} menu - XML string for the menu
 * @param {function} callback - Callback for menu events
 */
CSInterface.prototype.setContextMenu = function (menu, callback) {
    try {
        window.__adobe_cep__.invokeAsync("setContextMenu", menu, callback);
    } catch (e) { }
};

/**
 * Register invalid certificate callback
 * @param {function} callback - Callback function
 */
CSInterface.prototype.registerInvalidCertificateCallback = function (callback) {
    try {
        window.__adobe_cep__.registerInvalidCertificateCallback(callback);
    } catch (e) { }
};

/**
 * Register key events interest
 * @param {Object} keyEventsInterest - Key events to register for
 */
CSInterface.prototype.registerKeyEventsInterest = function (keyEventsInterest) {
    try {
        window.__adobe_cep__.registerKeyEventsInterest(JSON.stringify(keyEventsInterest));
    } catch (e) { }
};

// ============ CSEvent Class ============

/**
 * @class CSEvent
 * @param {string} type - Event type
 * @param {string} scope - Event scope
 * @param {string} appId - Application ID
 * @param {string} extensionId - Extension ID
 */
function CSEvent(type, scope, appId, extensionId) {
    this.type = type;
    this.scope = scope;
    this.appId = appId;
    this.extensionId = extensionId;
    this.data = "";
}

// ============ SystemPath Constants ============

var SystemPath = {
    USER_DATA: "userData",
    COMMON_FILES: "commonFiles",
    MY_DOCUMENTS: "myDocuments",
    APPLICATION: "application",
    EXTENSION: "extension",
    HOST_APPLICATION: "hostApplication"
};

// ============ Color Type Constants ============

var ColorType = {
    RGB: "rgb",
    GRADIENT: "gradient",
    NONE: "none"
};
