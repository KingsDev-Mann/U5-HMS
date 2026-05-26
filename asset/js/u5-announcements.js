/**
 * U5 HMS - Announcements & Toast Notification System
 * Shared component - works across ALL dashboards
 * Include this ONE file and call ONE function
 */

const U5Announcements = {
    
    // ==================== TOAST CONTAINER ====================
    initToastContainer() {
        if (document.getElementById('u5-toast-container')) return;
        
        const container = document.createElement('div');
        container.id = 'u5-toast-container';
        container.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-width: 400px;
        `;
        document.body.appendChild(container);
    },

    // ==================== SHOW TOAST ====================
    toast(message, type = 'info', duration = 5000) {
        this.initToastContainer();
        
        const icons = {
            info: 'bi-info-circle-fill',
            success: 'bi-check-circle-fill',
            warning: 'bi-exclamation-triangle-fill',
            error: 'bi-x-circle-fill',
            emergency: 'bi-exclamation-octagon-fill',
            announcement: 'bi-megaphone-fill'
        };

        const colors = {
            info: { bg: 'rgba(59,130,246,0.95)', border: '#3b82f6', icon: '#bfdbfe' },
            success: { bg: 'rgba(16,185,129,0.95)', border: '#10b981', icon: '#a7f3d0' },
            warning: { bg: 'rgba(251,191,36,0.95)', border: '#fbbf24', icon: '#fef3c7' },
            error: { bg: 'rgba(248,113,113,0.95)', border: '#f87171', icon: '#fecaca' },
            emergency: { bg: 'rgba(220,38,38,0.95)', border: '#dc2626', icon: '#fca5a5' },
            announcement: { bg: 'rgba(139,92,246,0.95)', border: '#8b5cf6', icon: '#c4b5fd' }
        };

        const color = colors[type] || colors.info;
        
        const toast = document.createElement('div');
        toast.style.cssText = `
            background: ${color.bg};
            border: 1px solid ${color.border};
            border-radius: 16px;
            padding: 14px 18px;
            color: #fff;
            backdrop-filter: blur(20px);
            box-shadow: 0 15px 40px rgba(0,0,0,0.3);
            display: flex;
            align-items: flex-start;
            gap: 12px;
            animation: u5SlideIn 0.4s ease, u5SlideOut 0.4s ease ${duration - 400}ms forwards;
            cursor: pointer;
            min-width: 300px;
        `;
        
        toast.innerHTML = `
            <i class="bi ${icons[type]}" style="font-size: 1.2rem; color: ${color.icon}; margin-top: 2px;"></i>
            <div style="flex: 1;">
                <p style="margin: 0; font-weight: 500; font-size: 0.9rem;">${message}</p>
                <small style="opacity: 0.8; font-size: 0.75rem;">${new Date().toLocaleTimeString()}</small>
            </div>
            <i class="bi bi-x" style="cursor: pointer; opacity: 0.7; font-size: 1.1rem;" onclick="this.parentElement.remove()"></i>
        `;
        
        toast.onclick = function() { this.remove(); };
        
        document.getElementById('u5-toast-container').appendChild(toast);
        
        // Auto remove
        setTimeout(() => {
            if (toast.parentElement) toast.remove();
        }, duration);
        
        return toast;
    },

    // ==================== ANNOUNCEMENT SYSTEM ====================
    
    // Get all announcements
    getAll() {
        return JSON.parse(localStorage.getItem('u5_announcements') || '[]');
    },

    // Get announcements for current user role
    getForCurrentUser() {
        const session = JSON.parse(localStorage.getItem('u5_session') || '{}');
        const userRole = session.role || 'guest';
        const all = this.getAll();
        
        return all.filter(a => {
            // Check role access
            const targetRoles = a.targetRoles || ['all'];
            if (!targetRoles.includes('all') && !targetRoles.includes(userRole)) return false;
            
            // Check expiry
            if (a.expiresAt && new Date(a.expiresAt) < new Date()) return false;
            
            // Check if read
            const readBy = a.readBy || [];
            if (readBy.includes(session.name || session.email)) return false;
            
            return true;
        }).sort((a, b) => {
            // Emergency first, then by priority
            if (a.type === 'emergency') return -1;
            if (b.type === 'emergency') return 1;
            return (b.priority || 0) - (a.priority || 0);
        });
    },

    // Create announcement (Admin only)
    create(title, message, type = 'info', targetRoles = ['all'], priority = 0, expiresInHours = 24) {
        const announcements = this.getAll();
        const newAnnouncement = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
            title,
            message,
            type,
            targetRoles,
            priority,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + expiresInHours * 3600000).toISOString(),
            readBy: [],
            createdBy: (JSON.parse(localStorage.getItem('u5_session') || '{}')).name || 'System'
        };
        
        announcements.push(newAnnouncement);
        localStorage.setItem('u5_announcements', JSON.stringify(announcements));
        
        return newAnnouncement;
    },

    // Mark as read
    markRead(announcementId) {
        const session = JSON.parse(localStorage.getItem('u5_session') || '{}');
        const userName = session.name || session.email || 'anonymous';
        
        let announcements = this.getAll();
        announcements = announcements.map(a => {
            if (a.id === announcementId) {
                const readBy = a.readBy || [];
                if (!readBy.includes(userName)) {
                    readBy.push(userName);
                }
                return { ...a, readBy };
            }
            return a;
        });
        
        localStorage.setItem('u5_announcements', JSON.stringify(announcements));
    },

    // Delete announcement (Admin)
    delete(announcementId) {
        let announcements = this.getAll().filter(a => a.id !== announcementId);
        localStorage.setItem('u5_announcements', JSON.stringify(announcements));
    },

    // ==================== RENDER ANNOUNCEMENT BAR ====================
    
    renderBar(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const announcements = this.getForCurrentUser();
        
        if (announcements.length === 0) {
            container.style.display = 'none';
            return;
        }
        
        container.style.display = 'block';
        
        // Show toast for each announcement
        announcements.forEach(a => {
            const toastType = a.type === 'emergency' ? 'emergency' : 'announcement';
            this.toast(`📢 ${a.title}: ${a.message}`, toastType, 8000);
        });
        
        // Render bar
        const topAnnouncement = announcements[0];
        const bgColors = {
            info: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.05))',
            warning: 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(251,191,36,0.05))',
            emergency: 'linear-gradient(135deg, rgba(220,38,38,0.2), rgba(220,38,38,0.08))',
            success: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.05))',
            announcement: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(139,92,246,0.05))'
        };
        
        const borderColors = {
            info: 'rgba(59,130,246,0.4)',
            warning: 'rgba(251,191,36,0.4)',
            emergency: 'rgba(220,38,38,0.5)',
            success: 'rgba(16,185,129,0.4)',
            announcement: 'rgba(139,92,246,0.4)'
        };
        
        const icons = {
            info: 'bi-info-circle-fill',
            warning: 'bi-exclamation-triangle-fill',
            emergency: 'bi-exclamation-octagon-fill',
            success: 'bi-check-circle-fill',
            announcement: 'bi-megaphone-fill'
        };
        
        container.innerHTML = `
            <div style="
                background: ${bgColors[topAnnouncement.type] || bgColors.info};
                border: 1px solid ${borderColors[topAnnouncement.type] || borderColors.info};
                border-radius: 16px;
                padding: 12px 20px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                backdrop-filter: blur(12px);
                cursor: pointer;
            " onclick="U5Announcements.markRead('${topAnnouncement.id}'); this.parentElement.style.display='none';">
                <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
                    <i class="bi ${icons[topAnnouncement.type]}" style="font-size: 1.3rem; color: var(--accent);"></i>
                    <div>
                        <strong style="color: #fff; font-size: 0.9rem;">${topAnnouncement.title}</strong>
                        <span style="color: var(--muted); font-size: 0.82rem; margin-left: 8px;">${topAnnouncement.message}</span>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    ${announcements.length > 1 ? `
                        <span style="background: rgba(255,255,255,0.15); padding: 3px 10px; border-radius: 12px; font-size: 0.75rem; color: #fff;">
                            +${announcements.length - 1} more
                        </span>
                    ` : ''}
                    <i class="bi bi-x" style="cursor: pointer; color: var(--muted); font-size: 1.1rem;" 
                       onclick="event.stopPropagation(); U5Announcements.markRead('${topAnnouncement.id}'); document.getElementById('${containerId}').style.display='none';"></i>
                </div>
            </div>
        `;
    },

    // ==================== ADMIN: MANAGE ANNOUNCEMENTS ====================
    
    renderManager(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const announcements = this.getAll().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        container.innerHTML = `
            <div class="main-card">
                <div class="card-header-custom">
                    <h5><i class="bi bi-megaphone-fill me-2"></i>System Announcements</h5>
                    <button class="btn btn-primary-custom btn-sm" onclick="U5Announcements.openCreateModal()">
                        <i class="bi bi-plus-lg"></i> New Announcement
                    </button>
                </div>
                
                ${announcements.length === 0 ? `
                    <div class="text-center py-4 text-muted">No announcements yet</div>
                ` : `
                    <div class="table-responsive">
                        <table class="table-custom">
                            <thead>
                                <tr><th>Title</th><th>Type</th><th>Target</th><th>Created</th><th>Expires</th><th>Actions</th></tr>
                            </thead>
                            <tbody>
                                ${announcements.map(a => `
                                    <tr>
                                        <td><strong>${a.title}</strong></td>
                                        <td><span class="badge-status bg-${a.type === 'emergency' ? 'declined' : a.type === 'warning' ? 'pending' : 'accepted'}">${a.type}</span></td>
                                        <td>${(a.targetRoles || ['all']).join(', ')}</td>
                                        <td>${new Date(a.createdAt).toLocaleDateString()}</td>
                                        <td>${new Date(a.expiresAt).toLocaleDateString()}</td>
                                        <td>
                                            <button class="btn btn-sm btn-outline-custom text-danger" onclick="U5Announcements.delete('${a.id}'); U5Announcements.renderManager('announcementManager');">
                                                <i class="bi bi-trash"></i>
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `}
            </div>
        `;
    },

    openCreateModal() {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7); z-index: 9999;
            display: flex; align-items: center; justify-content: center;
        `;
        modal.innerHTML = `
            <div style="background: rgba(8,20,15,0.97); border: 1px solid rgba(16,185,129,0.25); 
                 border-radius: 24px; padding: 30px; max-width: 500px; width: 90%; backdrop-filter: blur(30px);">
                <h5 class="text-white mb-3"><i class="bi bi-megaphone-fill me-2"></i>New Announcement</h5>
                
                <div class="mb-3">
                    <label class="form-label text-muted">Title</label>
                    <input type="text" class="form-control-custom" id="annTitle" placeholder="Announcement title">
                </div>
                <div class="mb-3">
                    <label class="form-label text-muted">Message</label>
                    <textarea class="form-control-custom" id="annMessage" rows="3" placeholder="Announcement message..."></textarea>
                </div>
                <div class="row g-3 mb-3">
                    <div class="col-md-6">
                        <label class="form-label text-muted">Type</label>
                        <select class="form-select-custom" id="annType">
                            <option value="info">Info</option>
                            <option value="warning">Warning</option>
                            <option value="emergency">Emergency</option>
                            <option value="success">Success</option>
                        </select>
                    </div>
                    <div class="col-md-6">
                        <label class="form-label text-muted">Target Roles</label>
                        <select class="form-select-custom" id="annRoles" multiple size="4">
                            <option value="all" selected>All</option>
                            <option value="admin">Admin</option>
                            <option value="doctor">Doctor</option>
                            <option value="patient">Patient</option>
                            <option value="nurse">Nurse</option>
                            <option value="receptionist">Receptionist</option>
                        </select>
                    </div>
                </div>
                <div class="d-flex gap-2 justify-content-end">
                    <button class="btn btn-secondary" onclick="this.closest('div').parentElement.remove()">Cancel</button>
                    <button class="btn btn-primary-custom" onclick="U5Announcements.createFromModal(this)">Publish</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.onclick = function(e) { if (e.target === modal) modal.remove(); };
    },

    createFromModal(btn) {
        const parent = btn.closest('div').parentElement;
        const title = parent.querySelector('#annTitle').value.trim();
        const message = parent.querySelector('#annMessage').value.trim();
        const type = parent.querySelector('#annType').value;
        const rolesSelect = parent.querySelector('#annRoles');
        const targetRoles = Array.from(rolesSelect.selectedOptions).map(o => o.value);
        
        if (!title || !message) {
            alert('Please fill in title and message!');
            return;
        }
        
        this.create(title, message, type, targetRoles, type === 'emergency' ? 10 : 5, 48);
        this.toast('✅ Announcement published!', 'success');
        
        parent.remove();
        
        // Refresh manager if exists
        if (document.getElementById('announcementManager')) {
            this.renderManager('announcementManager');
        }
    }
};

// ================= AUTO-INIT =================
(function() {
    // Add toast animation styles
    const style = document.createElement('style');
    style.textContent = `
        @keyframes u5SlideIn {
            from { transform: translateX(120%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes u5SlideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(120%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
    
    window.U5Announcements = U5Announcements;
    console.log('📢 U5 Announcements System Ready');
})();