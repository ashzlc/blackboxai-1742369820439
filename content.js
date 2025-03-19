// Utility function to debounce function calls
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Function to send events to background script
function sendEvent(type, data) {
    chrome.runtime.sendMessage({
        type: type,
        data: {
            ...data,
            url: window.location.href,
            timestamp: new Date().toISOString()
        }
    });
}

// Set up post impression tracking using Intersection Observer
function setupPostImpressionTracking() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const postElement = entry.target;
                const postId = postElement.getAttribute('data-id') || 
                              postElement.getAttribute('data-urn') || 
                              'unknown_post_id';
                
                sendEvent('IMPRESSION', {
                    postId: postId,
                    viewedAt: new Date().toISOString()
                });
                
                // Unobserve after first impression
                observer.unobserve(postElement);
            }
        });
    }, {
        threshold: 0.5 // Post must be 50% visible
    });

    // Observe all posts
    const observePosts = () => {
        const posts = document.querySelectorAll('div[data-id], div[data-urn]');
        posts.forEach(post => observer.observe(post));
    };

    // Initial observation
    observePosts();

    // Set up MutationObserver to watch for new posts
    const mutationObserver = new MutationObserver(debounce(() => {
        observePosts();
    }, 1000));

    mutationObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// Track reactions
function setupReactionTracking() {
    document.addEventListener('click', (e) => {
        const reactionButton = e.target.closest('.reaction-button');
        if (reactionButton) {
            const postElement = reactionButton.closest('div[data-id], div[data-urn]');
            const postId = postElement ? 
                          (postElement.getAttribute('data-id') || postElement.getAttribute('data-urn')) : 
                          'unknown_post_id';
            
            sendEvent('REACTION', {
                postId: postId,
                reactionType: reactionButton.getAttribute('data-reaction-type') || 'unknown_reaction'
            });
        }
    });
}

// Track comments
function setupCommentTracking() {
    document.addEventListener('submit', (e) => {
        const commentForm = e.target.closest('.comment-form');
        if (commentForm) {
            const postElement = commentForm.closest('div[data-id], div[data-urn]');
            const postId = postElement ? 
                          (postElement.getAttribute('data-id') || postElement.getAttribute('data-urn')) : 
                          'unknown_post_id';
            
            sendEvent('COMMENT', {
                postId: postId,
                commentText: commentForm.querySelector('textarea, input[type="text"]')?.value || ''
            });
        }
    });
}

// Initialize all tracking functions when DOM is ready
function initializeTracking() {
    try {
        setupPostImpressionTracking();
        setupReactionTracking();
        setupCommentTracking();
        console.log('LinkedIn Activity Logger: Tracking initialized');
    } catch (error) {
        console.error('LinkedIn Activity Logger: Error initializing tracking:', error);
    }
}

// Start tracking when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTracking);
} else {
    initializeTracking();
}