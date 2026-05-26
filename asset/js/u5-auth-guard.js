/**
 * U5 HMS - Authentication Guard
 * Protects confidential patient data & payroll information
 * Redirects unauthorized users to registration modal
 */

const U5AuthGuard = {
    
    // Routes that require authentication
    protectedRoutes: {
        // Patient confidential data
        patient_records: { requiredRole: ['admin', 'doctor', 'nurse'], redirect: 'register' },
        patient_history: { requiredRole: ['admin', 'doctor'], redirect: 'register' },
        patient_vitals: { requiredRole: ['admin', 'doctor', 'nurse'], redirect: 'register' },
        patient_prescriptions: { requiredRole: ['admin', 'doctor', 'pharmacist'], redirect: 'register' },
        patient_lab_results: { requiredRole: ['admin', 'doctor', 'nurse', 'lab_technician'], redirect: 'register' },
        patient_diagnosis: { requiredRole: ['admin', 'doctor'], redirect: 'register' },
        
        // Staff & Payroll confidential data
        payroll: { requiredRole: ['admin'], redirect: 'register' },
        staff_salaries: { requiredRole: ['admin'], redirect: 'register' },
        staff_personal_info: { requiredRole: ['admin'], redirect: 'register' },
        staff_attendance: { requiredRole: ['admin', 'doctor'], redirect: 'register' },
        staff_performance: { requiredRole: ['admin'], redirect: 'register' },
        
        // Billing & Financial
        billing_details: { requiredRole: ['admin', 'receptionist'], redirect: 'register' },
        insurance_claims: { requiredRole: ['admin', 'receptionist'], redirect: 'register' },
        revenue_reports: { requiredRole: ['admin'], redirect: 'register' },
        
        // Pharmacy controlled substances
        pharmacy_inventory: { requiredRole: ['admin', 'pharmacist'], redirect: 'register' },
        controlled_substances: { requiredRole: ['admin', 'pharmacist'], redirect: 'register' },
        
        // System settings
        system_config: { requiredRole: ['admin'], redirect: 'register' },
        user_management: { requiredRole: ['admin'], redirect: 'register' },
        audit_logs: { requiredRole: ['admin'], redirect: 'register' }
    },
    
    // Check if current user can access a protected route
    canAccess(routeName) {
        const session = JSON.parse(localStorage.getItem("u5_session"));
        
        // No session at all
        if (!session) {
            this.redirectToRegister(routeName);
            return false;
        }
        
        // Check if route is protected
        const route = this.protectedRoutes[routeName];
        if (!route) {
            // Route not in protected list, allow access
            return true;
        }
        
        // Check if user has required role
        const userRole = session.role;
        if (!route.requiredRole.includes(userRole)) {
            this.redirectToRegister(routeName, userRole);
            return false;
        }
        
        // Access granted
        U5_ANALYTICS.trackEvent('protected_route_access', { 
            route: routeName, 
            role: userRole 
        });
        return true;
    },
    
    // Redirect to register modal
    redirectToRegister(routeName, currentRole = 'guest') {
        // Track the attempt
        if (window.U5_ANALYTICS) {
            U5_ANALYTICS.trackEvent('unauthorized_access_attempt', {
                route: routeName,
                currentRole: currentRole,
                timestamp: new Date().toISOString()
            });
        }
        
        // Store the intended destination
        localStorage.setItem("u5_intended_route", routeName);
        
        // Get route info for user-friendly message
        const routeInfo = this.protectedRoutes[routeName];
        const requiredRoles = routeInfo ? routeInfo.requiredRole.join(', ') : 'registered user';
        
        // Check if we're on landing page or dashboard
        const isLandingPage = window.location.pathname.includes('index.html') || 
                             window.location.pathname === '/' || 
                             window.location.pathname === '';
        
        if (isLandingPage) {
            // On landing page - show register modal directly
            this.showRegisterModal(routeName, requiredRoles);
        } else {
            // On dashboard - redirect to landing page with register intent
            localStorage.setItem("u5_show_register", "true");
            localStorage.setItem("u5_register_message", JSON.stringify({
                route: routeName,
                requiredRoles: requiredRoles
            }));
            window.location.href = "index.html#register";
        }
    },
    
    // Show register modal with context
    showRegisterModal(routeName, requiredRoles) {
        // Map route names to user-friendly descriptions
        const routeDescriptions = {
            patient_records: "Patient Medical Records",
            patient_history: "Patient Medical History",
            patient_vitals: "Patient Vitals Data",
            patient_prescriptions: "Patient Prescriptions",
            patient_lab_results: "Laboratory Results",
            patient_diagnosis: "Patient Diagnosis Information",
            payroll: "Staff Payroll Information",
            staff_salaries: "Staff Salary Details",
            staff_personal_info: "Staff Personal Information",
            staff_attendance: "Staff Attendance Records",
            staff_performance: "Staff Performance Reviews",
            billing_details: "Billing & Payment Details",
            insurance_claims: "Insurance Claims Data",
            revenue_reports: "Revenue & Financial Reports",
            pharmacy_inventory: "Pharmacy Inventory",
            controlled_substances: "Controlled Substances Log",
            system_config: "System Configuration",
            user_management: "User Management",
            audit_logs: "System Audit Logs"
        };
        
        const description = routeDescriptions[routeName] || "confidential information";
        
        // Show alert with context
        alert(`🔒 Protected Access\n\n"${description}" requires ${requiredRoles} privileges.\n\nPlease register or login to access this confidential data.`);
        
        // Show register modal
        setTimeout(() => {
            // Close any open modals first
            document.querySelectorAll('.modal').forEach(m => {
                const modalInstance = bootstrap.Modal.getInstance(m);
                if (modalInstance) modalInstance.hide();
            });
            
            // Remove backdrops
            document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
            document.body.classList.remove('modal-open');
            
            // Show register modal
            const registerModal = new bootstrap.Modal(document.getElementById("registerModal"));
            registerModal.show();
            
            // Pre-select appropriate role based on required roles
            const roleSelect = document.getElementById("regRole");
            if (roleSelect) {
                const reqRoles = requiredRoles.split(',')[0].trim();
                if (reqRoles === 'admin') {
                    roleSelect.value = 'doctor'; // Closest option available for registration
                } else if (['doctor', 'nurse', 'pharmacist', 'lab_technician'].includes(reqRoles)) {
                    roleSelect.value = 'doctor';
                } else {
                    roleSelect.value = 'patient';
                }
                roleSelect.dispatchEvent(new Event('change'));
            }
        }, 500);
    },
    
    // Check on page load if redirected from another page
    checkRedirectIntent() {
        const showRegister = localStorage.getItem("u5_show_register");
        const registerMessage = localStorage.getItem("u5_register_message");
        
        if (showRegister === "true" && registerMessage) {
            const messageData = JSON.parse(registerMessage);
            
            // Clear the flags
            localStorage.removeItem("u5_show_register");
            localStorage.removeItem("u5_register_message");
            
            // Show register modal
            setTimeout(() => {
                this.showRegisterModal(messageData.route, messageData.requiredRoles);
            }, 1000);
        }
    },
    
    // Wrap any action with auth check
    secureAction(routeName, actionFunction) {
        return function(...args) {
            if (U5AuthGuard.canAccess(routeName)) {
                return actionFunction.apply(this, args);
            }
            return false;
        };
    },
    
    // Get list of routes current user can access
    getAccessibleRoutes() {
        const session = JSON.parse(localStorage.getItem("u5_session"));
        const userRole = session ? session.role : 'guest';
        
        const accessible = [];
        for (const [route, config] of Object.entries(this.protectedRoutes)) {
            if (config.requiredRole.includes(userRole)) {
                accessible.push(route);
            }
        }
        return accessible;
    }
};

// ================= AUTO INITIALIZATION =================
(function() {
    // Check if user was redirected with register intent
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => U5AuthGuard.checkRedirectIntent());
    } else {
        U5AuthGuard.checkRedirectIntent();
    }
    
    // Make available globally
    window.U5AuthGuard = U5AuthGuard;
    
    console.log("🛡️ U5 Auth Guard Initialized");
    console.log("📋 Protected Routes:", Object.keys(U5AuthGuard.protectedRoutes).length);
})();