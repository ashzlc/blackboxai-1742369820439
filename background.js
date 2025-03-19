// Store for activity logs
let activityLogs = [];

// Helper function to add a new log entry
function addLogEntry(type, details) {
    const logEntry = {
        type: type,
        timestamp: new Date().toISOString(),
        details: details,
        url: details.url || ''
    };
    
    // Add to memory array
    activityLogs.push(logEntry);
    
    // Store in chrome.storage
    chrome.storage.local.set({ 'linkedinLogs': activityLogs }, function() {
        if (chrome.runtime.lastError) {
            console.error('Error saving logs:', chrome.runtime.lastError);
        }
    });
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message.type) {
        console.error('Invalid message format');
        return;
    }

    try {
        switch (message.type) {
            case 'IMPRESSION':
            case 'REACTION':
            case 'COMMENT':
                addLogEntry(message.type, message.data);
                sendResponse({ success: true });
                break;
            
            case 'GET_LOGS':
                chrome.storage.local.get(['linkedinLogs'], function(result) {
                    sendResponse({ logs: result.linkedinLogs || [] });
                });
                return true; // Will respond asynchronously
            
            case 'CLEAR_LOGS':
                activityLogs = [];
                chrome.storage.local.remove(['linkedinLogs'], function() {
                    if (chrome.runtime.lastError) {
                        sendResponse({ success: false, error: chrome.runtime.lastError });
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

// Initialize logs from storage when extension loads
chrome.storage.local.get(['linkedinLogs'], function(result) {
    if (result.linkedinLogs) {
        activityLogs = result.linkedinLogs;
    }
});