// Intercept fetch requests
const originalFetch = window.fetch;
window.fetch = function(...args) {
    const url = args[0];
    const options = args[1] || {};
    const method = options.method || 'GET';
    const startTime = Date.now();
    
    logFrontendRequest('outgoing', url, method, options.headers, options.body);
    
    return originalFetch.apply(this, args)
        .then(response => {
            const duration = Date.now() - startTime;
            response.clone().text().then(text => {
                try {
                    const data = JSON.parse(text);
                    logFrontendRequest('outgoing', url, method, options.headers, options.body, data, response.status, duration);
                } catch {
                    logFrontendRequest('outgoing', url, method, options.headers, options.body, text.substring(0, 200), response.status, duration);
                }
            });
            return response;
        })
        .catch(error => {
            const duration = Date.now() - startTime;
            logFrontendRequest('outgoing', url, method, options.headers, options.body, { error: error.message }, 0, duration);
            throw error;
        });
};

// Frontend request logging (will be synced with backend logs)
const frontendLogs = [];

function logFrontendRequest(type, url, method, headers, body, response, status, duration) {
    // This is just for demonstration - in a real app, you'd send these to backend
    // For now, we rely on backend logging since all API calls go through the server
}

// State management
let autoRefreshInterval = null;
let isAuthenticated = false;

// DOM Elements
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const userInfo = document.getElementById('user-info');
const userData = document.getElementById('user-data');
const testProfileBtn = document.getElementById('test-profile-btn');
const testStorageInstancesBtn = document.getElementById('test-storage-instances-btn');
const testStorageInstanceBtn = document.getElementById('test-storage-instance-btn');
const testStorageDataelementsBtn = document.getElementById('test-storage-dataelements-btn');
const testStorageEventsBtn = document.getElementById('test-storage-events-btn');
const testAppMetadataBtn = document.getElementById('test-app-metadata-btn');
const testAppInstancesBtn = document.getElementById('test-app-instances-btn');
const instanceIdInput = document.getElementById('instance-id-input');
const apiResponse = document.getElementById('api-response');
const apiResponseData = document.getElementById('api-response-data');
const logsContainer = document.getElementById('logs-container');
const refreshLogsBtn = document.getElementById('refresh-logs-btn');
const clearLogsBtn = document.getElementById('clear-logs-btn');
const autoRefreshCheckbox = document.getElementById('auto-refresh');

// Event Listeners
loginBtn.addEventListener('click', () => {
    window.location.href = '/auth/login';
});

logoutBtn.addEventListener('click', () => {
    window.location.href = '/auth/logout';
});

// Platform API
testProfileBtn.addEventListener('click', async () => {
    await testApiCall('/api/platform/profile');
});

testStorageInstancesBtn.addEventListener('click', async () => {
    await testApiCall('/api/platform/storage/instances');
});

// Storage API
testStorageInstanceBtn.addEventListener('click', async () => {
    const instanceId = instanceIdInput.value.trim();
    if (!instanceId) {
        alert('Please enter an instance ID');
        return;
    }
    await testApiCall(`/api/platform/storage/instances/${encodeURIComponent(instanceId)}`);
});

testStorageDataelementsBtn.addEventListener('click', async () => {
    const instanceId = instanceIdInput.value.trim();
    if (!instanceId) {
        alert('Please enter an instance ID');
        return;
    }
    await testApiCall(`/api/platform/storage/instances/${encodeURIComponent(instanceId)}/dataelements`);
});

testStorageEventsBtn.addEventListener('click', async () => {
    const instanceId = instanceIdInput.value.trim();
    if (!instanceId) {
        alert('Please enter an instance ID');
        return;
    }
    await testApiCall(`/api/platform/storage/instances/${encodeURIComponent(instanceId)}/events`);
});

// App API
testAppMetadataBtn.addEventListener('click', async () => {
    await testApiCall('/api/app/metadata');
});

testAppInstancesBtn.addEventListener('click', async () => {
    await testApiCall('/api/app/instances');
});

refreshLogsBtn.addEventListener('click', () => {
    loadLogs();
});

clearLogsBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all logs?')) {
        try {
            await fetch('/api/logs/clear', { method: 'POST' });
            loadLogs();
        } catch (error) {
            console.error('Error clearing logs:', error);
        }
    }
});

autoRefreshCheckbox.addEventListener('change', (e) => {
    if (e.target.checked) {
        startAutoRefresh();
    } else {
        stopAutoRefresh();
    }
});

// Functions
async function checkAuthStatus() {
    try {
        const response = await fetch('/api/user');
        if (response.ok) {
            const data = await response.json();
            isAuthenticated = true;
            updateUI(true, data.userInfo);
        } else {
            isAuthenticated = false;
            updateUI(false);
        }
    } catch (error) {
        isAuthenticated = false;
        updateUI(false);
    }
}

