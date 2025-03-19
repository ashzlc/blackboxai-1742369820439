// Initialize activity logs storage
let activityLogs = new Map(); // Map of profileId -> logs array
let currentProfileId = null;

// Maximum number of logs to store per profile (prevent excessive memory usage)
const MAX_LOGS = 1000;

// Function to set current profile
function setCurrentProfile(profileId) {
    currentProfileId = profileId;
    if (!activityLogs.has(profileId)) {
        activityLogs.set(profileId, []);
    }
}

// Function to get current profile logs
function getCurrentProfileLogs() {
    return currentProfileId ? activityLogs.get(currentProfileId) : [];
}

// Load existing logs from storage
chrome.storage.local.get(['linkedinLogs', 'currentProfileId'], function(result) {
    if (result.linkedinLogs) {
        try {
            // Convert stored object back to Map
            activityLogs = new Map(Object.entries(result.linkedinLogs));
            console.log('LinkedIn Activity Logger: Loaded logs for', activityLogs.size, 'profiles');
        } catch (error) {
            console.error('Error loading logs:', error);
            activityLogs = new Map();
        }
    }
    
    if (result.currentProfileId) {
        setCurrentProfile(result.currentProfileId);
    }
});

// Helper function to trim logs if they exceed maximum
function trimLogs(profileId) {
    const logs = activityLogs.get(profileId);
    if (logs && logs.length > MAX_LOGS) {
        activityLogs.set(profileId, logs.slice(-MAX_LOGS));
    }
}

// Helper function to save logs to storage
function saveLogs() {
    return new Promise((resolve, reject) => {
        if (currentProfileId) {
            trimLogs(currentProfileId);
        }
        
        // Convert Map to object for storage
        const logsObject = Object.fromEntries(activityLogs);
        
        chrome.storage.local.set({
            'linkedinLogs': logsObject,
            'currentProfileId': currentProfileId
        }, function() {
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
        if (!currentProfileId) {
            // Extract profile ID from URL or details
            const profileId = details.profileId || 'default';
            setCurrentProfile(profileId);
        }

        // Create log entry
        const logEntry = {
            type: type,
            timestamp: new Date().toISOString(),
            details: details
        };
        
        // Add to memory array for current profile
        const currentLogs = getCurrentProfileLogs();
        currentLogs.push(logEntry);
        activityLogs.set(currentProfileId, currentLogs);
        
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
           ['ANALYTICS_DATA', 'GET_LOGS', 'CLEAR_LOGS', 'SET_PROFILE'].includes(message.type);
}

// Helper function to merge analytics data
function mergeAnalyticsData(existingData, newData) {
    if (!existingData || !existingData.posts) {
        return newData;
    }

    // Create a map of existing posts by URL
    const postMap = new Map(existingData.posts.map(post => [post.url, post]));

    // Update or add new posts
    newData.posts.forEach(post => {
        if (postMap.has(post.url)) {
            // Update existing post with new metrics
            const existingPost = postMap.get(post.url);
            postMap.set(post.url, {
                ...existingPost,
                impressions: Math.max(existingPost.impressions || 0, post.impressions || 0),
                reactions: Math.max(existingPost.reactions || 0, post.reactions || 0),
                comments: Math.max(existingPost.comments || 0, post.comments || 0),
                shares: Math.max(existingPost.shares || 0, post.shares || 0)
            });
        } else {
            // Add new post
            postMap.set(post.url, post);
        }
    });

    // Convert map back to array
    return {
        ...newData,
        posts: Array.from(postMap.values())
    };
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
            case 'ANALYTICS_DATA':
                // Handle analytics data
                if (!currentProfileId) {
                    setCurrentProfile(message.data.companyId);
                }
                
                const currentData = getCurrentProfileLogs();
                const updatedData = mergeAnalyticsData(currentData, message.data);
                activityLogs.set(currentProfileId, updatedData);
                
                saveLogs()
                    .then(() => {
                        console.log(`Updated analytics for ${message.data.companyName}`);
                        sendResponse({ success: true });
                    })
                    .catch(error => sendResponse({ success: false, error: error.message }));
                return true;

            case 'SET_PROFILE':
                // Set current profile
                setCurrentProfile(message.profileId);
                saveLogs()
                    .then(() => sendResponse({ success: true }))
                    .catch(error => sendResponse({ success: false, error: error.message }));
                return true;

            case 'GET_LOGS':
                // Return current profile logs
                sendResponse({ 
                    logs: getCurrentProfileLogs(),
                    currentProfileId: currentProfileId
                });
                break;

            case 'CLEAR_LOGS':
                try {
                    if (currentProfileId) {
                        // Clear logs for current profile only
                        activityLogs.set(currentProfileId, []);
                        saveLogs()
                            .then(() => sendResponse({ success: true }))
                            .catch(error => sendResponse({ success: false, error: error.message }));
                    } else {
                        // Clear all logs if no profile is selected
                        activityLogs = new Map();
                        chrome.storage.local.remove(['linkedinLogs', 'currentProfileId'], function() {
                            if (chrome.runtime.lastError) {
                                sendResponse({ 
                                    success: false, 
                                    error: chrome.runtime.lastError.message 
                                });
                            } else {
                                sendResponse({ success: true });
                            }
                        });
                    }
                    return true; // Will respond asynchronously
                } catch (error) {
                    console.error('Error clearing logs:', error);
                    sendResponse({ success: false, error: error.message });
                }
                break;
        }
    } catch (error) {
        console.error('Error processing message:', error);
        sendResponse({ success: false, error: error.message });
    }
});

// Log when the extension starts
console.log('LinkedIn Activity Logger: Background service worker started');