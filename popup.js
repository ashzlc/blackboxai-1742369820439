// DOM Elements
const logTableBody = document.getElementById('logTableBody');
const noDataMessage = document.getElementById('noDataMessage');
const downloadBtn = document.getElementById('downloadBtn');
const clearBtn = document.getElementById('clearBtn');
const refreshBtn = document.getElementById('refreshBtn');
const impressionCount = document.getElementById('impressionCount');
const reactionCount = document.getElementById('reactionCount');
const commentCount = document.getElementById('commentCount');
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const applyDateRange = document.getElementById('applyDateRange');
const resetDateRange = document.getElementById('resetDateRange');

// Store the full logs and profile info
let allLogs = [];
let filteredLogs = [];
let currentProfileId = null;

// Function to update profile info
function updateProfileInfo(profileId) {
    const profileDisplay = document.createElement('div');
    profileDisplay.className = 'profile-info';
    profileDisplay.innerHTML = `
        <span class="profile-label">Current Profile:</span>
        <span class="profile-value">${profileId || 'No profile selected'}</span>
    `;
    
    const existingInfo = document.querySelector('.profile-info');
    if (existingInfo) {
        existingInfo.replaceWith(profileDisplay);
    } else {
        document.querySelector('.header').appendChild(profileDisplay);
    }
}

// Initialize date inputs with default values
const today = new Date();
const thirtyDaysAgo = new Date(today);
thirtyDaysAgo.setDate(today.getDate() - 30);

startDateInput.value = thirtyDaysAgo.toISOString().split('T')[0];
endDateInput.value = today.toISOString().split('T')[0];

// Function to format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString();
}

// Function to filter logs by date range
function filterLogsByDate(logs, startDate, endDate) {
    return logs.filter(log => {
        const logDate = new Date(log.timestamp);
        return logDate >= startDate && logDate <= new Date(endDate.getTime() + 86400000); // Include end date fully
    });
}

// Function to update stats
function updateStats(logs) {
    const stats = logs.reduce((acc, log) => {
        acc[log.type.toLowerCase()] = (acc[log.type.toLowerCase()] || 0) + 1;
        return acc;
    }, {});

    impressionCount.textContent = stats.impression || 0;
    reactionCount.textContent = stats.reaction || 0;
    commentCount.textContent = stats.comment || 0;
}

// Function to get badge class based on type
function getBadgeClass(type) {
    const classes = {
        'IMPRESSION': 'badge-impression',
        'REACTION': 'badge-reaction',
        'COMMENT': 'badge-comment'
    };
    return classes[type] || '';
}

// Function to apply date filter
function applyDateFilter() {
    const startDate = new Date(startDateInput.value);
    const endDate = new Date(endDateInput.value);
    
    if (startDate > endDate) {
        alert('Start date cannot be after end date');
        return;
    }

    filteredLogs = filterLogsByDate(allLogs, startDate, endDate);
    renderLogs(filteredLogs);
}

// Function to reset date filter
function resetDateFilter() {
    startDateInput.value = thirtyDaysAgo.toISOString().split('T')[0];
    endDateInput.value = today.toISOString().split('T')[0];
    applyDateFilter();
}

// Function to render logs in the table
function renderLogs(logs) {
    if (!logs || logs.length === 0) {
        logTableBody.innerHTML = '';
        noDataMessage.classList.remove('hidden');
        return;
    }

    noDataMessage.classList.add('hidden');
    logTableBody.innerHTML = logs
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .map(log => {
            const badgeClass = getBadgeClass(log.type);
            return `
                <tr>
                    <td>
                        <span class="badge ${badgeClass}">
                            ${log.type}
                        </span>
                    </td>
                    <td>
                        ${formatDate(log.timestamp)}
                    </td>
                    <td>
                        ${formatLogDetails(log)}
                    </td>
                </tr>
            `;
        })
        .join('');

    updateStats(logs);
}

