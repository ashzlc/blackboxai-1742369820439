// Utility function to debounce function calls
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Function to extract post ID from various LinkedIn post elements
function extractPostId(element) {
    // Try different attributes where LinkedIn might store the post ID
    const possibleAttributes = ['data-id', 'data-urn', 'data-activity-urn'];
    for (const attr of possibleAttributes) {
        const value = element.getAttribute(attr);
        if (value) return value;
    }
    
    // If no direct ID found, try to find it in nested elements
    const nestedElement = element.querySelector('[data-id], [data-urn], [data-activity-urn]');
    if (nestedElement) {
        for (const attr of possibleAttributes) {
            const value = nestedElement.getAttribute(attr);
            if (value) return value;
        }
    }
    
    return 'unknown_post_id';
}

// Function to extract analytics data from LinkedIn company admin page
function extractAnalyticsData() {
    // Check if we're on the company admin analytics page
    const isAnalyticsPage = window.location.href.includes('/admin/analytics/') ||
                           window.location.href.includes('/organization/');
    
    if (!isAnalyticsPage) {
        console.log('LinkedIn Activity Logger: Please navigate to your company page analytics section');
        return null;
    }

    // Get post analytics data
    const posts = document.querySelectorAll('.analytics-post-item, .content-analytics-item');
    const analyticsData = [];

    posts.forEach(post => {
        try {
            // Extract post data
            const postData = {
                postId: post.getAttribute('data-post-id') || post.getAttribute('data-urn') || 'unknown',
                postDate: post.querySelector('.post-timestamp, .content-date')?.textContent.trim(),
                postContent: post.querySelector('.post-content, .content-title')?.textContent.trim(),
                impressions: extractMetric(post, ['impressions', 'views', 'reach']),
                reactions: extractMetric(post, ['reactions', 'likes']),
                comments: extractMetric(post, ['comments']),
                shares: extractMetric(post, ['shares', 'reposts']),
                url: post.querySelector('a[href*="/posts/"]')?.href || window.location.href
            };

            analyticsData.push(postData);
        } catch (error) {
            console.error('Error extracting post data:', error);
        }
    });

    return analyticsData;
}

// Helper function to extract numeric metrics
function extractMetric(element, possibleLabels) {
    for (const label of possibleLabels) {
        const metric = element.querySelector(`[aria-label*="${label}"], [title*="${label}"], .analytics-${label}`)
            ?.textContent.trim().replace(/[^0-9]/g, '');
        if (metric) return parseInt(metric, 10);
    }
    return 0;
}

// Function to extract company info
function extractCompanyInfo() {
    const companyName = document.querySelector('.org-top-card-summary__title, .organization-name')?.textContent.trim() || 'Unknown Company';
    const urlMatch = window.location.href.match(/linkedin\.com\/company\/([^/]+)/);
    const companyId = urlMatch ? urlMatch[1] : 'unknown';
    
    return { companyId, companyName };
}

// Function to collect and send analytics data
function collectAnalytics() {
    try {
        const analyticsData = extractAnalyticsData();
        if (!analyticsData) return;

        const { companyId, companyName } = extractCompanyInfo();
        
        // Send data to background script
        chrome.runtime.sendMessage({
            type: 'ANALYTICS_DATA',
            data: {
                companyId,
                companyName,
                timestamp: new Date().toISOString(),
                posts: analyticsData
            }
        });

        // Set current profile
        chrome.runtime.sendMessage({
            type: 'SET_PROFILE',
            profileId: companyId
        });

        console.log(`LinkedIn Activity Logger: Collected analytics for "${companyName}"`);
        console.log(`Total posts analyzed: ${analyticsData.length}`);
    } catch (error) {
        console.error('LinkedIn Activity Logger: Error collecting analytics:', error);
    }
}

// Show initial guidance
console.log('LinkedIn Activity Logger: To collect company analytics:');
console.log('1. Log in to LinkedIn with admin access');
console.log('2. Go to your company page');
console.log('3. Navigate to Analytics or Content section');
console.log('4. Data will be collected automatically');

// Set up analytics collection
function initializeAnalyticsTracking() {
    // Collect analytics when page loads
    collectAnalytics();

    // Set up periodic collection
    setInterval(collectAnalytics, 30000); // Check every 30 seconds

    // Set up MutationObserver to detect content changes
    const observer = new MutationObserver(debounce(collectAnalytics, 1000));
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// Initialize tracking
function initializeTracking() {
    try {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeAnalyticsTracking);
        } else {
            initializeAnalyticsTracking();
        }
        console.log('LinkedIn Activity Logger: Analytics tracking initialized');
    } catch (error) {
        console.error('LinkedIn Activity Logger: Error initializing tracking:', error);
    }
}

// Start the tracking
initializeTracking();