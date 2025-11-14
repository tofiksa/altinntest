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
const viewUserInfoBtn = document.getElementById('view-user-info-btn');
const refreshUserInfoBtn = document.getElementById('refresh-user-info-btn');
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const userInfo = document.getElementById('user-info');
const userInfoSummary = document.getElementById('user-info-summary');
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

viewUserInfoBtn.addEventListener('click', () => {
    displayUserInformation();
});

refreshUserInfoBtn.addEventListener('click', () => {
    displayUserInformation();
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
            updateUI(true, data.userInfo, data.authorizationDetails, data.idTokenClaims);
        } else {
            isAuthenticated = false;
            updateUI(false);
        }
    } catch (error) {
        isAuthenticated = false;
        updateUI(false);
    }
}

// Function to extract and format organization numbers from authorization details
function extractOrganizationNumbers(authorizationDetails) {
    const orgNumbers = [];
    
    if (!authorizationDetails || !Array.isArray(authorizationDetails)) {
        return orgNumbers;
    }
    
    // Helper function to extract org number from various formats
    function extractOrgNumber(orgnoValue) {
        if (!orgnoValue) return null;
        
        let orgno = orgnoValue;
        // Handle object format { authority: "...", ID: "0192:314758625" }
        if (typeof orgnoValue === 'object' && orgnoValue.ID) {
            orgno = orgnoValue.ID;
        }
        
        if (!orgno) return null;
        
        // Handle ISO6523 format: "0192:314758625" or just "314758625"
        if (typeof orgno === 'string') {
            // If it contains a colon, extract the part after the colon
            if (orgno.includes(':')) {
                const parts = orgno.split(':');
                return parts[parts.length - 1]; // Get the last part after the colon
            }
            // If it's just digits, return as is
            if (/^\d+$/.test(orgno)) {
                return orgno;
            }
        }
        
        return null;
    }
    
    authorizationDetails.forEach(authDetail => {
        // Check for orgno in the detail itself (ansattporten:orgno type)
        if (authDetail.orgno) {
            const orgno = extractOrgNumber(authDetail.orgno);
            if (orgno) {
                orgNumbers.push({
                    orgno: orgno,
                    type: authDetail.type,
                    fullId: typeof authDetail.orgno === 'object' ? authDetail.orgno.ID : authDetail.orgno
                });
            }
        }
        
        // Check for authorized_parties (for altinn:resource and altinn:service types)
        if (authDetail.authorized_parties && Array.isArray(authDetail.authorized_parties)) {
            authDetail.authorized_parties.forEach(party => {
                if (party.orgno) {
                    const orgno = extractOrgNumber(party.orgno);
                    if (orgno) {
                        orgNumbers.push({
                            orgno: orgno,
                            type: authDetail.type,
                            resource: authDetail.resource || party.resource,
                            resourceName: authDetail.resource_name || party.name,
                            unitType: party.unit_type,
                            fullId: typeof party.orgno === 'object' ? party.orgno.ID : party.orgno
                        });
                    }
                }
            });
        }
    });
    
    return orgNumbers;
}

