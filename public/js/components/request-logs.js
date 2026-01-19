/**
 * Request Logs Viewer Component
 * View and filter request logs with full content details
 */

window.Components = window.Components || {};

window.Components.requestLogs = () => ({
    logs: [],
    total: 0,
    page: 1,
    pages: 1,
    limit: 50,
    loading: true,

    // Filters
    filters: {
        api_key_id: '',
        model: '',
        status: '',
        from: '',
        to: '',
        search: ''
    },

    // Available filter options
    apiKeys: [],
    models: [],

    // Selected log for detail view
    selectedLog: null,
    showDetailDialog: false,
    loadingDetail: false,

    async init() {
        await Promise.all([
            this.loadLogs(),
            this.loadFilterOptions()
        ]);
    },

    async loadFilterOptions() {
        try {
            // Load API keys for filter dropdown
            const { response: keysResponse } = await window.utils.request('/api/keys');
            const keysData = await keysResponse.json();
            if (keysData.status === 'ok') {
                this.apiKeys = keysData.keys || [];
            }

            // Get unique models from logs
            const modelsSet = new Set(this.logs.map(log => log.model).filter(Boolean));
            this.models = Array.from(modelsSet).sort();
        } catch (error) {
            console.error('Failed to load filter options:', error);
        }
    },

    async loadLogs() {
        this.loading = true;
        try {
            const params = new URLSearchParams({
                page: this.page.toString(),
                limit: this.limit.toString()
            });

            // Add filters
            if (this.filters.api_key_id) params.set('api_key_id', this.filters.api_key_id);
            if (this.filters.model) params.set('model', this.filters.model);
            if (this.filters.status) params.set('status', this.filters.status);
            if (this.filters.from) params.set('from', new Date(this.filters.from).getTime().toString());
            if (this.filters.to) params.set('to', new Date(this.filters.to).getTime().toString());
            if (this.filters.search) params.set('search', this.filters.search);

            const { response } = await window.utils.request(`/api/logs/requests?${params}`);
            const data = await response.json();

            if (data.status === 'ok') {
                this.logs = data.logs || [];
                this.total = data.total || 0;
                this.pages = data.pages || 1;

                // Update model filter options
                const modelsSet = new Set(this.logs.map(log => log.model).filter(Boolean));
                if (modelsSet.size > this.models.length) {
                    this.models = Array.from(modelsSet).sort();
                }
            }
        } catch (error) {
            console.error('Failed to load request logs:', error);
            this.$store.global.showToast('Failed to load request logs', 'error');
        } finally {
            this.loading = false;
        }
    },

    applyFilters() {
        this.page = 1;
        this.loadLogs();
    },

    clearFilters() {
        this.filters = {
            api_key_id: '',
            model: '',
            status: '',
            from: '',
            to: '',
            search: ''
        };
        this.page = 1;
        this.loadLogs();
    },

    goToPage(pageNum) {
        if (pageNum < 1 || pageNum > this.pages) return;
        this.page = pageNum;
        this.loadLogs();
    },

    async viewLogDetail(log) {
        this.loadingDetail = true;
        this.showDetailDialog = true;

        try {
            const { response } = await window.utils.request(`/api/logs/requests/${log.id}`);
            const data = await response.json();

            if (data.status === 'ok') {
                this.selectedLog = data.log;
            } else {
                throw new Error(data.error || 'Failed to load log details');
            }
        } catch (error) {
            console.error('Failed to load log details:', error);
            this.$store.global.showToast('Failed to load log details', 'error');
            this.showDetailDialog = false;
        } finally {
            this.loadingDetail = false;
        }
    },

    closeDetailDialog() {
        this.showDetailDialog = false;
        this.selectedLog = null;
    },

    async deleteLog(log) {
        if (!confirm('Delete this request log? This cannot be undone.')) return;

        try {
            const { response } = await window.utils.request(`/api/logs/requests/${log.id}`, {
                method: 'DELETE'
            });

            const data = await response.json();
            if (data.status === 'ok') {
                this.$store.global.showToast('Log deleted', 'success');
                await this.loadLogs();
            }
        } catch (error) {
            console.error('Failed to delete log:', error);
            this.$store.global.showToast('Failed to delete log', 'error');
        }
    },

    async clearLogs() {
        const confirmMsg = this.filters.from || this.filters.to || this.filters.api_key_id
            ? 'Clear logs matching current filters?'
            : 'Clear ALL request logs? This cannot be undone!';

        if (!confirm(confirmMsg)) return;

        try {
            const body = {};
            if (this.filters.from) body.from = new Date(this.filters.from).getTime();
            if (this.filters.to) body.to = new Date(this.filters.to).getTime();
            if (this.filters.api_key_id) body.api_key_id = this.filters.api_key_id;

            const { response } = await window.utils.request('/api/logs/requests/clear', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await response.json();
            if (data.status === 'ok') {
                this.$store.global.showToast(`Cleared ${data.deleted} logs`, 'success');
                await this.loadLogs();
            }
        } catch (error) {
            console.error('Failed to clear logs:', error);
            this.$store.global.showToast('Failed to clear logs', 'error');
        }
    },

    async exportLogs(format = 'csv') {
        const params = new URLSearchParams({ format });

        if (this.filters.api_key_id) params.set('api_key_id', this.filters.api_key_id);
        if (this.filters.model) params.set('model', this.filters.model);
        if (this.filters.status) params.set('status', this.filters.status);
        if (this.filters.from) params.set('from', new Date(this.filters.from).getTime().toString());
        if (this.filters.to) params.set('to', new Date(this.filters.to).getTime().toString());
        if (this.filters.search) params.set('search', this.filters.search);

        window.location.href = `/api/logs/requests/export?${params}`;
    },

    formatDate(timestamp) {
        if (!timestamp) return '-';
        return new Date(timestamp).toLocaleString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    },

    formatDuration(ms) {
        if (!ms) return '-';
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(2)}s`;
    },

    formatTokens(input, output) {
        if (!input && !output) return '-';
        return `${input || 0} / ${output || 0}`;
    },

    getStatusBadgeClass(status) {
        switch (status) {
            case 'success': return 'badge-success';
            case 'error': return 'badge-error';
            case 'rate_limited': return 'badge-warning';
            default: return 'badge-ghost';
        }
    },

    formatJson(obj) {
        if (!obj) return '';
        try {
            return JSON.stringify(obj, null, 2);
        } catch {
            return String(obj);
        }
    }
});
