const ADMIN_EMAILS = ['keyamuha@gmail.com', 'fricker2025@gmail.com'];

// Robust Clerk initialization
async function startApp() {
    try {
        // Wait for Clerk to be available on window
        if (typeof Clerk === 'undefined') {
            await new Promise(resolve => {
                const interval = setInterval(() => {
                    if (typeof Clerk !== 'undefined') {
                        clearInterval(interval);
                        resolve();
                    }
                }, 100);
            });
        }

        await Clerk.load();

        const authOverlay = document.getElementById('auth-overlay');
        const adminOnlyOverlay = document.getElementById('admin-only-overlay');
        const userButtonDiv = document.getElementById('user-button');

        if (!Clerk.user) {
            authOverlay.classList.remove('hidden');
            return;
        }

        const email = Clerk.user.primaryEmailAddress.emailAddress.toLowerCase();
        if (!ADMIN_EMAILS.includes(email)) {
            adminOnlyOverlay.classList.remove('hidden');
            return;
        }

        // If we reach here, user is authenticated and is admin
        Clerk.mountUserButton(userButtonDiv);
        initAdminPanel();
    } catch (error) {
        console.error('Error starting app:', error);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}

function initAdminPanel() {
    console.log('Initializing Admin Panel...');
    const providerNameInput = document.getElementById('providerName');
    const apiBaseUrlInput = document.getElementById('apiBaseUrl');
    const apiKeyInput = document.getElementById('apiKey');
    const addProviderBtn = document.getElementById('addProvider');
    const providersList = document.getElementById('providersList');
    const fetchModelsBtn = document.getElementById('fetchModels');
    const modelsTableBody = document.getElementById('modelsTableBody');
    const toastContainer = document.getElementById('toast-container');

    if (!addProviderBtn) {
        console.error('Add Provider button not found!');
        return;
    }

    // Helper for authenticated fetches
    async function fetchWithAuth(url, options = {}) {
        const token = await Clerk.session.getToken();
        return fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                'Authorization': `Bearer ${token}`
            }
        });
    }

    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        const bgColor = type === 'success' ? 'bg-zinc-900 border-zinc-800' : 'bg-red-500/10 border-red-500/20';
        const textColor = type === 'success' ? 'text-zinc-200' : 'text-red-500';
        const icon = type === 'success' 
            ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
            : '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';

        toast.className = `${bgColor} ${textColor} border px-6 py-4 rounded-xl shadow-2xl flex items-center animate-slide-up transition-all duration-300`;
        toast.innerHTML = `${icon} <span class="text-sm font-medium">${message}</span>`;
        
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Load current config
    async function loadConfig() {
        try {
            const response = await fetchWithAuth('/api/admin/config');
            const data = await response.json();
            renderProviders(data.providers || []);
        } catch (error) {
            showToast('Failed to load configuration', 'error');
        }
    }

    function renderProviders(providers) {
        if (providers.length === 0) {
            providersList.innerHTML = '<div class="text-center py-4 text-gray-400 italic text-sm">No providers added yet.</div>';
            return;
        }

        providersList.innerHTML = providers.map(p => `
            <div class="flex items-center justify-between p-4 bg-[#ffb7c5]/5 rounded-2xl border-2 border-[#ffb7c5]/10 group">
                <div class="min-w-0 flex-1">
                    <div class="font-black text-sm text-gray-800 truncate">${p.name}</div>
                    <div class="text-[10px] text-gray-400 font-bold truncate">${p.apiBaseUrl}</div>
                </div>
                <div class="flex items-center ml-4 space-x-2">
                    <button onclick="refreshProvider('${p.id}', this)" class="p-2 text-[#ffb7c5] hover:bg-[#ffb7c5]/10 rounded-lg transition-all" title="Refresh Connection">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
                    </button>
                    <button onclick="removeProvider('${p.id}')" class="p-2 text-gray-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100" title="Remove Provider">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    </button>
                </div>
            </div>
        `).join('');
    }

    // Helper to normalize API Base URL
    function normalizeBaseUrl(url) {
        if (!url) return '';
        let normalized = url.trim().replace(/\/$/, '');
        
        // Strip common subpaths
        const subpathsToStrip = [
            '/chat/completions',
            '/completions',
            '/chat',
            '/embeddings',
            '/models'
        ];
        
        for (const subpath of subpathsToStrip) {
            if (normalized.endsWith(subpath)) {
                normalized = normalized.slice(0, -subpath.length);
            }
        }
        
        // Ensure /v1 for common providers if missing
        if (!normalized.includes('/v1') && (normalized.includes('openai') || normalized.includes('localhost') || normalized.includes('127.0.0.1'))) {
            const parts = normalized.split('/');
            if (parts.length <= 3) {
                normalized = `${normalized}/v1`;
            }
        }
        return normalized.replace(/\/$/, '');
    }

    // Global Add Provider function
    window.handleAddProvider = async () => {
        const name = providerNameInput.value;
        let apiBaseUrl = normalizeBaseUrl(apiBaseUrlInput.value);
        const apiKey = apiKeyInput.value;

        if (!name || !apiBaseUrl || !apiKey) {
            showToast('Please fill in all fields', 'error');
            return;
        }

        // Update input field with normalized URL
        apiBaseUrlInput.value = apiBaseUrl;

        const addProviderBtn = document.getElementById('addProvider');
        if (addProviderBtn) {
            addProviderBtn.disabled = true;
            addProviderBtn.innerHTML = '<svg class="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Adding...';
        }

        try {
            const response = await fetchWithAuth('/api/admin/providers/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, apiBaseUrl, apiKey })
            });
            
            if (response.ok) {
                showToast('Provider added and models synced');
                providerNameInput.value = '';
                apiBaseUrlInput.value = '';
                apiKeyInput.value = '';
                loadConfig();
                loadModels();
            } else {
                const err = await response.json();
                showToast(err.error || 'Failed to add provider', 'error');
            }
        } catch (error) {
            showToast('Error adding provider', 'error');
        } finally {
            if (addProviderBtn) {
                addProviderBtn.disabled = false;
                addProviderBtn.innerHTML = 'Add Provider';
            }
        }
    };

    // Remove provider
    window.removeProvider = async (providerId) => {
        if (!confirm('Are you sure you want to remove this provider? All its models will also be removed.')) return;

        try {
            const response = await fetchWithAuth('/api/admin/providers/remove', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ providerId })
            });
            
            if (response.ok) {
                showToast('Provider removed');
                loadConfig();
                loadModels();
            }
        } catch (error) {
            showToast('Failed to remove provider', 'error');
        }
    };

    // Refresh provider models
    window.refreshProvider = async (providerId, btn) => {
        const icon = btn.querySelector('svg');
        if (icon) icon.classList.add('animate-spin');
        btn.disabled = true;

        try {
            const response = await fetchWithAuth('/api/admin/providers/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ providerId })
            });
            
            if (response.ok) {
                const data = await response.json();
                showToast(data.message || 'Models refreshed');
                loadModels();
            } else {
                const err = await response.json();
                showToast(err.error || 'Failed to refresh provider', 'error');
            }
        } catch (error) {
            showToast('Error refreshing provider', 'error');
        } finally {
            if (icon) icon.classList.remove('animate-spin');
            btn.disabled = false;
        }
    };

    // Fetch models from all providers
    window.handleSyncModels = async () => {
        const fetchModelsBtn = document.getElementById('fetchModels');
        if (fetchModelsBtn) {
            fetchModelsBtn.disabled = true;
            fetchModelsBtn.innerHTML = '<svg class="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Syncing...';
        }
        
        try {
            const response = await fetchWithAuth('/api/admin/fetch-models', { method: 'POST' });
            if (response.ok) {
                showToast('Models synced from all providers');
                loadModels();
            } else {
                const err = await response.json();
                showToast(err.error || 'Failed to fetch models', 'error');
            }
        } catch (error) {
            showToast('Error connecting to server', 'error');
        } finally {
            if (fetchModelsBtn) {
                fetchModelsBtn.disabled = false;
                fetchModelsBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg> Sync Models';
            }
        }
    };

    // Load and render models table
    async function loadModels() {
        try {
            const response = await fetchWithAuth('/api/admin/models');
            const models = await response.json();
            
            if (models.length === 0) {
                modelsTableBody.innerHTML = `
                    <tr>
                        <td colspan="3" class="py-32 text-center">
                            <div class="flex flex-col items-center">
                                <div class="w-20 h-20 bg-[#ffb7c5]/20 rounded-[2rem] flex items-center justify-center mb-6 border-4 border-[#ffb7c5]/30 shadow-xl hand-drawn">
                                    <span class="text-3xl text-[#ffb7c5]">！</span>
                                </div>
                                <p class="font-black italic text-xl tracking-wide text-gray-400">The clubroom is empty... <br/> <span class="text-[#ffb7c5]">Add a provider to invite some friends！</span></p>
                            </div>
                        </td>
                    </tr>
                `;
                return;
            }

            modelsTableBody.innerHTML = models.map(model => `
                <tr class="hover:bg-[#ffb7c5]/5 transition-colors group">
                    <td class="py-5 px-8">
                        <div class="font-black text-sm text-gray-800">${model.id}</div>
                        <div class="text-[10px] text-[#ffb7c5] mt-1 font-black uppercase tracking-widest">${model.providerName || 'unknown provider'}</div>
                    </td>
                    <td class="py-5 px-8">
                        <span class="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${model.enabled ? 'bg-green-100 text-green-600 border border-green-200' : 'bg-gray-100 text-gray-400 border border-gray-200'}">
                            ${model.enabled ? 'Active' : 'Disabled'}
                        </span>
                    </td>
                    <td class="py-5 px-8 text-right">
                        <label class="custom-toggle">
                            <input type="checkbox" ${model.enabled ? 'checked' : ''} 
                                onchange="toggleModelVisibility('${model.id}', '${model.providerId}', this.checked)">
                            <span class="slider"></span>
                        </label>
                    </td>
                </tr>
            `).join('');
        } catch (error) {
            showToast('Failed to load models', 'error');
        }
    }

    // Global function for toggle
    window.toggleModelVisibility = async (modelId, providerId, enabled) => {
        try {
            const response = await fetchWithAuth('/api/admin/toggle-model', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ modelId, providerId, enabled })
            });
            
            if (response.ok) {
                showToast(`Model ${enabled ? 'enabled' : 'disabled'}`);
                loadModels();
            }
        } catch (error) {
            showToast('Failed to update model status', 'error');
        }
    };

    loadConfig();
    loadModels();
}