// Function to display user information with formatted organization numbers
async function displayUserInformation() {
    try {
        const response = await fetch('/api/user');
        if (!response.ok) {
            throw new Error('Failed to fetch user information');
        }
        
        const data = await response.json();
        
        // Show the user info section
        userInfo.style.display = 'block';
        
        // Build comprehensive user data object
        const displayData = {
            userInfo: data.userInfo || null,
            authorizationDetails: data.authorizationDetails || null,
            idTokenClaims: data.idTokenClaims || null
        };
        
        // Extract organization numbers
        const orgNumbers = extractOrganizationNumbers(data.authorizationDetails);
        
        // Build formatted summary
        let summaryHTML = '<div class="user-info-content">';
        
        // Basic user info
        if (data.userInfo) {
            summaryHTML += '<div class="info-section"><h3>Basic Information</h3>';
            if (data.userInfo.sub) summaryHTML += `<p><strong>Subject:</strong> ${escapeHtml(data.userInfo.sub)}</p>`;
            if (data.userInfo.name) summaryHTML += `<p><strong>Name:</strong> ${escapeHtml(data.userInfo.name)}</p>`;
            if (data.userInfo.email) summaryHTML += `<p><strong>Email:</strong> ${escapeHtml(data.userInfo.email)}</p>`;
            if (data.userInfo.pid) summaryHTML += `<p><strong>PID:</strong> ${escapeHtml(data.userInfo.pid)}</p>`;
            summaryHTML += '</div>';
        }
        
        // Organization numbers
        if (orgNumbers.length > 0) {
            summaryHTML += '<div class="info-section"><h3>Organization Numbers</h3>';
            summaryHTML += '<div class="org-numbers-list">';
            
            // Group by organization number to avoid duplicates
            const uniqueOrgs = {};
            orgNumbers.forEach(org => {
                if (!uniqueOrgs[org.orgno]) {
                    uniqueOrgs[org.orgno] = [];
                }
                uniqueOrgs[org.orgno].push(org);
            });
            
            Object.keys(uniqueOrgs).forEach(orgno => {
                const orgs = uniqueOrgs[orgno];
                summaryHTML += `<div class="org-number-item">`;
                summaryHTML += `<div class="org-number-badge">${escapeHtml(orgno)}</div>`;
                summaryHTML += '<div class="org-details">';
                orgs.forEach(org => {
                    if (org.resourceName) {
                        summaryHTML += `<p><strong>Resource:</strong> ${escapeHtml(org.resourceName)}</p>`;
                    }
                    if (org.unitType) {
                        summaryHTML += `<p><strong>Type:</strong> ${escapeHtml(org.unitType)}</p>`;
                    }
                    if (org.type) {
                        summaryHTML += `<p><strong>Authorization Type:</strong> ${escapeHtml(org.type)}</p>`;
                    }
                });
                summaryHTML += '</div></div>';
            });
            
            summaryHTML += '</div></div>';
        } else if (data.authorizationDetails) {
            summaryHTML += '<div class="info-section"><h3>Organization Numbers</h3>';
            summaryHTML += '<p class="no-data">No organization numbers found in authorization details.</p>';
            summaryHTML += '</div>';
        }
        
        // Authorization details summary
        if (data.authorizationDetails && Array.isArray(data.authorizationDetails)) {
            summaryHTML += '<div class="info-section"><h3>Authorization Details</h3>';
            summaryHTML += `<p><strong>Number of authorizations:</strong> ${data.authorizationDetails.length}</p>`;
            data.authorizationDetails.forEach((auth, index) => {
                summaryHTML += `<div class="auth-detail-item">`;
                summaryHTML += `<p><strong>Type ${index + 1}:</strong> ${escapeHtml(auth.type || 'N/A')}</p>`;
                if (auth.resource) {
                    summaryHTML += `<p><strong>Resource:</strong> ${escapeHtml(auth.resource)}</p>`;
                }
                if (auth.resource_name) {
                    summaryHTML += `<p><strong>Resource Name:</strong> ${escapeHtml(auth.resource_name)}</p>`;
                }
                if (auth.authorized_parties && auth.authorized_parties.length > 0) {
                    summaryHTML += `<p><strong>Authorized Parties:</strong> ${auth.authorized_parties.length}</p>`;
                }
                summaryHTML += `</div>`;
            });
            summaryHTML += '</div>';
        }
        
        // ID Token Claims summary
        if (data.idTokenClaims) {
            summaryHTML += '<div class="info-section"><h3>ID Token Claims</h3>';
            if (data.idTokenClaims.sub) summaryHTML += `<p><strong>Subject:</strong> ${escapeHtml(data.idTokenClaims.sub)}</p>`;
            if (data.idTokenClaims.iss) summaryHTML += `<p><strong>Issuer:</strong> ${escapeHtml(data.idTokenClaims.iss)}</p>`;
            if (data.idTokenClaims.aud) summaryHTML += `<p><strong>Audience:</strong> ${escapeHtml(Array.isArray(data.idTokenClaims.aud) ? data.idTokenClaims.aud.join(', ') : data.idTokenClaims.aud)}</p>`;
            if (data.idTokenClaims.exp) {
                const expDate = new Date(data.idTokenClaims.exp * 1000);
                summaryHTML += `<p><strong>Expires:</strong> ${expDate.toLocaleString()}</p>`;
            }
            summaryHTML += '</div>';
        }
        
        summaryHTML += '</div>';
        
        // Update the summary and full data
        userInfoSummary.innerHTML = summaryHTML;
        userData.textContent = JSON.stringify(displayData, null, 2);
        
    } catch (error) {
        console.error('Error fetching user information:', error);
        userInfo.style.display = 'block';
        userInfoSummary.innerHTML = `<p class="error">Error loading user information: ${escapeHtml(error.message)}</p>`;
    }
}

