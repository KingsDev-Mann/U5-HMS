/**
 * U5 HMS - AI Clinical Assistant
 * Monitors actions & provides intelligent medical context suggestions
 */

class U5AIAssistant {
    constructor(role, dashboardType) {
        this.role = role; // admin, doctor, patient, nurse, etc.
        this.dashboardType = dashboardType;
        this.actionHistory = [];
        this.sessionStart = new Date();
        this.contextData = {};
        this.suggestions = [];
        this.isProcessing = false;
    }

    // Track user actions for pattern recognition
    trackAction(action, metadata = {}) {
        this.actionHistory.push({
            action,
            metadata,
            timestamp: new Date(),
            page: window.location.pathname
        });
        
        // Keep only last 50 actions
        if (this.actionHistory.length > 50) {
            this.actionHistory.shift();
        }
        
        // Generate new suggestions based on action
        this.generateSuggestions(action, metadata);
    }

    // Load current context data from localStorage
    loadContext() {
        this.contextData = {
            doctors: JSON.parse(localStorage.getItem("u5_doctors") || "[]"),
            patients: JSON.parse(localStorage.getItem("u5_patients") || "[]"),
            appointments: JSON.parse(localStorage.getItem("u5_appointments") || "[]"),
            specializations: JSON.parse(localStorage.getItem("u5_specializations") || "[]"),
            pendingAppointments: [],
            todayAppointments: [],
            activeDoctors: [],
            urgentCases: []
        };

        const today = new Date().toISOString().split('T')[0];
        
        // Process context
        this.contextData.pendingAppointments = this.contextData.appointments.filter(a => a.status === 'pending');
        this.contextData.todayAppointments = this.contextData.appointments.filter(a => a.date === today);
        this.contextData.activeDoctors = this.contextData.doctors.filter(d => d.status === 'active');
        
        // Detect urgent patterns
        this.contextData.urgentCases = this.contextData.appointments.filter(a => 
            a.isEmergency || (a.status === 'pending' && a.date === today)
        );
    }

    // Main AI logic - generates suggestions based on context
    generateSuggestions(lastAction, metadata) {
        this.loadContext();
        this.suggestions = [];
        
        switch(this.role) {
            case 'admin':
                this.generateAdminSuggestions(lastAction, metadata);
                break;
            case 'doctor':
                this.generateDoctorSuggestions(lastAction, metadata);
                break;
            case 'patient':
                this.generatePatientSuggestions(lastAction, metadata);
                break;
            case 'nurse':
                this.generateNurseSuggestions(lastAction, metadata);
                break;
            case 'receptionist':
                this.generateReceptionistSuggestions(lastAction, metadata);
                break;
        }
        
        // Add anomaly detection
        this.detectAnomalies();
        
        return this.suggestions;
    }

    // ==================== ADMIN AI ====================
    generateAdminSuggestions(action, metadata) {
        const ctx = this.contextData;
        
        // System health monitoring
        const pendingCount = ctx.pendingAppointments.length;
        const todayCount = ctx.todayAppointments.length;
        const inactiveDocs = ctx.doctors.filter(d => d.status === 'inactive').length;
        const lowStockMeds = this.checkInventoryAlerts();

        // Appointment overload alert
        if (pendingCount > 10) {
            this.suggestions.push({
                type: 'alert',
                icon: 'bi-exclamation-triangle-fill',
                color: 'warning',
                title: 'Appointment Backlog',
                message: `${pendingCount} pending appointments need attention. Consider enabling auto-scheduling.`,
                action: { text: 'Review Pending', tab: 'appointments', filter: 'pending' }
            });
        }

        // Doctor availability optimization
        const overloadedDoctors = this.detectOverloadedDoctors();
        if (overloadedDoctors.length > 0) {
            this.suggestions.push({
                type: 'optimization',
                icon: 'bi-clipboard2-pulse',
                color: 'info',
                title: 'Workload Distribution',
                message: `${overloadedDoctors[0].name} has ${overloadedDoctors[0].count} appointments today. Consider redistributing.`,
                action: { text: 'View Schedule', tab: 'appointments' }
            });
        }

        // Recent action suggestions
        if (action === 'view_doctors') {
            this.suggestions.push({
                type: 'quick_action',
                icon: 'bi-person-plus-fill',
                color: 'primary',
                title: 'Add New Doctor',
                message: 'Quickly register a new physician to the system.',
                action: { text: 'Add Doctor', func: 'openDoctorModal' }
            });
        }

        if (action === 'view_appointments' && todayCount === 0) {
            this.suggestions.push({
                type: 'insight',
                icon: 'bi-calendar2-check',
                color: 'success',
                title: 'No Appointments Today',
                message: 'Perfect time for system maintenance or staff training.',
                action: null
            });
        }

        // Inactive doctors reminder
        if (inactiveDocs > 0) {
            this.suggestions.push({
                type: 'reminder',
                icon: 'bi-person-x-fill',
                color: 'secondary',
                title: 'Inactive Doctors',
                message: `${inactiveDocs} doctor(s) are marked inactive. Review their status.`,
                action: { text: 'Review Doctors', tab: 'doctors' }
            });
        }

        // Revenue insight
        const revenueTrend = this.calculateRevenueTrend();
        if (revenueTrend === 'down') {
            this.suggestions.push({
                type: 'alert',
                icon: 'bi-graph-down-arrow',
                color: 'danger',
                title: 'Revenue Decline Detected',
                message: 'Revenue has decreased. Consider promotional health packages.',
                action: { text: 'View Reports', tab: 'reports' }
            });
        }
    }

