// DOM Elements
const logTableBody = document.getElementById('logTableBody');
const noDataMessage = document.getElementById('noDataMessage');
const downloadBtn = document.getElementById('downloadBtn');
const clearBtn = document.getElementById('clearBtn');
const refreshBtn = document.getElementById('refreshBtn');
const impressionCount = document.getElementById('impressionCount');
const reactionCount = document.getElementById('reactionCount');
const commentCount = document.getElementById('commentCount');

// Utility function to format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString();
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

// Function to get type-specific styling
function getTypeStyle(type) {
    const styles = {
        'IMPRESSION': 'bg-blue-100 text-blue-800',
        'REACTION': 'bg-green-100 text-green-800',
        'COMMENT': 'bg-purple-100 text-purple-800'
    };
    return styles[type] || 'bg-gray-100 text-gray-800';
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
            const typeClass = getTypeStyle(log.type);
            return `
                <tr>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-2 py-1 text-xs font-medium rounded-full ${typeClass}">
                            ${log.type}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${formatDate(log.timestamp)}
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500">
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
    switch (log.type) {
        case 'IMPRESSION':
            return `Post ${details.postId} viewed`;
        case 'REACTION':
            return `Reacted to post ${details.postId} with ${details.reactionType}`;
        case 'COMMENT':
            return `Commented on post ${details.postId}: "${details.commentText.substring(0, 50)}${details.commentText.length > 50 ? '...' : ''}"`;
        default:
            return JSON.stringify(details);
    }
}

// Function to convert logs to CSV
function convertToCSV(logs) {
    const headers = ['Type', 'Timestamp', 'Post ID', 'Details', 'URL'];
    const rows = logs.map(log => [
        log.type,
        log.timestamp,
        log.details.postId || '',
        JSON.stringify(log.details).replace(/"/g, '""'),
        log.details.url || ''
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
    chrome.runtime.sendMessage({ type: 'GET_LOGS' }, response => {
        if (chrome.runtime.lastError) {
            console.error('Error fetching logs:', chrome.runtime.lastError);
            return;
        }
        renderLogs(response.logs || []);
    });
}

// Event Listeners
document.addEventListener('DOMContentLoaded', loadLogs);

refreshBtn.addEventListener('click', () => {
    refreshBtn.classList.add('animate-spin');
    loadLogs();
    setTimeout(() => refreshBtn.classList.remove('animate-spin'), 1000);
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
    chrome.runtime.sendMessage({ type: 'GET_LOGS' }, response => {
        if (response.logs && response.logs.length > 0) {
            downloadCSV(response.logs);
        }
    });
});