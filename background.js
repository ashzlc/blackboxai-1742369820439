// Initialize activity logs array
let activityLogs = [];

// Maximum number of logs to store (prevent excessive memory usage)
const MAX_LOGS = 1000;

// Load existing logs from storage
chrome.storage.local.get(['linkedinLogs'], function(result) {
    if (result.linkedinLogs) {
        activityLogs = result.linkedinLogs;
        console.log('LinkedIn Activity Logger: Loaded', activityLogs.length, 'existing logs');
    }
});

// Helper function to trim logs if they exceed maximum
function trimLogs() {
    if (activityLogs.length > MAX_LOGS) {
        activityLogs = activityLogs.slice(-MAX_LOGS);
    }
}

// Helper function to save logs to storage
function saveLogs() {
    return new Promise((resolve, reject) => {
        trimLogs();
        chrome.storage.local.set({ 'linkedinLogs': activityLogs }, function() {
            if (chrome.runtime.lastError) {
                console.error('Error saving logs:', chrome.runtime.lastError);
                reject(chrome.runtime.lastError);
            } else {
                resolve();
            }
        });
    });
}

// Helper function to add a new log entry
async function addLogEntry(type, details) {
    try {
        // Create log entry
        const logEntry = {
            type: type,
            timestamp: new Date().toISOString(),
            details: details
        };
        
        // Add to memory array
        activityLogs.push(logEntry);
        
        // Save to storage
        await saveLogs();
        
        return true;
    } catch (error) {
        console.error('Error adding log entry:', error);
        return false;
    }
}

// Helper function to validate message format
function isValidMessage(message) {
    return message && 
           typeof message === 'object' && 
           typeof message.type === 'string' &&
           ['IMPRESSION', 'REACTION', 'COMMENT', 'GET_LOGS', 'CLEAR_LOGS'].includes(message.type);
}

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isValidMessage(message)) {
        console.error('Invalid message format:', message);
        sendResponse({ success: false, error: 'Invalid message format' });
        return;
    }

    try {
        switch (message.type) {
            case 'IMPRESSION':
            case 'REACTION':
            case 'COMMENT':
                // Handle activity logging
                addLogEntry(message.type, message.data)
                    .then(() => sendResponse({ success: true }))
                    .catch(error => sendResponse({ success: false, error: error.message }));
                return true; // Will respond asynchronously

            case 'GET_LOGS':
                // Return all logs
                sendResponse({ logs: activityLogs });
                break;

            case 'CLEAR_LOGS':
                // Clear all logs
                activityLogs = [];
                chrome.storage.local.remove(['linkedinLogs'], function() {
                    if (chrome.runtime.lastError) {
                        sendResponse({ 
                            success: false, 
                            error: chrome.runtime.lastError.message 
                        });
                    } else {
                        sendResponse({ success: true });
                    }
                });
                return true; // Will respond asynchronously
        }
    } catch (error) {
        console.error('Error processing message:', error);
        sendResponse({ success: false, error: error.message });
    }
});

// Listen for installation or update
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('LinkedIn Activity Logger: Extension installed');
    } else if (details.reason === 'update') {
        console.log('LinkedIn Activity Logger: Extension updated');
    }
});

// Log when the extension starts
console.log('LinkedIn Activity Logger: Background service worker started');