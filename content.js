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

// Function to send events to background script
function sendEvent(type, data) {
    try {
        chrome.runtime.sendMessage({
            type: type,
            data: {
                ...data,
                url: window.location.href,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('LinkedIn Activity Logger: Error sending event:', error);
    }
}

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