    // ==================== DOCTOR AI ====================
    generateDoctorSuggestions(action, metadata) {
        const ctx = this.contextData;
        const doctorName = this.getCurrentDoctorName();
        const myAppointments = ctx.appointments.filter(a => 
            a.doctorName === doctorName && a.date === new Date().toISOString().split('T')[0]
        );
        const pendingMyApps = myAppointments.filter(a => a.status === 'pending');

        // Urgent pending appointments
        if (pendingMyApps.length > 0) {
            this.suggestions.push({
                type: 'urgent',
                icon: 'bi-clock-fill',
                color: 'warning',
                title: 'Pending Appointments',
                message: `You have ${pendingMyApps.length} appointment(s) waiting for your response.`,
                action: { text: 'Review Now', tab: 'appointments' }
            });
        }

        // Patient follow-up reminder
        const needsFollowUp = this.detectFollowUpNeeded(doctorName);
        if (needsFollowUp.length > 0) {
            this.suggestions.push({
                type: 'clinical',
                icon: 'bi-heart-pulse-fill',
                color: 'info',
                title: 'Follow-up Reminder',
                message: `${needsFollowUp[0].patientName} may need a follow-up consultation.`,
                action: { text: 'View Patient', tab: 'patients' }
            });
        }

        // Availability status suggestion
        if (action === 'view_dashboard') {
            const hour = new Date().getHours();
            if (hour < 8 || hour > 18) {
                this.suggestions.push({
                    type: 'status',
                    icon: 'bi-moon-stars-fill',
                    color: 'secondary',
                    title: 'After Hours',
                    message: 'Update your availability status if you\'re off-duty.',
                    action: { text: 'Update Status', func: 'openAvailabilityModal' }
                });
            }
        }

        // Specialty-specific clinical suggestions
        const mySpec = this.getCurrentDoctorSpecialization();
        this.suggestions.push({
            type: 'clinical',
            icon: 'bi-journal-medical',
            color: 'primary',
            title: `${mySpec} Update`,
            message: `New treatment protocols available for ${mySpec}. Review latest guidelines.`,
            action: { text: 'View Resources', link: '#' }
        });

        // Today's schedule summary
        if (myAppointments.length > 0) {
            this.suggestions.push({
                type: 'summary',
                icon: 'bi-calendar2-week-fill',
                color: 'success',
                title: 'Today\'s Schedule',
                message: `${myAppointments.length} appointments | ${pendingMyApps.length} pending | ${myAppointments.filter(a => a.status === 'accepted').length} confirmed`,
                action: { text: 'View Schedule', tab: 'appointments' }
            });
        }
    }

    // ==================== PATIENT AI ====================
    generatePatientSuggestions(action, metadata) {
        const ctx = this.contextData;
        const patientName = this.getCurrentPatientName();
        const myAppointments = ctx.appointments.filter(a => a.patientName === patientName);
        const upcomingApps = myAppointments.filter(a => 
            a.status === 'accepted' && a.date >= new Date().toISOString().split('T')[0]
        );

        // Upcoming appointment reminders
        if (upcomingApps.length > 0) {
            const nextApp = upcomingApps[0];
            this.suggestions.push({
                type: 'reminder',
                icon: 'bi-calendar-heart-fill',
                color: 'primary',
                title: 'Upcoming Appointment',
                message: `${nextApp.date} at ${nextApp.time} with ${nextApp.doctorName}`,
                action: { text: 'View Details', tab: 'appointments' }
            });
        }

        // Book appointment suggestion
        if (action === 'view_dashboard' && upcomingApps.length === 0) {
            this.suggestions.push({
                type: 'quick_action',
                icon: 'bi-calendar-plus-fill',
                color: 'success',
                title: 'Book Appointment',
                message: 'Schedule your next check-up with a specialist.',
                action: { text: 'Book Now', tab: 'book_appointment' }
            });
        }

        // Health tips based on recent appointments
        const recentSpecs = [...new Set(myAppointments.map(a => a.specialization))];
        if (recentSpecs.length > 0) {
            this.suggestions.push({
                type: 'health_tip',
                icon: 'bi-clipboard2-heart-fill',
                color: 'info',
                title: 'Health Reminder',
                message: `Regular ${recentSpecs[0].toLowerCase()} check-ups are important for your health.`,
                action: null
            });
        }

        // Prescription reminders (simulated)
        this.suggestions.push({
            type: 'medication',
            icon: 'bi-capsule-pill',
            color: 'warning',
            title: 'Medication Reminder',
            message: 'Remember to take prescribed medications on time.',
            action: { text: 'View Prescriptions', tab: 'prescriptions' }
        });
    }

