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

// Function to format large numbers
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

// Function to update monthly summary
function updateMonthlySummary(logs) {
    if (!logs || !logs.posts) return;

    const posts = logs.posts;
    const totalPosts = posts.length;
    const totalReach = posts.reduce((sum, post) => sum + (post.impressions || 0), 0);
    const totalEngagements = posts.reduce((sum, post) => 
        sum + (post.reactions || 0) + (post.comments || 0) + (post.shares || 0), 0);
    
    const engagementRate = totalPosts > 0 ? 
        ((totalEngagements / (totalReach || 1)) * 100).toFixed(2) : 0;

    // Update summary cards
    document.getElementById('postCount').textContent = totalPosts;
    document.getElementById('reachCount').textContent = formatNumber(totalReach);
    document.getElementById('engagementRate').textContent = `${engagementRate}%`;

    // Update stats grid
    impressionCount.textContent = formatNumber(totalReach);
    reactionCount.textContent = formatNumber(posts.reduce((sum, post) => sum + (post.reactions || 0), 0));
    commentCount.textContent = formatNumber(posts.reduce((sum, post) => sum + (post.comments || 0), 0));
}

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

// Function to render analytics table
function renderAnalyticsTable(logs) {
    if (!logs || !logs.posts || logs.posts.length === 0) {
        logTableBody.innerHTML = '';
        noDataMessage.classList.remove('hidden');
        return;
    }

    noDataMessage.classList.add('hidden');
    logTableBody.innerHTML = logs.posts
        .sort((a, b) => new Date(b.postDate) - new Date(a.postDate))
        .map(post => `
            <tr>
                <td class="date-cell">${formatDate(post.postDate)}</td>
                <td>${post.postContent || 'Post content unavailable'}</td>
                <td class="metric-cell">${formatNumber(post.impressions || 0)}</td>
                <td class="metric-cell">${formatNumber(post.reactions || 0)}</td>
                <td class="metric-cell">${formatNumber(post.comments || 0)}</td>
                <td class="metric-cell">${formatNumber(post.shares || 0)}</td>
            </tr>
        `)
        .join('');

    updateMonthlySummary(logs);
}

// Function to load and display logs
function loadLogs() {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({ type: 'GET_LOGS' }, response => {
            if (chrome.runtime.lastError) {
                console.error('Error fetching logs:', chrome.runtime.lastError);
                return;
            }
            allLogs = response.logs || [];
            currentProfileId = response.currentProfileId;
            updateProfileInfo(currentProfileId);
            renderAnalyticsTable(allLogs);
        });
    } else {
        // Demo data for preview
        const demoData = {
            companyId: 'demo-company',
            companyName: 'Demo Company',
            posts: [
                {
                    postId: 'post1',
                    postDate: new Date().toISOString(),
                    postContent: 'Exciting news! We just launched our new product.',
                    impressions: 15000,
                    reactions: 450,
                    comments: 48,
                    shares: 120,
                    url: 'https://linkedin.com/company/demo/posts/1'
                },
                {
                    postId: 'post2',
                    postDate: new Date(Date.now() - 86400000).toISOString(),
                    postContent: 'Join us at our upcoming webinar!',
                    impressions: 8500,
                    reactions: 230,
                    comments: 25,
                    shares: 45,
                    url: 'https://linkedin.com/company/demo/posts/2'
                },
                {
                    postId: 'post3',
                    postDate: new Date(Date.now() - 172800000).toISOString(),
                    postContent: 'Meet our amazing team members.',
                    impressions: 12000,
                    reactions: 380,
                    comments: 32,
                    shares: 78,
                    url: 'https://linkedin.com/company/demo/posts/3'
                }
            ]
        };
        
        allLogs = demoData;
        currentProfileId = demoData.companyId;
        updateProfileInfo(currentProfileId);
        renderAnalyticsTable(demoData);
    }
}

// Function to apply date filter
function applyDateFilter() {
    const startDate = new Date(startDateInput.value);
    const endDate = new Date(endDateInput.value);
    
    if (startDate > endDate) {
        alert('Start date cannot be after end date');
        return;
    }

    const filteredPosts = allLogs.posts?.filter(post => {
        const postDate = new Date(post.postDate);
        return postDate >= startDate && postDate <= new Date(endDate.getTime() + 86400000);
    });

    filteredLogs = {
        ...allLogs,
        posts: filteredPosts || []
    };

    renderAnalyticsTable(filteredLogs);
}

// Function to reset date filter
function resetDateFilter() {
    startDateInput.value = thirtyDaysAgo.toISOString().split('T')[0];
    endDateInput.value = today.toISOString().split('T')[0];
    applyDateFilter();
}

// Function to convert analytics to CSV
function convertToCSV(logs) {
    if (!logs || !logs.posts) return '';

    const headers = ['Date', 'Content', 'Impressions', 'Reactions', 'Comments', 'Shares', 'URL'];
    const rows = logs.posts.map(post => [
        post.postDate,
        post.postContent?.replace(/"/g, '""') || '',
        post.impressions || 0,
        post.reactions || 0,
        post.comments || 0,
        post.shares || 0,
        post.url || ''
    ]);

    return [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');
}

// Function to download CSV
function downloadCSV(logs, filename = 'linkedin_analytics.csv') {
    const csv = convertToCSV(logs);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Event Listeners
document.addEventListener('DOMContentLoaded', loadLogs);
applyDateRange.addEventListener('click', applyDateFilter);
resetDateRange.addEventListener('click', resetDateFilter);

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
        refreshBtn.style.transform = 'none';
        refreshBtn.style.transition = 'none';
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
    if (filteredLogs && filteredLogs.posts && filteredLogs.posts.length > 0) {
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            const dateRange = `${startDateInput.value}_to_${endDateInput.value}`;
            const filename = `linkedin_analytics_${dateRange}.csv`;
            downloadCSV(filteredLogs, filename);
        } else {
            alert('CSV download is only available in the extension.');
        }
    } else {
        alert('No data available for the selected date range.');
    }
});