function updateUI(authenticated, userInfoData = null, authorizationDetails = null, idTokenClaims = null) {
    if (authenticated) {
        statusIndicator.classList.add('authenticated');
        statusText.textContent = 'Authenticated';
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-block';
        viewUserInfoBtn.style.display = 'inline-block';
        
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
        
        // Build comprehensive user data object with RAR authorization_details
        const displayData = {
            userInfo: userInfoData || null,
            authorizationDetails: authorizationDetails || null,
            idTokenClaims: idTokenClaims || null
        };
        
        // Display user info if available
        if (userInfoData || authorizationDetails || idTokenClaims) {
            userInfo.style.display = 'block';
            userData.textContent = JSON.stringify(displayData, null, 2);
            
            // Also update the summary
            const orgNumbers = extractOrganizationNumbers(authorizationDetails);
            let summaryHTML = '<div class="user-info-content">';
            
            if (orgNumbers.length > 0) {
                summaryHTML += '<div class="info-section"><h3>Organization Numbers</h3>';
                summaryHTML += '<div class="org-numbers-list">';
                const uniqueOrgs = {};
                orgNumbers.forEach(org => {
                    if (!uniqueOrgs[org.orgno]) {
                        uniqueOrgs[org.orgno] = org;
                    }
                });
                Object.keys(uniqueOrgs).forEach(orgno => {
                    summaryHTML += `<div class="org-number-badge">${escapeHtml(orgno)}</div>`;
                });
                summaryHTML += '</div></div>';
            }
            
            summaryHTML += '</div>';
            userInfoSummary.innerHTML = summaryHTML;
        } else {
            // Show user info section but indicate data is not available
            userInfo.style.display = 'block';
            userData.textContent = 'User information not available. It may still be loading or there was an error fetching it.';
            userInfoSummary.innerHTML = '<p class="no-data">Click "View My Information" to refresh.</p>';
        }
    } else {
        statusIndicator.classList.remove('authenticated');
        statusText.textContent = 'Not authenticated';
        loginBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'none';
        viewUserInfoBtn.style.display = 'none';
        
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

// Check if we're coming from logout - clear any cached state
if (urlParams.has('logout') || document.referrer.includes('/auth/logout')) {
    // Reset all frontend state
    isAuthenticated = false;
    
    // Clear all UI elements
    if (userInfoSummary) {
        userInfoSummary.innerHTML = '';
    }
    if (userData) {
        userData.textContent = '';
    }
    if (apiResponseData) {
        apiResponseData.textContent = '';
    }
    if (userInfo) {
        userInfo.style.display = 'none';
    }
    
    // Update UI to show logged out state
    updateUI(false);
    
    // Clear URL parameters
    if (window.history.replaceState) {
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    // Force a fresh auth status check
    setTimeout(() => {
        checkAuthStatus();
    }, 100);
}

