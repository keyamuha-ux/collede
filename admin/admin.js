const ADMIN_EMAIL = 'keyamuha@gmail.com';

document.addEventListener('DOMContentLoaded', async () => {
    await Clerk.load();

    const authOverlay = document.getElementById('auth-overlay');
    const adminOnlyOverlay = document.getElementById('admin-only-overlay');
    const userButtonDiv = document.getElementById('user-button');

    if (!Clerk.user) {
        authOverlay.classList.remove('hidden');
        return;
    }

    const email = Clerk.user.primaryEmailAddress.emailAddress;
    if (email !== ADMIN_EMAIL) {
        adminOnlyOverlay.classList.remove('hidden');
        return;
    }

    // If we reach here, user is authenticated and is admin
    Clerk.mountUserButton(userButtonDiv);
    initAdminPanel();
});

function initAdminPanel() {
    const apiBaseUrlInput = document.getElementById('apiBaseUrl');
    const apiKeyInput = document.getElementById('apiKey');
    const saveConfigBtn = document.getElementById('saveConfig');
    const fetchModelsBtn = document.getElementById('fetchModels');
    const modelsTableBody = document.getElementById('modelsTableBody');
    const toastContainer = document.getElementById('toast-container');

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
            const config = await response.json();
            apiBaseUrlInput.value = config.apiBaseUrl || '';
            apiKeyInput.value = config.apiKey || '';
        } catch (error) {
            showToast('Failed to load configuration', 'error');
        }
    }

    // Save config
    saveConfigBtn.addEventListener('click', async () => {
        const config = {
            apiBaseUrl: apiBaseUrlInput.value,
            apiKey: apiKeyInput.value
        };

        saveConfigBtn.disabled = true;
        saveConfigBtn.innerHTML = '<svg class="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Saving...';

        try {
            const response = await fetchWithAuth('/api/admin/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            
            if (response.ok) {
                showToast('System configuration updated');
                loadConfig(); 
            } else {
                showToast('Failed to save configuration', 'error');
            }
        } catch (error) {
            showToast('Error saving configuration', 'error');
        } finally {
            saveConfigBtn.disabled = false;
            saveConfigBtn.innerHTML = 'Save System Config';
        }
    });

    // Fetch models from provider
    fetchModelsBtn.addEventListener('click', async () => {
        fetchModelsBtn.disabled = true;
        fetchModelsBtn.innerHTML = '<svg class="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Syncing...';
        
        try {
            const response = await fetchWithAuth('/api/admin/fetch-models', { method: 'POST' });
            if (response.ok) {
                showToast('Models synced from provider');
                loadModels();
            } else {
                const err = await response.json();
                showToast(err.error || 'Failed to fetch models', 'error');
            }
        } catch (error) {
            showToast('Error connecting to server', 'error');
        } finally {
            fetchModelsBtn.disabled = false;
            fetchModelsBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg> Sync Models';
        }
    });

    // Load and render models table
    async function loadModels() {
        try {
            const response = await fetchWithAuth('/api/admin/models');
            const models = await response.json();
            
            if (models.length === 0) {
                modelsTableBody.innerHTML = `
                    <tr>
                        <td colspan="3" class="py-20 text-center text-zinc-600 italic">
                            <div class="flex flex-col items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mb-4 opacity-20"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
                                <p class="text-sm">No models synced yet.</p>
                            </div>
                        </td>
                    </tr>
                `;
                return;
            }

            modelsTableBody.innerHTML = models.map(model => `
                <tr class="hover:bg-zinc-900/50 transition-colors group">
                    <td class="py-5 px-8">
                        <div class="font-mono text-sm text-zinc-300">${model.id}</div>
                        <div class="text-[10px] text-zinc-600 mt-1 uppercase tracking-tighter">${model.owned_by || 'system'}</div>
                    </td>
                    <td class="py-5 px-8">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${model.enabled ? 'bg-indigo-500/10 text-indigo-400' : 'bg-zinc-800 text-zinc-500'}">
                            ${model.enabled ? 'Active' : 'Disabled'}
                        </span>
                    </td>
                    <td class="py-5 px-8 text-right">
                        <label class="custom-toggle">
                            <input type="checkbox" ${model.enabled ? 'checked' : ''} 
                                onchange="toggleModelVisibility('${model.id}', this.checked)">
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
    window.toggleModelVisibility = async (modelId, enabled) => {
        try {
            const response = await fetchWithAuth('/api/admin/toggle-model', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ modelId, enabled })
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