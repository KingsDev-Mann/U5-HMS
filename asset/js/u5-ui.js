/**
 * U5 HMS shared UI helpers.
 * Keeps notifications consistent across landing page and dashboards.
 */
(function() {
    function normalizeType(type) {
        if (type === 'danger') return 'error';
        if (type === 'primary') return 'info';
        return type || 'info';
    }

    window.U5UI = {
        notify(message, type = 'info', duration = 4200) {
            const cleanMessage = String(message || '').replace(/^[\s✅❌⚠️🚨💊💡🔒📢]+/, '').trim();
            if (window.U5Announcements && typeof U5Announcements.toast === 'function') {
                return U5Announcements.toast(cleanMessage || message, normalizeType(type), duration);
            }
            console.log(`[${type}] ${cleanMessage || message}`);
            return null;
        },

        success(message, duration) {
            return this.notify(message, 'success', duration);
        },

        error(message, duration) {
            return this.notify(message, 'error', duration);
        },

        warning(message, duration) {
            return this.notify(message, 'warning', duration);
        },

        routeForRole(role) {
            const routes = {
                admin: 'admin-dashboard.html',
                doctor: 'doctor-dashboard.html',
                patient: 'patient-dashboard.html',
                pharmacist: 'pharmacist-dashboard.html',
                lab_technician: 'lab-technician-dashboard.html',
                nurse: 'nurse-dashboard.html',
                receptionist: 'receptionist-dashboard.html',
                gopd: 'gopd-dashboard.html',
                accountant: 'accountant-dashboard.html'
            };
            return routes[role] || 'index.html';
        },

        redirectByRole(role, delay = 250) {
            const target = this.routeForRole(role);
            setTimeout(() => {
                window.location.href = target;
            }, delay);
        }
    };

    const nativeAlert = window.alert.bind(window);
    window.nativeAlert = nativeAlert;
    window.alert = function(message) {
        if (document.body && window.U5Announcements) {
            U5UI.notify(message, String(message).includes('denied') || String(message).includes('Invalid') ? 'error' : 'info');
            return;
        }
        nativeAlert(message);
    };
})();
