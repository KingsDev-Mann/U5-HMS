const U5StaffDashboard = {
    roles: {
        pharmacist: { label: 'Pharmacist', icon: 'bi-capsule-pill', accent: 'Pharmacy', queue: 'Prescriptions to dispense' },
        lab_technician: { label: 'Lab Technician', icon: 'bi-droplet-fill', accent: 'Laboratory', queue: 'Tests awaiting result' },
        nurse: { label: 'Nurse', icon: 'bi-clipboard2-pulse', accent: 'Ward', queue: 'Accepted appointments' },
        receptionist: { label: 'Receptionist', icon: 'bi-headset', accent: 'Front Desk', queue: 'Pending bookings' },
        gopd: { label: 'GOPD', icon: 'bi-hospital', accent: 'General OPD', queue: 'Walk-in triage' },
        accountant: { label: 'Accountant', icon: 'bi-receipt-cutoff', accent: 'Accounts', queue: 'Invoices to collect' }
    },

    init(role) {
        this.role = role;
        this.config = this.roles[role] || this.roles.receptionist;
        this.session = JSON.parse(localStorage.getItem('u5_session') || 'null');

        if (!this.session) {
            U5UI.error('Please login to access this dashboard.');
            setTimeout(() => window.location.href = 'index.html', 700);
            return;
        }

        if (this.session.role !== role && this.session.role !== 'admin') {
            U5UI.error('This dashboard is for ' + this.config.label + ' users only.');
            setTimeout(() => U5UI.redirectByRole(this.session.role), 700);
            return;
        }

        document.getElementById('roleTitle').textContent = this.config.label + ' Dashboard';
        document.getElementById('roleBadge').innerHTML = `<i class="bi ${this.config.icon}"></i>${this.config.accent}`;
        document.getElementById('staffName').textContent = this.session.name || this.config.label;
        document.getElementById('staffDept').textContent = this.session.department || this.config.accent;
        this.render();
    },

    render() {
        const appointments = U5DB.appointments.getAll();
        const prescriptions = U5DB.prescriptions.getAll();
        const labTests = U5DB.laboratory.getTests();
        const invoices = U5DB.billing.getAll();
        const patients = U5DB.patients.getAll();
        const inventory = U5DB.pharmacy.getAll();

        const metrics = {
            pharmacist: [
                ['Pending', prescriptions.filter(p => (p.pharmacyStatus || p.status) !== 'dispensed').length],
                ['Low stock', U5DB.pharmacy.getLowStock().length],
                ['Inventory', inventory.length]
            ],
            lab_technician: [
                ['Ordered', labTests.filter(t => t.status !== 'completed').length],
                ['Completed', labTests.filter(t => t.status === 'completed').length],
                ['Catalog', U5DB.laboratory.getTestCatalog().length]
            ],
            nurse: [
                ['Today', U5DB.appointments.getToday().length],
                ['Accepted', appointments.filter(a => a.status === 'accepted').length],
                ['Patients', patients.length]
            ],
            receptionist: [
                ['Pending', appointments.filter(a => a.status === 'pending').length],
                ['Today', U5DB.appointments.getToday().length],
                ['Patients', patients.length]
            ],
            gopd: [
                ['Walk-ins', appointments.filter(a => a.source === 'gopd').length],
                ['Emergency', appointments.filter(a => a.isEmergency && a.status !== 'completed').length],
                ['Waiting', appointments.filter(a => a.status === 'pending').length]
            ],
            accountant: [
                ['Pending', invoices.filter(i => i.status !== 'paid').length],
                ['Paid', invoices.filter(i => i.status === 'paid').length],
                ['Revenue', '$' + invoices.reduce((sum, i) => sum + Number(i.paidAmount || 0), 0)]
            ]
        }[this.role] || [];

        document.getElementById('metrics').innerHTML = metrics.map(m => `
            <div class="col-md-4">
                <div class="u5-panel">
                    <div class="small text-muted">${m[0]}</div>
                    <div class="u5-metric">${m[1]}</div>
                </div>
            </div>
        `).join('');

        document.getElementById('workspace').innerHTML = this.renderWorkspace();
    },

    renderWorkspace() {
        return `
            <div class="row g-4">
                <div class="col-xl-8">
                    ${this.renderMainPanel()}
                </div>
                <div class="col-xl-4">
                    ${this.renderSidebarPanel()}
                </div>
            </div>
        `;
    },

    renderMainPanel() {
        if (this.role === 'pharmacist') return this.renderPharmacy();
        if (this.role === 'lab_technician') return this.renderLab();
        if (this.role === 'accountant') return this.renderAccounts();
        if (this.role === 'receptionist') return this.renderReception();
        if (this.role === 'gopd') return this.renderGopd();
        return this.renderNurse();
    },

    renderSidebarPanel() {
        if (this.role === 'pharmacist') return this.renderPharmacySidebar();
        if (this.role === 'lab_technician') return this.renderLabSidebar();
        if (this.role === 'accountant') return this.renderAccountsSidebar();
        if (this.role === 'receptionist') return this.renderReceptionSidebar();
        if (this.role === 'gopd') return this.renderGopdSidebar();
        return this.renderNurseSidebar();
    },

    renderSidebarCard(title, items) {
        return `
            <div class="u5-panel mb-3">
                <h5>${title}</h5>
                ${items.map(item => `<div class="small text-muted mb-2">${item}</div>`).join('')}
            </div>
        `;
    },

    renderPharmacySidebar() {
        const lowStock = U5DB.pharmacy.getLowStock();
        return this.renderSidebarCard('Pharmacy Snapshot', [
            `Low stock medicines: <strong>${lowStock.length}</strong>`,
            lowStock.length ? `Needs reorder: ${lowStock.map(m => m.name).join(', ')}` : 'Inventory levels are healthy.',
            `Total products: <strong>${U5DB.pharmacy.getAll().length}</strong>`
        ]);
    },

    renderLabSidebar() {
        const pendingTests = U5DB.laboratory.getPendingTests();
        return this.renderSidebarCard('Lab Workbench', [
            `Pending tests: <strong>${pendingTests.length}</strong>`,
            `Catalog size: <strong>${U5DB.laboratory.getTestCatalog().length}</strong>`,
            `Recent completed results shown in the main queue.`
        ]);
    },

    renderAccountsSidebar() {
        const invoices = U5DB.billing.getAll();
        const pending = invoices.filter(i => i.status !== 'paid').length;
        const paid = invoices.filter(i => i.status === 'paid').length;
        const revenue = invoices.reduce((sum, i) => sum + Number(i.paidAmount || 0), 0);
        return this.renderSidebarCard('Finance Overview', [
            `Outstanding invoices: <strong>${pending}</strong>`,
            `Paid invoices: <strong>${paid}</strong>`,
            `Revenue collected: <strong>$${revenue}</strong>`
        ]);
    },

    renderReceptionSidebar() {
        const pending = U5DB.appointments.getPending().length;
        const today = U5DB.appointments.getToday().length;
        return this.renderSidebarCard('Front Desk Summary', [
            `Pending bookings: <strong>${pending}</strong>`,
            `Today appointments: <strong>${today}</strong>`,
            'Use the main queue to confirm patient visits.'
        ]);
    },

    renderGopdSidebar() {
        const walkIns = U5DB.appointments.getAll().filter(a => a.source === 'gopd').length;
        const active = U5DB.appointments.getAll().filter(a => a.source === 'gopd' && a.status !== 'completed').length;
        return this.renderSidebarCard('GOPD Triage', [
            `Walk-in visits: <strong>${walkIns}</strong>`,
            `Active triage cases: <strong>${active}</strong>`,
            'Capture patient complaints and move cases into the main queue.'
        ]);
    },

    renderNurseSidebar() {
        const accepted = U5DB.appointments.getAll().filter(a => a.status === 'accepted').length;
        const completed = U5DB.appointments.getAll().filter(a => a.status === 'completed').length;
        return this.renderSidebarCard('Ward Summary', [
            `Accepted visits: <strong>${accepted}</strong>`,
            `Completed rounds: <strong>${completed}</strong>`,
            'Track vitals and patient handovers from the main queue.'
        ]);
    },

    renderPharmacy() {
        const queue = U5DB.prescriptions.getAll().filter(p => (p.pharmacyStatus || p.status) !== 'dispensed');
        return this.table('Prescription Queue', ['Patient', 'Medicine', 'Dosage', 'Status', 'Action'], queue.map(p => [
            p.patientName, p.medicineName, p.dosage || 'As directed', p.pharmacyStatus || 'pending',
            `<button class="btn btn-sm btn-success" onclick="U5StaffDashboard.dispense('${p.id}')">Dispense</button>`
        ]));
    },

    renderLab() {
        const queue = U5DB.laboratory.getTests().filter(t => t.status !== 'completed');
        return this.table('Lab Workbench', ['Patient', 'Test', 'Doctor', 'Status', 'Action'], queue.map(t => [
            t.patientName, t.testName, t.doctorName || 'Doctor', t.status,
            `<button class="btn btn-sm btn-success" onclick="U5StaffDashboard.result('${t.id}')">Add Result</button>`
        ]));
    },

    renderAccounts() {
        const invoices = U5DB.billing.getAll().filter(i => i.status !== 'paid');
        return this.table('Billing Queue', ['Patient', 'Invoice', 'Description', 'Balance', 'Action'], invoices.map(i => {
            const balance = Math.max(0, Number(i.totalAmount || 0) - Number(i.paidAmount || 0));
            return [i.patientName, i.invoiceNumber, i.description, '$' + balance, `<button class="btn btn-sm btn-success" onclick="U5StaffDashboard.collect('${i.id}')">Collect</button>`];
        }));
    },

    renderReception() {
        const appointments = U5DB.appointments.getAll().filter(a => a.status === 'pending');
        return this.table('Booking Desk', ['Patient', 'Doctor', 'Date', 'Time', 'Action'], appointments.map(a => [
            a.patientName, a.doctorName, a.date, a.time,
            `<button class="btn btn-sm btn-success" onclick="U5StaffDashboard.status('${a.id}', 'accepted')">Confirm</button>`
        ]));
    },

    renderGopd() {
        const queue = U5DB.appointments.getAll()
            .filter(a => a.source === 'gopd')
            .sort((a, b) => new Date(a.createdAt || a.date) - new Date(b.createdAt || b.date));

        const waiting = queue.filter(a => a.triageStatus === 'waiting').length;
        const triaged = queue.filter(a => a.triageStatus === 'triaged').length;
        const escalated = queue.filter(a => a.triageStatus === 'escalated').length;
        const emergency = queue.filter(a => a.isEmergency).length;

        return `
            <div class="row g-4">
                <div class="col-xl-4">
                    <div class="u5-panel mb-4">
                        <h5>Register Walk-In</h5>
                        <div class="row g-3">
                            <div class="col-12"><input class="form-control" id="walkName" placeholder="Patient name"></div>
                            <div class="col-12"><input class="form-control" id="walkReason" placeholder="Complaint / illness"></div>
                            <div class="col-12">
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="walkEmergency">
                                    <label class="form-check-label text-muted" for="walkEmergency">Mark as emergency</label>
                                </div>
                            </div>
                            <div class="col-12"><button class="btn btn-success w-100" onclick="U5StaffDashboard.walkIn()">Create GOPD Visit</button></div>
                        </div>
                    </div>
                    ${this.renderSidebarCard('GOPD Triage Overview', [
                        `Waiting triage cases: <strong>${waiting}</strong>`,
                        `Triaged patients: <strong>${triaged}</strong>`,
                        `Escalated visits: <strong>${escalated}</strong>`,
                        `Emergencies: <strong>${emergency}</strong>`
                    ])}
                </div>
                <div class="col-xl-8">
                    ${this.table('Triage Queue', ['Patient', 'Complaint', 'Priority', 'Triage', 'Status', 'Action'], queue.map(a => [
                        a.patientName,
                        a.symptomsDescription || 'No complaint recorded',
                        a.isEmergency ? '<span class="badge-status bg-urgent">Urgent</span>' : '<span class="badge-status bg-waiting">Normal</span>',
                        a.triageStatus || 'waiting',
                        `<span class="badge-status ${a.status === 'accepted' ? 'bg-accepted' : a.status === 'completed' ? 'bg-triaged' : 'bg-waiting'}">${a.status}</span>`,
                        `${a.triageStatus === 'waiting' ? `<button class="btn btn-sm btn-outline-light me-2" onclick="U5StaffDashboard.triagePatient('${a.id}')">Triage</button><button class="btn btn-sm btn-success" onclick="U5StaffDashboard.escalatePatient('${a.id}')">Escalate</button>` : ''}` +
                        `${a.triageStatus === 'triaged' ? `<button class="btn btn-sm btn-success me-2" onclick="U5StaffDashboard.escalatePatient('${a.id}')">Escalate</button><button class="btn btn-sm btn-outline-light" onclick="U5StaffDashboard.completeGopdVisit('${a.id}')">Complete</button>` : ''}` +
                        `${a.triageStatus === 'escalated' ? `<button class="btn btn-sm btn-outline-light" onclick="U5StaffDashboard.completeGopdVisit('${a.id}')">Complete</button>` : ''}`
                    ]))}
                </div>
            </div>
        `;
    },

    renderNurse() {
        const appointments = U5DB.appointments.getAll().filter(a => ['accepted', 'completed'].includes(a.status));
        return this.table('Ward & Vitals Queue', ['Patient', 'Doctor', 'Date', 'Status', 'Action'], appointments.map(a => [
            a.patientName, a.doctorName, a.date, a.status,
            `<button class="btn btn-sm btn-outline-light" onclick="U5UI.success('Vitals noted for ${a.patientName}')">Vitals</button>`
        ]));
    },

    table(title, headers, rows) {
        return `
            <div class="u5-panel">
                <h5>${title}</h5>
                ${rows.length === 0 ? '<p class="text-muted mb-0">No pending work in this queue.</p>' : `
                    <div class="table-responsive">
                        <table class="table table-dark table-hover align-middle">
                            <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
                            <tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell || '--'}</td>`).join('')}</tr>`).join('')}</tbody>
                        </table>
                    </div>
                `}
            </div>
        `;
    },

    dispense(id) {
        U5DB.prescriptions.dispense(id, this.session?.empId || this.role);
        U5UI.success('Prescription dispensed.');
        this.render();
    },

    result(id) {
        const result = prompt('Enter lab result summary:');
        if (!result) return;
        U5DB.laboratory.addResult(id, result);
        U5UI.success('Lab result released.');
        this.render();
    },

    collect(id) {
        const invoice = U5DB.billing.getAll().find(i => i.id === id);
        if (!invoice) return;
        const balance = Math.max(0, Number(invoice.totalAmount || 0) - Number(invoice.paidAmount || 0));
        if (balance > 0) U5DB.billing.recordPayment(id, balance, this.session?.empId || 'accounts');
        U5UI.success('Payment collected.');
        this.render();
    },

    status(id, status) {
        U5DB.appointments.updateStatus(id, status);
        U5UI.success('Appointment status updated.');
        this.render();
    },

    walkIn() {
        const name = document.getElementById('walkName').value.trim();
        const reason = document.getElementById('walkReason').value.trim();
        const isEmergency = document.getElementById('walkEmergency')?.checked;
        if (!name || !reason) {
            U5UI.warning('Enter patient name and complaint.');
            return;
        }
        const today = new Date().toISOString().split('T')[0];
        U5DB.appointments.create({
            patientName: name,
            specialization: 'General Medicine',
            doctorName: 'GOPD Triage',
            date: today,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            symptomsDescription: reason,
            source: 'gopd',
            isEmergency: Boolean(isEmergency),
            triageStatus: 'waiting',
            status: 'pending'
        });
        U5UI.success('GOPD visit created.');
        this.render();
    },

    triagePatient(id) {
        const note = prompt('Enter triage note or vital summary:');
        if (note === null) return;
        const updated = U5DB.appointments.getAll().map(a => a.id === id ? {
            ...a,
            triageStatus: 'triaged',
            triageNote: note,
            updatedAt: new Date().toISOString()
        } : a);
        U5DB.setStore('appointments', updated);
        U5DB.logActivity('gopd_triaged', { appointmentId: id });
        U5UI.success('Patient triaged.');
        this.render();
    },

    escalatePatient(id) {
        const note = prompt('Enter escalation note / next steps (optional):');
        const updated = U5DB.appointments.getAll().map(a => a.id === id ? {
            ...a,
            status: 'accepted',
            triageStatus: 'escalated',
            triageNote: note || a.triageNote,
            doctorName: a.doctorName === 'GOPD Triage' ? 'General Physician' : a.doctorName,
            updatedAt: new Date().toISOString()
        } : a);
        U5DB.setStore('appointments', updated);
        U5DB.logActivity('gopd_escalated', { appointmentId: id });
        U5UI.success('GOPD visit escalated.');
        this.render();
    },

    completeGopdVisit(id) {
        const updated = U5DB.appointments.getAll().map(a => a.id === id ? {
            ...a,
            status: 'completed',
            triageStatus: 'completed',
            updatedAt: new Date().toISOString()
        } : a);
        U5DB.setStore('appointments', updated);
        U5DB.logActivity('gopd_completed', { appointmentId: id });
        U5UI.success('GOPD visit marked complete.');
        this.render();
    },

    logout() {
        localStorage.removeItem('u5_session');
        window.location.href = 'index.html';
    }
};