function updateUI(authenticated, userInfo = null) {
    if (authenticated) {
        statusIndicator.classList.add('authenticated');
        statusText.textContent = 'Authenticated';
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-block';
        
        // Enable Platform API buttons
        testProfileBtn.disabled = false;
        testStorageInstancesBtn.disabled = false;
        
        // Enable Storage API buttons
        testStorageInstanceBtn.disabled = false;
        testStorageDataelementsBtn.disabled = false;
        testStorageEventsBtn.disabled = false;
        instanceIdInput.disabled = false;
        
        // Enable App API buttons
        testAppMetadataBtn.disabled = false;
        testAppInstancesBtn.disabled = false;
        
        if (userInfo) {
            userInfo.style.display = 'block';
            userData.textContent = JSON.stringify(userInfo, null, 2);
        }
    } else {
        statusIndicator.classList.remove('authenticated');
        statusText.textContent = 'Not authenticated';
        loginBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'none';
        
        // Disable Platform API buttons
        testProfileBtn.disabled = true;
        testStorageInstancesBtn.disabled = true;
        
        // Disable Storage API buttons
        testStorageInstanceBtn.disabled = true;
        testStorageDataelementsBtn.disabled = true;
        testStorageEventsBtn.disabled = true;
        instanceIdInput.disabled = true;
        
        // Disable App API buttons
        testAppMetadataBtn.disabled = true;
        testAppInstancesBtn.disabled = true;
        
        userInfo.style.display = 'none';
    }
}

async function testApiCall(endpoint) {
    apiResponse.style.display = 'block';
    apiResponseData.textContent = 'Loading...';
    
    try {
        const response = await fetch(endpoint);
        const data = await response.json();
        apiResponseData.textContent = JSON.stringify(data, null, 2);
        
        // Refresh logs to show the new API call
        setTimeout(() => loadLogs(), 500);
    } catch (error) {
        apiResponseData.textContent = JSON.stringify({ error: error.message }, null, 2);
    }
}

async function loadLogs() {
    try {
        const response = await fetch('/api/logs');
        const logs = await response.json();
        displayLogs(logs);
    } catch (error) {
        console.error('Error loading logs:', error);
        logsContainer.innerHTML = '<p class="no-logs">Error loading logs</p>';
    }
}

function displayLogs(logs) {
    if (logs.length === 0) {
        logsContainer.innerHTML = '<p class="no-logs">No requests logged yet. Click "Login" to start the authentication flow.</p>';
        return;
    }
    
    logsContainer.innerHTML = logs.map(log => createLogEntry(log)).join('');
}

function createLogEntry(log) {
    const statusClass = log.statusCode >= 400 ? 'error' : '';
    const methodBadge = getMethodBadge(log.method);
    const typeBadge = getTypeBadge(log.type);
    const statusBadge = getStatusBadge(log.statusCode);
    
    const hasRequest = log.requestBody && Object.keys(log.requestBody).length > 0;
    const hasResponse = log.responseBody && Object.keys(log.responseBody).length > 0;
    const hasHeaders = log.headers && Object.keys(log.headers).length > 0;
    
    return `
        <div class="log-entry ${log.type} ${statusClass}">
            <div class="log-header">
                <div class="log-meta">
                    <span class="log-badge ${typeBadge.class}">${log.type}</span>
                    <span class="log-badge ${methodBadge.class}">${log.method}</span>
                    ${statusBadge ? `<span class="status-badge ${statusBadge.class}">${log.statusCode || 'Pending'}</span>` : ''}
                    <span>${new Date(log.timestamp).toLocaleTimeString()}</span>
                </div>
            </div>
            <div class="log-url">${escapeHtml(log.url)}</div>
            ${hasHeaders || hasRequest || hasResponse ? `
                <details class="log-details">
                    <summary>Show Details</summary>
                    <div class="log-details-content">
                        ${hasHeaders ? `
                            <div class="log-section-label">Headers:</div>
                            <pre>${JSON.stringify(log.headers, null, 2)}</pre>
                        ` : ''}
                        ${hasRequest ? `
                            <div class="log-section-label">Request Body:</div>
                            <pre>${JSON.stringify(log.requestBody, null, 2)}</pre>
                        ` : ''}
                        ${hasResponse ? `
                            <div class="log-section-label">Response Body:</div>
                            <pre>${JSON.stringify(log.responseBody, null, 2)}</pre>
                        ` : ''}
                    </div>
                </details>
            ` : ''}
        </div>
    `;
}

function getMethodBadge(method) {
    const badges = {
        'GET': { class: 'badge-get', text: 'GET' },
        'POST': { class: 'badge-post', text: 'POST' },
        'PUT': { class: 'badge-post', text: 'PUT' },
        'DELETE': { class: 'badge-danger', text: 'DELETE' }
    };
    return badges[method] || { class: '', text: method };
}

function getTypeBadge(type) {
    return type === 'outgoing' 
        ? { class: 'badge-outgoing', text: 'Outgoing' }
        : { class: 'badge-incoming', text: 'Incoming' };
}

function getStatusBadge(status) {
    if (!status) return null;
    if (status >= 200 && status < 300) {
        return { class: 'status-200', text: status };
    }
    if (status >= 400) {
        return { class: 'status-error', text: status };
    }
    return { class: '', text: status };
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function startAutoRefresh() {
    if (autoRefreshInterval) return;
    autoRefreshInterval = setInterval(() => {
        loadLogs();
    }, 2000); // Refresh every 2 seconds
}

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
}

// Initialize
checkAuthStatus();
loadLogs();
startAutoRefresh();

// Check for URL parameters (success/error from OAuth callback)
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('success')) {
    setTimeout(() => {
        checkAuthStatus();
        loadLogs();
    }, 500);
}
if (urlParams.has('error')) {
    alert('Authentication error: ' + urlParams.get('error'));
}

