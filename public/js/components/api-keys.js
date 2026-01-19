/**
 * API Keys Management Component
 * Advanced API key management with model restrictions, rate limits, IP whitelisting
 */

window.Components = window.Components || {};

window.Components.apiKeys = () => ({
    keys: [],
    loading: true,
    creating: false,
    newKey: {
        name: '',
        allowed_models: [],
        rate_limit_rpm: '',
        rate_limit_rph: '',
        ip_whitelist: '',
        expires_at: '',
        notes: ''
    },
    generatedKey: null,
    showCreateDialog: false,
    showEditDialog: false,
    editingKey: null,
    searchQuery: '',
    showModelDropdown: false,
    showEditModelDropdown: false,

    // Get available models from data store
    get availableModels() {
        return this.$store?.data?.models || [];
    },

    // Toggle model selection for new key
    toggleModel(model) {
        const idx = this.newKey.allowed_models.indexOf(model);
        if (idx === -1) {
            this.newKey.allowed_models.push(model);
        } else {
            this.newKey.allowed_models.splice(idx, 1);
        }
    },

    // Check if model is selected for new key
    isModelSelected(model) {
        return this.newKey.allowed_models.includes(model);
    },

    // Toggle model selection for editing key
    toggleEditModel(model) {
        if (!this.editingKey.allowed_models_arr) {
            this.editingKey.allowed_models_arr = [];
        }
        const idx = this.editingKey.allowed_models_arr.indexOf(model);
        if (idx === -1) {
            this.editingKey.allowed_models_arr.push(model);
        } else {
            this.editingKey.allowed_models_arr.splice(idx, 1);
        }
    },

    // Check if model is selected for editing key
    isEditModelSelected(model) {
        return this.editingKey?.allowed_models_arr?.includes(model) || false;
    },

    // Select all models
    selectAllModels() {
        this.newKey.allowed_models = [...this.availableModels];
    },

    // Clear all models (means all allowed)
    clearAllModels() {
        this.newKey.allowed_models = [];
    },

    // Select all models for edit
    selectAllEditModels() {
        this.editingKey.allowed_models_arr = [...this.availableModels];
    },

    // Clear all models for edit
    clearAllEditModels() {
        this.editingKey.allowed_models_arr = [];
    },

    async init() {
        await this.loadKeys();
    },

    async loadKeys() {
        this.loading = true;
        try {
            const { response } = await window.utils.request('/api/keys');
            const data = await response.json();
            if (data.status === 'ok') {
                this.keys = data.keys || [];
            }
        } catch (error) {
            console.error('Failed to load API keys:', error);
            this.$store.global.showToast('Failed to load API keys', 'error');
        } finally {
            this.loading = false;
        }
    },

    get filteredKeys() {
        if (!this.searchQuery) return this.keys;
        const query = this.searchQuery.toLowerCase();
        return this.keys.filter(key =>
            key.name.toLowerCase().includes(query) ||
            key.key_prefix.toLowerCase().includes(query)
        );
    },

    openCreateDialog() {
        this.newKey = {
            name: '',
            allowed_models: [],
            rate_limit_rpm: '',
            rate_limit_rph: '',
            ip_whitelist: '',
            expires_at: '',
            notes: ''
        };
        this.showModelDropdown = false;
        this.showCreateDialog = true;
    },

    closeCreateDialog() {
        this.showCreateDialog = false;
        this.generatedKey = null;
    },

    async createKey() {
        if (!this.newKey.name.trim()) {
            this.$store.global.showToast('Please enter a key name', 'error');
            return;
        }

        this.creating = true;
        try {
            const body = {
                name: this.newKey.name.trim(),
                notes: this.newKey.notes.trim() || null
            };

            // Model restrictions (array)
            if (this.newKey.allowed_models.length > 0) {
                body.allowed_models = [...this.newKey.allowed_models];
            }

            // Parse rate limits
            if (this.newKey.rate_limit_rpm) {
                body.rate_limit_rpm = parseInt(this.newKey.rate_limit_rpm);
            }
            if (this.newKey.rate_limit_rph) {
                body.rate_limit_rph = parseInt(this.newKey.rate_limit_rph);
            }

            // Parse IP whitelist
            if (this.newKey.ip_whitelist.trim()) {
                body.ip_whitelist = this.newKey.ip_whitelist.split(',').map(ip => ip.trim()).filter(Boolean);
            }

            // Parse expiration
            if (this.newKey.expires_at) {
                body.expires_at = new Date(this.newKey.expires_at).getTime();
            }

            const { response } = await window.utils.request('/api/keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await response.json();
            if (data.status === 'ok') {
                this.generatedKey = data.key.key;
                this.$store.global.showToast('API key created', 'success');
                await this.loadKeys();
            } else {
                throw new Error(data.error || 'Failed to create key');
            }
        } catch (error) {
            console.error('Failed to create API key:', error);
            this.$store.global.showToast(error.message, 'error');
        } finally {
            this.creating = false;
        }
    },

    async copyKey(key) {
        try {
            await navigator.clipboard.writeText(key);
            this.$store.global.showToast('Key copied to clipboard', 'success');
        } catch (error) {
            this.$store.global.showToast('Failed to copy key', 'error');
        }
    },

    openEditDialog(key) {
        this.editingKey = {
            ...key,
            allowed_models_arr: key.allowed_models ? [...key.allowed_models] : [],
            ip_whitelist_str: key.ip_whitelist ? key.ip_whitelist.join(', ') : '',
            expires_at_str: key.expires_at ? new Date(key.expires_at).toISOString().slice(0, 16) : ''
        };
        this.showEditModelDropdown = false;
        this.showEditDialog = true;
    },

    closeEditDialog() {
        this.showEditDialog = false;
        this.editingKey = null;
    },

    async saveKey() {
        if (!this.editingKey) return;

        try {
            const body = {
                name: this.editingKey.name,
                notes: this.editingKey.notes || null
            };

            // Model restrictions (array)
            if (this.editingKey.allowed_models_arr && this.editingKey.allowed_models_arr.length > 0) {
                body.allowed_models = [...this.editingKey.allowed_models_arr];
            } else {
                body.allowed_models = null;
            }

            // Parse rate limits
            body.rate_limit_rpm = this.editingKey.rate_limit_rpm ? parseInt(this.editingKey.rate_limit_rpm) : null;
            body.rate_limit_rph = this.editingKey.rate_limit_rph ? parseInt(this.editingKey.rate_limit_rph) : null;

            // Parse IP whitelist
            if (this.editingKey.ip_whitelist_str.trim()) {
                body.ip_whitelist = this.editingKey.ip_whitelist_str.split(',').map(ip => ip.trim()).filter(Boolean);
            } else {
                body.ip_whitelist = null;
            }

            // Parse expiration
            if (this.editingKey.expires_at_str) {
                body.expires_at = new Date(this.editingKey.expires_at_str).getTime();
            } else {
                body.expires_at = null;
            }

            const { response } = await window.utils.request(`/api/keys/${this.editingKey.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await response.json();
            if (data.status === 'ok') {
                this.$store.global.showToast('API key updated', 'success');
                this.closeEditDialog();
                await this.loadKeys();
            } else {
                throw new Error(data.error || 'Failed to update key');
            }
        } catch (error) {
            console.error('Failed to update API key:', error);
            this.$store.global.showToast(error.message, 'error');
        }
    },

    async toggleKey(key) {
        try {
            const { response } = await window.utils.request(`/api/keys/${key.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: !key.enabled })
            });

            const data = await response.json();
            if (data.status === 'ok') {
                key.enabled = !key.enabled;
                this.$store.global.showToast(`Key ${key.enabled ? 'enabled' : 'disabled'}`, 'success');
            }
        } catch (error) {
            console.error('Failed to toggle API key:', error);
            this.$store.global.showToast('Failed to toggle key', 'error');
        }
    },

    async deleteKey(key) {
        if (!confirm(`Delete API key "${key.name}"? This cannot be undone.`)) return;

        try {
            const { response } = await window.utils.request(`/api/keys/${key.id}`, {
                method: 'DELETE'
            });

            const data = await response.json();
            if (data.status === 'ok') {
                this.$store.global.showToast('API key deleted', 'success');
                await this.loadKeys();
            }
        } catch (error) {
            console.error('Failed to delete API key:', error);
            this.$store.global.showToast('Failed to delete key', 'error');
        }
    },

    async regenerateKey(key) {
        if (!confirm(`Regenerate API key "${key.name}"? The old key will stop working immediately.`)) return;

        try {
            const { response } = await window.utils.request(`/api/keys/${key.id}/regenerate`, {
                method: 'POST'
            });

            const data = await response.json();
            if (data.status === 'ok') {
                this.generatedKey = data.key.key;
                this.showCreateDialog = true; // Reuse create dialog to show new key
                this.$store.global.showToast('API key regenerated', 'success');
                await this.loadKeys();
            }
        } catch (error) {
            console.error('Failed to regenerate API key:', error);
            this.$store.global.showToast('Failed to regenerate key', 'error');
        }
    },

    formatDate(timestamp) {
        if (!timestamp) return 'Never';
        return new Date(timestamp).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    isExpired(key) {
        return key.expires_at && Date.now() > key.expires_at;
    },

    getExpirationStatus(key) {
        if (!key.expires_at) return null;
        const now = Date.now();
        if (now > key.expires_at) return 'expired';
        const daysLeft = (key.expires_at - now) / (1000 * 60 * 60 * 24);
        if (daysLeft < 7) return 'expiring-soon';
        return 'valid';
    }
});