    // ==================== NURSE AI ====================
    generateNurseSuggestions(action, metadata) {
        const ctx = this.contextData;
        const todayPatients = ctx.todayAppointments.filter(a => a.status === 'accepted');

        this.suggestions.push({
            type: 'task',
            icon: 'bi-clipboard2-pulse-fill',
            color: 'primary',
            title: 'Patient Vitals',
            message: `${todayPatients.length} patients need vitals check today.`,
            action: { text: 'View Queue', tab: 'patients' }
        });
    }

    // ==================== RECEPTIONIST AI ====================
    generateReceptionistSuggestions(action, metadata) {
        const ctx = this.contextData;
        const waitingCheckins = ctx.todayAppointments.filter(a => a.status === 'accepted');

        if (waitingCheckins.length > 0) {
            this.suggestions.push({
                type: 'task',
                icon: 'bi-person-check-fill',
                color: 'warning',
                title: 'Patient Check-ins',
                message: `${waitingCheckins.length} patients waiting for check-in.`,
                action: { text: 'Process Check-ins', tab: 'appointments' }
            });
        }
    }

    // ==================== ANOMALY DETECTION ====================
    detectAnomalies() {
        const ctx = this.contextData;
        const today = new Date().toISOString().split('T')[0];

        // Detect unusual appointment patterns
        const todayApps = ctx.todayAppointments.length;
        const avgDaily = Math.round(ctx.appointments.length / Math.max(1, 
            (new Date() - new Date(ctx.appointments[0]?.date || today)) / (1000 * 60 * 60 * 24)
        ));

        if (todayApps > avgDaily * 1.5 && avgDaily > 0) {
            this.suggestions.unshift({
                type: 'anomaly',
                icon: 'bi-graph-up-arrow',
                color: 'warning',
                title: 'High Patient Volume',
                message: `Today's appointments (${todayApps}) are above average (${avgDaily}). Ensure adequate staffing.`,
                action: { text: 'View Schedule', tab: 'appointments' }
            });
        }

        // Detect no-show pattern
        const noShows = ctx.appointments.filter(a => a.status === 'no_show');
        if (noShows.length > 5) {
            this.suggestions.push({
                type: 'anomaly',
                icon: 'bi-person-x-fill',
                color: 'danger',
                title: 'High No-Show Rate',
                message: `${noShows.length} no-shows detected. Consider implementing reminder calls/SMS.`,
                action: { text: 'View Report', tab: 'reports' }
            });
        }
    }

    // ==================== HELPER METHODS ====================
    detectOverloadedDoctors() {
        const today = new Date().toISOString().split('T')[0];
        const doctorLoads = {};
        
        this.contextData.appointments
            .filter(a => a.date === today && a.status !== 'cancelled')
            .forEach(a => {
                doctorLoads[a.doctorName] = (doctorLoads[a.doctorName] || 0) + 1;
            });

        return Object.entries(doctorLoads)
            .filter(([_, count]) => count > 15)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
    }

    detectFollowUpNeeded(doctorName) {
        const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        return this.contextData.appointments.filter(a => 
            a.doctorName === doctorName && 
            a.status === 'completed' && 
            a.date < twoWeeksAgo
        ).slice(0, 3);
    }

    checkInventoryAlerts() {
        // Simulated - would connect to pharmacy data
        return [];
    }

    calculateRevenueTrend() {
        const completed = this.contextData.appointments.filter(a => a.status === 'completed');
        if (completed.length < 5) return 'stable';
        
        const recent = completed.slice(-5);
        const older = completed.slice(-10, -5);
        const recentAvg = recent.length;
        const olderAvg = older.length || 1;
        
        return recentAvg < olderAvg * 0.7 ? 'down' : 'stable';
    }

    getCurrentDoctorName() {
        const session = JSON.parse(localStorage.getItem("u5_session") || "{}");
        return session.name || "Doctor";
    }

    getCurrentPatientName() {
        const session = JSON.parse(localStorage.getItem("u5_session") || "{}");
        return session.name || "Patient";
    }

    getCurrentDoctorSpecialization() {
        const session = JSON.parse(localStorage.getItem("u5_session") || "{}");
        return session.specialization || session.department || "General Medicine";
    }

    // Get formatted suggestions for rendering
    getSuggestions() {
        return this.suggestions;
    }

    // Get quick stats
    getQuickStats() {
        this.loadContext();
        const ctx = this.contextData;
        return {
            pendingApps: ctx.pendingAppointments.length,
            todayApps: ctx.todayAppointments.length,
            activeDoctors: ctx.activeDoctors.length,
            totalPatients: ctx.patients.length,
            urgentCases: ctx.urgentCases.length
        };
    }
}

// Export for use in dashboards
if (typeof module !== 'undefined' && module.exports) {
    module.exports = U5AIAssistant;
}