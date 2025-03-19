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

// Function to extract profile ID and info from LinkedIn company page
function extractProfileId() {
    // Check if we're on a company page
    const urlMatch = window.location.href.match(/linkedin\.com\/company\/([^/]+)/);
    if (!urlMatch) {
        console.log('LinkedIn Activity Logger: Not on a company page');
        return null;
    }

    // Get company name from page
    const companyName = document.querySelector('h1.org-top-card-summary__title')?.textContent.trim() || 
                       document.querySelector('.org-top-card-summary__title')?.textContent.trim() ||
                       'Unknown Company';
    
    // Get company ID from URL
    const companyId = urlMatch[1];
    
    console.log(`LinkedIn Activity Logger: Detected company "${companyName}" (${companyId})`);
    return companyId;
}

// Function to check if we're on a company posts/content page
function isCompanyContentPage() {
    return window.location.href.includes('/posts/') || 
           window.location.href.includes('/content/') ||
           window.location.href.includes('/updates/') ||
           document.querySelector('.org-updates-content') !== null;
}

// Function to send events to background script
function sendEvent(type, data) {
    try {
        const profileId = extractProfileId();
        if (!profileId) {
            console.log('LinkedIn Activity Logger: Please navigate to a LinkedIn company page to start tracking');
            return;
        }

        if (!isCompanyContentPage()) {
            console.log('LinkedIn Activity Logger: Navigate to the company\'s posts/content section to track engagement');
            return;
        }

        chrome.runtime.sendMessage({
            type: type,
            data: {
                ...data,
                url: window.location.href,
                timestamp: new Date().toISOString(),
                profileId: profileId
            }
        });

        // Notify background script about profile
        chrome.runtime.sendMessage({
            type: 'SET_PROFILE',
            profileId: profileId
        });

        console.log(`LinkedIn Activity Logger: Tracked ${type.toLowerCase()} for company ${profileId}`);
    } catch (error) {
        console.error('LinkedIn Activity Logger: Error sending event:', error);
    }
}

// Show initial guidance
console.log('LinkedIn Activity Logger: To start tracking:');
console.log('1. Navigate to a LinkedIn company page (e.g., linkedin.com/company/microsoft)');
console.log('2. Go to the Posts or Content tab');
console.log('3. Scroll through posts to track impressions');
console.log('4. Interact with posts to track engagement');

// Set up post impression tracking using Intersection Observer
function setupPostImpressionTracking() {
    const observedPosts = new Set();
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const postElement = entry.target;
                const postId = extractPostId(postElement);
                
                // Only track each post once
                if (!observedPosts.has(postId)) {
                    observedPosts.add(postId);
                    sendEvent('IMPRESSION', { postId });
                    
                    // Stop observing this post
                    observer.unobserve(postElement);
                }
            }
        });
    }, {
        threshold: 0.5, // Post must be 50% visible
        rootMargin: '0px' // No margin
    });

    // Function to find and observe posts
    const findAndObservePosts = debounce(() => {
        // LinkedIn post selectors
        const postSelectors = [
            'div.feed-shared-update-v2',
            'div[data-urn]',
            'div[data-id]',
            'div.feed-shared-article',
            'div.feed-shared-external-video',
            'div.feed-shared-image',
            'div.feed-shared-linkedin-video',
            'div.feed-shared-post',
            'div.feed-shared-text'
        ];

        const posts = document.querySelectorAll(postSelectors.join(','));
        posts.forEach(post => {
            const postId = extractPostId(post);
            if (!observedPosts.has(postId)) {
                observer.observe(post);
            }
        });
    }, 1000);

    // Initial observation
    findAndObservePosts();

    // Set up MutationObserver to watch for new posts
    const mutationObserver = new MutationObserver(findAndObservePosts);
    mutationObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// Track reactions
function setupReactionTracking() {
    document.addEventListener('click', (e) => {
        // LinkedIn reaction selectors
        const reactionSelectors = [
            'button.react-button__trigger',
            'button.reactions-react-button',
            'button[data-control-name="react_button"]',
            'li.reactions-menu-item'
        ];

        const reactionButton = e.target.closest(reactionSelectors.join(','));
        if (reactionButton) {
            const postElement = reactionButton.closest([
                'div.feed-shared-update-v2',
                'div[data-urn]',
                'div[data-id]'
            ].join(','));

            if (postElement) {
                const postId = extractPostId(postElement);
                const reactionType = reactionButton.getAttribute('aria-label') || 
                                   reactionButton.textContent.trim() ||
                                   'unknown_reaction';
                
                sendEvent('REACTION', {
                    postId,
                    reactionType
                });
            }
        }
    });
}

// Track comments
function setupCommentTracking() {
    // Track comment submissions
    document.addEventListener('click', (e) => {
        // LinkedIn comment submit button selectors
        const commentSubmitSelectors = [
            'button.comments-comment-box__submit-button',
            'button[data-control-name="comment_submit"]'
        ];

        const submitButton = e.target.closest(commentSubmitSelectors.join(','));
        if (submitButton) {
            const commentBox = submitButton.closest('.comments-comment-box');
            if (commentBox) {
                const postElement = commentBox.closest([
                    'div.feed-shared-update-v2',
                    'div[data-urn]',
                    'div[data-id]'
                ].join(','));

                if (postElement) {
                    const postId = extractPostId(postElement);
                    const commentText = commentBox.querySelector('textarea, [contenteditable="true"]')?.value || 
                                     commentBox.querySelector('textarea, [contenteditable="true"]')?.textContent || 
                                     '';

                    sendEvent('COMMENT', {
                        postId,
                        commentText: commentText.trim()
                    });
                }
            }
        }
    });
}

// Initialize all tracking functions
function initializeTracking() {
    try {
        // Wait for the page to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setupPostImpressionTracking();
                setupReactionTracking();
                setupCommentTracking();
            });
        } else {
            setupPostImpressionTracking();
            setupReactionTracking();
            setupCommentTracking();
        }
        
        console.log('LinkedIn Activity Logger: Tracking initialized successfully');
    } catch (error) {
        console.error('LinkedIn Activity Logger: Error initializing tracking:', error);
    }
}

// Start the tracking
initializeTracking();