// Function to format log details based on type
function formatLogDetails(log) {
    const details = log.details || {};
    const postId = details.postId || 'unknown';
    
    switch (log.type) {
        case 'IMPRESSION':
            return `Post ${postId} viewed`;
        case 'REACTION':
            return `Reacted to post ${postId}${details.reactionType ? ` with ${details.reactionType}` : ''}`;
        case 'COMMENT':
            const commentText = details.commentText || '';
            const truncatedText = commentText.length > 50 ? 
                `${commentText.substring(0, 47)}...` : commentText;
            return `Commented on post ${postId}: "${truncatedText}"`;
        default:
            return `Action on post ${postId}`;
    }
}

// Function to convert logs to CSV
function convertToCSV(logs) {
    const headers = ['Type', 'Timestamp', 'Post ID', 'Details', 'URL'];
    const rows = logs.map(log => [
        log.type,
        log.timestamp,
        log.details?.postId || '',
        JSON.stringify(log.details || {}).replace(/"/g, '""'),
        log.details?.url || ''
    ]);

    return [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');
}

// Function to download CSV
function downloadCSV(logs) {
    const csv = convertToCSV(logs);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `linkedin-activity-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Function to load and display logs
function loadLogs() {
    // Check if running in extension context
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({ type: 'GET_LOGS' }, response => {
            if (chrome.runtime.lastError) {
                console.error('Error fetching logs:', chrome.runtime.lastError);
                return;
            }
            allLogs = response.logs || [];
            currentProfileId = response.currentProfileId;
            updateProfileInfo(currentProfileId);
            applyDateFilter();
        });
    } else {
        // Demo data for preview
        allLogs = [
            {
                type: 'IMPRESSION',
                timestamp: new Date().toISOString(),
                details: { postId: 'demo1', url: 'https://linkedin.com/post/1' }
            },
            {
                type: 'REACTION',
                timestamp: new Date(Date.now() - 86400000).toISOString(),
                details: { postId: 'demo2', url: 'https://linkedin.com/post/2', reactionType: 'LIKE' }
            },
            {
                type: 'COMMENT',
                timestamp: new Date(Date.now() - 172800000).toISOString(),
                details: { postId: 'demo3', url: 'https://linkedin.com/post/3', commentText: 'Great post!' }
            }
        ];
        currentProfileId = 'demo-profile';
        updateProfileInfo(currentProfileId);
        applyDateFilter();
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', loadLogs);
applyDateRange.addEventListener('click', applyDateFilter);
resetDateRange.addEventListener('click', resetDateFilter);

// Add styles for profile info
const style = document.createElement('style');
style.textContent = `
    .profile-info {
        background-color: #f3f4f6;
        padding: 8px 12px;
        border-radius: 6px;
        margin-top: 8px;
        font-size: 14px;
    }
    
    .profile-label {
        color: #6b7280;
        margin-right: 8px;
    }
    
    .profile-value {
        color: #1f2937;
        font-weight: 500;
    }
`;
document.head.appendChild(style);

// Add event listeners for date inputs
startDateInput.addEventListener('change', () => {
    if (startDateInput.value && endDateInput.value) {
        applyDateFilter();
    }
});

endDateInput.addEventListener('change', () => {
    if (startDateInput.value && endDateInput.value) {
        applyDateFilter();
    }
});

refreshBtn.addEventListener('click', () => {
    refreshBtn.style.transform = 'rotate(360deg)';
    refreshBtn.style.transition = 'transform 1s';
    loadLogs();
    setTimeout(() => {
        refreshBtn.style.transform = '';
        refreshBtn.style.transition = '';
    }, 1000);
});

clearBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all logs?')) {
        chrome.runtime.sendMessage({ type: 'CLEAR_LOGS' }, response => {
            if (response.success) {
                loadLogs();
            } else {
                console.error('Error clearing logs:', response.error);
            }
        });
    }
});

downloadBtn.addEventListener('click', () => {
    if (filteredLogs && filteredLogs.length > 0) {
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            downloadCSV(filteredLogs);
        } else {
            alert('CSV download is only available in the extension.');
        }
    }
});
