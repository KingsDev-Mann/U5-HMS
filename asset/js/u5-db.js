/**
 * U5 HMS - Database Operations Layer
 * Centralized CRUD operations for all modules
 */

const U5DB = {
    // Get data from localStorage
    getStore(key) {
        return JSON.parse(localStorage.getItem("u5_" + key)) || [];
    },

    // Save data to localStorage
    setStore(key, data) {
        localStorage.setItem("u5_" + key, JSON.stringify(data));
    },

    // Generate unique ID
    generateId(prefix = 'ID') {
        return `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    },

    samePerson(record, person) {
        if (!record || !person) return false;
        const clean = value => (value || '').toString().trim().toLowerCase();
        return (
            (person.id && (record.patientId === person.id || record.doctorId === person.id)) ||
            (person.email && (clean(record.patientEmail) === clean(person.email) || clean(record.doctorEmail) === clean(person.email))) ||
            (person.name && (clean(record.patientName) === clean(person.name) || clean(record.doctorName) === clean(person.name)))
        );
    },

    findDoctorByAny(identity) {
        const doctors = U5DB.getStore("doctors");
        const clean = value => (value || '').toString().trim().toLowerCase();
        return doctors.find(d =>
            d.id === identity ||
            clean(d.name) === clean(identity) ||
            clean(d.email) === clean(identity)
        );
    },

    findPatientByAny(identity) {
        const patients = U5DB.getStore("patients");
        const clean = value => (value || '').toString().trim().toLowerCase();
        return patients.find(p =>
            p.id === identity ||
            clean(p.name) === clean(identity) ||
            clean(p.email) === clean(identity)
        );
    },

    // ==================== PATIENTS ====================
    patients: {
        getAll() {
            return U5DB.getStore("patients");
        },
        getById(id) {
            return U5DB.getStore("patients").find(p => p.id === id);
        },
        create(patientData) {
            const patients = U5DB.getStore("patients");
            const newPatient = {
                id: U5DB.generateId(),
                ...patientData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            patients.push(newPatient);
            U5DB.setStore("patients", patients);
            U5DB.logActivity('patient_created', { patientId: newPatient.id });
            return newPatient;
        },
        update(id, updates) {
            let patients = U5DB.getStore("patients");
            patients = patients.map(p => 
                p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
            );
            U5DB.setStore("patients", patients);
            U5DB.logActivity('patient_updated', { patientId: id });
            return patients.find(p => p.id === id);
        },
        delete(id) {
            let patients = U5DB.getStore("patients").filter(p => p.id !== id);
            U5DB.setStore("patients", patients);
            U5DB.logActivity('patient_deleted', { patientId: id });
        },
        search(query) {
            const patients = U5DB.getStore("patients");
            const q = query.toLowerCase();
            return patients.filter(p => 
                p.name?.toLowerCase().includes(q) ||
                p.email?.toLowerCase().includes(q) ||
                p.phone?.includes(q) ||
                p.bloodGroup?.toLowerCase().includes(q)
            );
        }
    },

    // ==================== DOCTORS ====================
    doctors: {
        getAll() {
            return U5DB.getStore("doctors");
        },
        getActive() {
            return U5DB.getStore("doctors").filter(d => d.status === 'active');
        },
        getBySpecialty(specialty) {
            return U5DB.getStore("doctors").filter(d => d.specialization === specialty);
        },
        getById(id) {
            return U5DB.getStore("doctors").find(d => d.id === id);
        },
        create(doctorData) {
            const doctors = U5DB.getStore("doctors");
            const newDoctor = {
                id: U5DB.generateId(),
                ...doctorData,
                createdAt: new Date().toISOString()
            };
            doctors.push(newDoctor);
            U5DB.setStore("doctors", doctors);
            U5DB.logActivity('doctor_created', { doctorId: newDoctor.id });
            return newDoctor;
        },
        update(id, updates) {
            let doctors = U5DB.getStore("doctors");
            doctors = doctors.map(d => 
                d.id === id ? { ...d, ...updates } : d
            );
            U5DB.setStore("doctors", doctors);
            U5DB.logActivity('doctor_updated', { doctorId: id });
            return doctors.find(d => d.id === id);
        },
        delete(id) {
            let doctors = U5DB.getStore("doctors").filter(d => d.id !== id);
            U5DB.setStore("doctors", doctors);
            U5DB.logActivity('doctor_deleted', { doctorId: id });
        },
        updateAvailability(doctorId, availability) {
            const current = U5DB.doctors.getById(doctorId);
            if (!current) return null;
            const payload = {
                availabilityStatus: availability.status || current.availabilityStatus || 'available',
                availabilitySchedule: availability.schedule || current.availabilitySchedule || {},
                updatedAt: new Date().toISOString()
            };
            return U5DB.doctors.update(doctorId, payload);
        },
        getAvailability(doctorId) {
            const doctor = U5DB.doctors.getById(doctorId);
            return {
                status: doctor?.availabilityStatus || 'available',
                schedule: doctor?.availabilitySchedule || {}
            };
        },
        isAvailableOn(doctorId, rawDate) {
            const doctor = U5DB.doctors.getById(doctorId);
            if (!doctor) return false;
            if ((doctor.availabilityStatus || 'available').toLowerCase() !== 'available') return false;
            const schedule = doctor.availabilitySchedule || {};
            const date = new Date(rawDate);
            if (isNaN(date)) return true;
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const dayName = days[date.getDay()];
            const daySchedule = schedule[dayName];
            return daySchedule ? Boolean(daySchedule.enabled) : true;
        },
        getAvailableBySpecialty(specialty, rawDate) {
            return U5DB.doctors.getAll().filter(d =>
                d.specialization === specialty &&
                d.status === 'active' &&
                U5DB.doctors.isAvailableOn(d.id, rawDate)
            );
        }
    },
    payroll: {
        getAll() {
            const staff = U5DB.getStore("staff").map(s => ({
                id: s.id || s.empId,
                name: s.name,
                role: s.role,
                department: s.department,
                salary: Number(s.salary || 52000),
                type: 'staff'
            }));
            const doctors = U5DB.getStore("doctors").map(d => ({
                id: d.id,
                name: d.name,
                role: 'doctor',
                department: d.specialization || 'Doctor',
                salary: Number(d.salary || 120000),
                status: d.status || 'active',
                type: 'doctor'
            }));
            return [...staff, ...doctors];
        },
        getTotal() {
            return U5DB.payroll.getAll().reduce((sum, item) => sum + Number(item.salary || 0), 0);
        },
        getByRole(role) {
            return U5DB.payroll.getAll().filter(item => item.role === role);
        },
        getSummary() {
            const items = U5DB.payroll.getAll();
            const total = U5DB.payroll.getTotal();
            return {
                total,
                count: items.length,
                averageSalary: items.length ? Math.round(total / items.length) : 0
            };
        }
    },

    // ==================== APPOINTMENTS ====================
    appointments: {
        getAll() {
            return U5DB.getStore("appointments");
        },
        getToday() {
            const today = new Date().toISOString().split('T')[0];
            return U5DB.getStore("appointments").filter(a => a.date === today);
        },
        getByDoctor(doctorId) {
            const doctor = U5DB.findDoctorByAny(doctorId) || { id: doctorId, name: doctorId, email: doctorId };
            return U5DB.getStore("appointments").filter(a => U5DB.samePerson(a, {
                id: doctor.id,
                name: doctor.name,
                email: doctor.email
            }));
        },
        getByPatient(patientId) {
            const patient = U5DB.findPatientByAny(patientId) || { id: patientId, name: patientId, email: patientId };
            return U5DB.getStore("appointments").filter(a => U5DB.samePerson(a, {
                id: patient.id,
                name: patient.name,
                email: patient.email
            }));
        },
        getByStatus(status) {
            return U5DB.getStore("appointments").filter(a => a.status === status);
        },
        getPending() {
            return U5DB.getStore("appointments").filter(a => a.status === 'pending');
        },
        create(appointmentData) {
            const appointments = U5DB.getStore("appointments");
            
            // Check for conflicts
            const conflict = appointments.find(a => 
                a.doctorId === appointmentData.doctorId &&
                a.date === appointmentData.date &&
                a.time === appointmentData.time &&
                a.status !== 'cancelled'
            );
            
            if (conflict) {
                return { error: 'Time slot already booked', conflict };
            }
            
            const newAppointment = {
                id: U5DB.generateId(),
                ...appointmentData,
                status: 'pending',
                createdAt: new Date().toISOString()
            };
            appointments.push(newAppointment);
            U5DB.setStore("appointments", appointments);
            U5DB.logActivity('appointment_created', { appointmentId: newAppointment.id });
            return { success: true, appointment: newAppointment };
        },
        updateStatus(id, status, reason = '') {
            let appointments = U5DB.getStore("appointments");
            appointments = appointments.map(a => 
                a.id === id ? { ...a, status, updatedAt: new Date().toISOString(), statusReason: reason } : a
            );
            U5DB.setStore("appointments", appointments);
            U5DB.logActivity('appointment_' + status, { appointmentId: id, reason });
            const updated = appointments.find(a => a.id === id);
            if (updated && status === 'completed') {
                U5DB.billing.ensureAppointmentInvoice(updated);
            }
            return updated;
        },
        delete(id) {
            let appointments = U5DB.getStore("appointments").filter(a => a.id !== id);
            U5DB.setStore("appointments", appointments);
            U5DB.logActivity('appointment_deleted', { appointmentId: id });
        }
    },

    // ==================== PRESCRIPTIONS ====================
    prescriptions: {
        getAll() {
            return U5DB.getStore("prescriptions");
        },
        getByPatient(patientId) {
            const patient = U5DB.findPatientByAny(patientId) || { id: patientId, name: patientId, email: patientId };
            return U5DB.getStore("prescriptions").filter(p => U5DB.samePerson(p, {
                id: patient.id,
                name: patient.name,
                email: patient.email
            }));
        },
        getByDoctor(doctorId) {
            const doctor = U5DB.findDoctorByAny(doctorId) || { id: doctorId, name: doctorId, email: doctorId };
            return U5DB.getStore("prescriptions").filter(p => U5DB.samePerson(p, {
                id: doctor.id,
                name: doctor.name,
                email: doctor.email
            }));
        },
        create(prescriptionData) {
            const prescriptions = U5DB.getStore("prescriptions");
            const newPrescription = {
                id: U5DB.generateId(),
                ...prescriptionData,
                pharmacyStatus: 'pending',
                status: 'active',
                prescribedAt: new Date().toISOString()
            };
            prescriptions.push(newPrescription);
            U5DB.setStore("prescriptions", prescriptions);
            U5DB.logActivity('prescription_created', { prescriptionId: newPrescription.id });
            return newPrescription;
        },
        dispense(id, pharmacistId) {
            let prescriptions = U5DB.getStore("prescriptions");
            prescriptions = prescriptions.map(p => 
                p.id === id ? { ...p, status: 'dispensed', pharmacyStatus: 'dispensed', dispensedAt: new Date().toISOString(), dispensedBy: pharmacistId } : p
            );
            U5DB.setStore("prescriptions", prescriptions);
            return prescriptions.find(p => p.id === id);
        }
    },

    // ==================== PHARMACY INVENTORY ====================
    pharmacy: {
        getAll() {
            return U5DB.getStore("pharmacy_inventory");
        },
        getLowStock() {
            return U5DB.getStore("pharmacy_inventory").filter(m => m.quantity <= m.minStock);
        },
        getExpiring(days = 30) {
            const future = new Date();
            future.setDate(future.getDate() + days);
            const futureStr = future.toISOString().split('T')[0];
            return U5DB.getStore("pharmacy_inventory").filter(m => m.expiryDate <= futureStr);
        },
        addMedicine(medicineData) {
            const inventory = U5DB.getStore("pharmacy_inventory");
            const existing = inventory.find(m => m.name === medicineData.name);
            
            if (existing) {
                existing.quantity += medicineData.quantity;
                U5DB.setStore("pharmacy_inventory", inventory);
                return existing;
            }
            
            const newMedicine = {
                id: U5DB.generateId(),
                ...medicineData,
                addedAt: new Date().toISOString()
            };
            inventory.push(newMedicine);
            U5DB.setStore("pharmacy_inventory", inventory);
            return newMedicine;
        },
        dispense(medicineId, quantity) {
            let inventory = U5DB.getStore("pharmacy_inventory");
            const medicine = inventory.find(m => m.id === medicineId);
            if (!medicine || medicine.quantity < quantity) {
                return { error: 'Insufficient stock' };
            }
            medicine.quantity -= quantity;
            U5DB.setStore("pharmacy_inventory", inventory);
            U5DB.logActivity('medicine_dispensed', { medicineId, quantity });
            return { success: true, remaining: medicine.quantity };
        }
    },

    // ==================== LABORATORY ====================
    laboratory: {
        getTests() {
            return U5DB.getStore("lab_tests");
        },
        getTestCatalog() {
            return U5DB.getStore("lab_test_catalog");
        },
        orderTest(testData) {
            const tests = U5DB.getStore("lab_tests");
            const catalog = U5DB.getStore("lab_test_catalog");
            const selected = catalog.find(t => t.name === testData.testName);
            const newTest = {
                id: U5DB.generateId(),
                ...testData,
                price: testData.price || selected?.price || 0,
                status: 'ordered',
                orderedAt: new Date().toISOString()
            };
            tests.push(newTest);
            U5DB.setStore("lab_tests", tests);
            if (newTest.price > 0) {
                U5DB.billing.createInvoice({
                    patientId: newTest.patientId,
                    patientName: newTest.patientName,
                    patientEmail: newTest.patientEmail,
                    sourceType: 'lab',
                    sourceId: newTest.id,
                    description: 'Laboratory: ' + newTest.testName,
                    totalAmount: newTest.price,
                    paidAmount: 0
                });
            }
            U5DB.logActivity('lab_test_ordered', { testId: newTest.id });
            return newTest;
        },
        addResult(testId, resultData) {
            let tests = U5DB.getStore("lab_tests");
            tests = tests.map(t => 
                t.id === testId ? { 
                    ...t, 
                    status: 'completed', 
                    result: resultData,
                    completedAt: new Date().toISOString() 
                } : t
            );
            U5DB.setStore("lab_tests", tests);
            U5DB.logActivity('lab_result_added', { testId });
            return tests.find(t => t.id === testId);
        },
        getPendingTests() {
            return U5DB.getStore("lab_tests").filter(t => t.status === 'ordered');
        },
        getPatientResults(patientId) {
            return U5DB.getStore("lab_tests").filter(t => t.patientId === patientId);
        }
    },

    // ==================== BILLING ====================
    billing: {
        getAll() {
            return U5DB.getStore("invoices");
        },
        getByPatient(patientId) {
            const patient = U5DB.findPatientByAny(patientId) || { id: patientId, name: patientId, email: patientId };
            return U5DB.getStore("invoices").filter(i => U5DB.samePerson(i, {
                id: patient.id,
                name: patient.name,
                email: patient.email
            }));
        },
        getByDoctor(doctorId) {
            const clean = v => (v || '').toString().trim().toLowerCase();
            const search = clean(doctorId);
            return U5DB.getStore("invoices").filter(i =>
                clean(i.doctorId) === search ||
                clean(i.doctorName) === search ||
                clean(i.doctorEmail) === search
            );
        },
        getPending() {
            return U5DB.getStore("invoices").filter(i => i.status === 'pending');
        },
        createInvoice(invoiceData) {
            const invoices = U5DB.getStore("invoices");
            if (invoiceData.sourceType && invoiceData.sourceId) {
                const existing = invoices.find(i => i.sourceType === invoiceData.sourceType && i.sourceId === invoiceData.sourceId);
                if (existing) return existing;
            }
            const newInvoice = {
                id: U5DB.generateId(),
                invoiceNumber: 'INV-' + Date.now(),
                ...invoiceData,
                status: 'pending',
                createdAt: new Date().toISOString()
            };
            invoices.push(newInvoice);
            U5DB.setStore("invoices", invoices);
            return newInvoice;
        },
        ensureAppointmentInvoice(appointment) {
            if (!appointment) return null;
            const doctor = U5DB.findDoctorByAny(appointment.doctorId || appointment.doctorName);
            const fee = Number(appointment.fee || doctor?.fee || 0);
            if (fee <= 0) return null;
            return U5DB.billing.createInvoice({
                patientId: appointment.patientId,
                patientName: appointment.patientName,
                patientEmail: appointment.patientEmail,
                doctorId: appointment.doctorId,
                doctorName: appointment.doctorName,
                doctorEmail: appointment.doctorEmail,
                sourceType: 'appointment',
                sourceId: appointment.id,
                description: 'Consultation with ' + (appointment.doctorName || 'Doctor'),
                totalAmount: fee,
                paidAmount: 0
            });
        },
        recordPayment(invoiceId, amount, method) {
            let invoices = U5DB.getStore("invoices");
            invoices = invoices.map(i => {
                if (i.id === invoiceId) {
                    i.paidAmount = (i.paidAmount || 0) + amount;
                    i.status = i.paidAmount >= i.totalAmount ? 'paid' : 'partial';
                    i.paymentMethod = method;
                    i.paidAt = new Date().toISOString();
                }
                return i;
            });
            U5DB.setStore("invoices", invoices);
            return invoices.find(i => i.id === invoiceId);
        }
    },

    financial: {
        getAll() {
            return U5DB.getStore("financials");
        },
        getByPerson(personId) {
            const clean = v => (v || '').toString().trim().toLowerCase();
            const search = clean(personId);
            return U5DB.financial.getAll().filter(tx =>
                clean(tx.recipientId) === search ||
                clean(tx.recipientName) === search ||
                clean(tx.recipientEmail) === search
            );
        },
        getByType(type) {
            return U5DB.financial.getAll().filter(tx => tx.type === type);
        },
        createTransaction(data) {
            const finances = U5DB.getStore("financials");
            const now = new Date().toISOString();
            const transaction = {
                id: U5DB.generateId(),
                type: data.type || 'disbursement',
                category: data.category || 'general',
                description: data.description || '',
                amount: Number(data.amount || 0),
                recipientId: data.recipientId || '',
                recipientName: data.recipientName || '',
                recipientEmail: data.recipientEmail || '',
                recipientBank: data.recipientBank || '',
                recipientAccount: data.recipientAccount || '',
                note: data.note || '',
                source: data.source || '',
                status: data.status || 'pending',
                department: data.department || '',
                createdAt: now,
                updatedAt: now,
                paidAt: data.paidAt || null,
                year: new Date(now).getFullYear()
            };
            finances.push(transaction);
            U5DB.setStore("financials", finances);
            U5DB.logActivity('financial_transaction_created', { transactionId: transaction.id });
            return transaction;
        },
        updateTransaction(id, updates) {
            let finances = U5DB.getStore("financials");
            finances = finances.map(tx => tx.id === id ? { ...tx, ...updates, updatedAt: new Date().toISOString() } : tx);
            U5DB.setStore("financials", finances);
            return finances.find(tx => tx.id === id);
        },
        deleteTransaction(id) {
            let finances = U5DB.getStore("financials").filter(tx => tx.id !== id);
            U5DB.setStore("financials", finances);
        },
        getSummary() {
            const finances = U5DB.financial.getAll();
            const summary = {
                totalIncome: 0,
                totalDisbursements: 0,
                totalTaxes: 0,
                totalPayoffs: 0,
                net: 0,
                count: finances.length
            };
            finances.forEach(tx => {
                const amount = Number(tx.amount || 0);
                if (tx.type === 'income') summary.totalIncome += amount;
                if (tx.type === 'disbursement') summary.totalDisbursements += amount;
                if (tx.type === 'tax') summary.totalTaxes += amount;
                if (tx.type === 'payoff') summary.totalPayoffs += amount;
            });
            summary.net = summary.totalIncome - summary.totalDisbursements - summary.totalTaxes - summary.totalPayoffs;
            return summary;
        },
        getAnnualSummary(year = new Date().getFullYear()) {
            const finances = U5DB.financial.getAll().filter(tx => Number(tx.year) === Number(year));
            const summary = {
                year,
                totalIncome: 0,
                totalDisbursements: 0,
                totalTaxes: 0,
                totalPayoffs: 0,
                net: 0,
                count: finances.length
            };
            finances.forEach(tx => {
                const amount = Number(tx.amount || 0);
                if (tx.type === 'income') summary.totalIncome += amount;
                if (tx.type === 'disbursement') summary.totalDisbursements += amount;
                if (tx.type === 'tax') summary.totalTaxes += amount;
                if (tx.type === 'payoff') summary.totalPayoffs += amount;
            });
            summary.net = summary.totalIncome - summary.totalDisbursements - summary.totalTaxes - summary.totalPayoffs;
            return summary;
        }
    },

    discipline: {
        getAll() {
            return U5DB.getStore("discipline_actions");
        },
        getByPerson(personId) {
            const clean = v => (v || '').toString().trim().toLowerCase();
            const search = clean(personId);
            return U5DB.discipline.getAll().filter(item =>
                clean(item.personId) === search ||
                clean(item.personName) === search ||
                clean(item.personRole) === search
            );
        },
        createAction(data) {
            const actions = U5DB.getStore("discipline_actions");
            const now = new Date().toISOString();
            const action = {
                id: U5DB.generateId(),
                personId: data.personId || '',
                personName: data.personName || '',
                personRole: data.personRole || '',
                type: data.type || 'warning',
                severity: data.severity || 'medium',
                reason: data.reason || 'Policy violation',
                notes: data.notes || '',
                status: data.status || 'open',
                issuedBy: data.issuedBy || 'Admin',
                createdAt: now,
                updatedAt: now,
                resolvedAt: data.resolvedAt || null
            };
            actions.push(action);
            U5DB.setStore("discipline_actions", actions);
            U5DB.logActivity('discipline_action_created', { actionId: action.id });
            return action;
        },
        updateAction(id, updates) {
            let actions = U5DB.getStore("discipline_actions");
            actions = actions.map(item => item.id === id ? { ...item, ...updates, updatedAt: new Date().toISOString() } : item);
            U5DB.setStore("discipline_actions", actions);
            return actions.find(item => item.id === id);
        },
        deleteAction(id) {
            let actions = U5DB.getStore("discipline_actions").filter(item => item.id !== id);
            U5DB.setStore("discipline_actions", actions);
        },
        getDefaults() {
            return [
                { type: 'warning', label: 'Written Warning' },
                { type: 'suspension', label: 'Suspension' },
                { type: 'termination', label: 'Termination' },
                { type: 'performance', label: 'Performance Improvement Plan' }
            ];
        }
    },

    // ==================== STAFF/HR ====================
    staff: {
        getAll() {
            return JSON.parse(localStorage.getItem("u5_staff")) || [];
        },
        getByRole(role) {
            return this.getAll().filter(s => s.role === role);
        },
        addStaff(staffData) {
            const staff = this.getAll();
            const newStaff = {
                id: U5DB.generateId(),
                empId: 'EMP-' + Date.now().toString().slice(-6),
                ...staffData,
                password: btoa(staffData.password || 'staff123'),
                joinedAt: new Date().toISOString()
            };
            staff.push(newStaff);
            localStorage.setItem("u5_staff", JSON.stringify(staff));
            U5DB.logActivity('staff_added', { staffId: newStaff.id });
            return newStaff;
        },
        updateStaff(id, updates) {
            let staff = this.getAll();
            staff = staff.map(s => s.id === id ? { ...s, ...updates } : s);
            localStorage.setItem("u5_staff", JSON.stringify(staff));
            return staff.find(s => s.id === id);
        },
        deleteStaff(id) {
            let staff = this.getAll().filter(s => s.id !== id);
            localStorage.setItem("u5_staff", JSON.stringify(staff));
        }
    },

    // ==================== ACTIVITY LOGS ====================
    logActivity(action, metadata = {}) {
        const session = JSON.parse(localStorage.getItem("u5_session") || "{}");
        const logs = U5DB.getStore("activity_logs");
        logs.push({
            id: U5DB.generateId(),
            action,
            user: session.name || 'System',
            role: session.role || 'guest',
            metadata,
            timestamp: new Date().toISOString()
        });
        // Keep only last 500 logs
        if (logs.length > 500) logs.shift();
        U5DB.setStore("activity_logs", logs);
    },

    getActivityLogs(limit = 50) {
        return U5DB.getStore("activity_logs").slice(-limit).reverse();
    },

    // ==================== SEED DATA ====================
    seedAll() {
        const upsertMany = (key, items, uniqueField) => {
            const current = U5DB.getStore(key);
            items.forEach(item => {
                if (!current.find(existing => existing[uniqueField] === item[uniqueField])) {
                    current.push(item);
                }
            });
            U5DB.setStore(key, current);
        };

        // Seed specializations
        if (U5DB.getStore("specializations").length === 0) {
            const specs = [
                "Cardiology", "Dermatology", "Dentistry", "Ophthalmology",
                "Physiotherapy", "Neurology", "Urology", "Pediatrics",
                "ENT", "Orthopedics", "Psychiatry", "Gynecology",
                "Radiology", "Oncology", "Emergency Medicine"
            ].map((name, i) => ({ id: i + 1, name, description: name + " Department" }));
            U5DB.setStore("specializations", specs);
        }

        upsertMany("doctors", [
            { id: "DOC-001", name: "Dr. James Wilson", email: "james@u5hms.com", specialization: "Cardiology", license: "LIC-001", fee: 150, experience: 12, status: "active", salary: 155000, availabilityStatus: "available", bio: "Senior cardiologist with interventional care experience" },
            { id: "DOC-002", name: "Dr. Sarah Chen", email: "sarah@u5hms.com", specialization: "Dermatology", license: "LIC-002", fee: 120, experience: 8, status: "active", salary: 132000, availabilityStatus: "available", bio: "Dermatology and cosmetic skin specialist" },
            { id: "DOC-003", name: "Dr. Michael Brown", email: "michael@u5hms.com", specialization: "Neurology", license: "LIC-003", fee: 200, experience: 15, status: "active", salary: 172000, availabilityStatus: "available", bio: "Stroke and epilepsy consultant" },
            { id: "DOC-004", name: "Dr. Emily Davis", email: "emily@u5hms.com", specialization: "Pediatrics", license: "LIC-004", fee: 100, experience: 6, status: "active", salary: 118000, availabilityStatus: "available", bio: "Child health and immunization clinic lead" },
            { id: "DOC-005", name: "Dr. Aisha Bello", email: "aisha@u5hms.com", specialization: "Gynecology", license: "LIC-005", fee: 140, experience: 11, status: "active", salary: 140000, availabilityStatus: "available", bio: "Maternal health and fertility specialist" },
            { id: "DOC-006", name: "Dr. Tunde Okafor", email: "tunde@u5hms.com", specialization: "Orthopedics", license: "LIC-006", fee: 170, experience: 13, status: "active", salary: 148000, availabilityStatus: "available", bio: "Bone, joint, and trauma surgeon" },
            { id: "DOC-007", name: "Dr. Fatima Yusuf", email: "fatima@u5hms.com", specialization: "ENT", license: "LIC-007", fee: 115, experience: 7, status: "active", salary: 126000, availabilityStatus: "available", bio: "Ear, nose, throat, and allergy care" },
            { id: "DOC-008", name: "Dr. David Mensah", email: "david@u5hms.com", specialization: "Psychiatry", license: "LIC-008", fee: 160, experience: 9, status: "active", salary: 136000, availabilityStatus: "available", bio: "Mental health and addiction medicine" },
            { id: "DOC-009", name: "Dr. Helen Obi", email: "helen@u5hms.com", specialization: "Urology", license: "LIC-009", fee: 180, experience: 10, status: "active", salary: 150000, availabilityStatus: "available", bio: "Kidney, bladder, and male reproductive care" },
            { id: "DOC-010", name: "Dr. Robert Kim", email: "robert@u5hms.com", specialization: "Ophthalmology", license: "LIC-010", fee: 180, experience: 10, status: "inactive", salary: 144000, availabilityStatus: "unavailable", bio: "Eye surgery specialist" },
            { id: "DOC-011", name: "Dr. Priya Nair", email: "priya@u5hms.com", specialization: "Radiology", license: "LIC-011", fee: 165, experience: 11, status: "active", salary: 142000, availabilityStatus: "available", bio: "Radiology and imaging specialist" },
            { id: "DOC-012", name: "Dr. Omar Aziz", email: "omar@u5hms.com", specialization: "Oncology", license: "LIC-012", fee: 210, experience: 14, status: "active", salary: 162000, availabilityStatus: "available", bio: "Cancer care and treatment strategist" },
            { id: "DOC-013", name: "Dr. Mia Johnson", email: "mia@u5hms.com", specialization: "Emergency Medicine", license: "LIC-013", fee: 190, experience: 10, status: "active", salary: 158000, availabilityStatus: "available", bio: "Acute emergency and trauma physician" },
            { id: "DOC-014", name: "Dr. Carlos Vega", email: "carlos@u5hms.com", specialization: "Physiotherapy", license: "LIC-014", fee: 110, experience: 8, status: "active", salary: 125000, availabilityStatus: "available", bio: "Rehabilitation and physiotherapy expert" }
        ], "email");

        upsertMany("patients", [
            { id: "PAT-001", name: "John Doe", email: "patient@test.com", bloodGroup: "O+", phone: "555-0101", condition: "Hypertension", allergies: "Penicillin" },
            { id: "PAT-002", name: "Jane Smith", email: "jane@email.com", bloodGroup: "A+", phone: "555-0102", condition: "Type 2 Diabetes", allergies: "None" },
            { id: "PAT-003", name: "Robert Johnson", email: "robert@email.com", bloodGroup: "B+", phone: "555-0103", condition: "Migraine", allergies: "Sulfa drugs" },
            { id: "PAT-004", name: "Amina Musa", email: "amina@email.com", bloodGroup: "AB+", phone: "555-0104", condition: "Pregnancy follow-up", allergies: "None" },
            { id: "PAT-005", name: "Grace Okoro", email: "grace@email.com", bloodGroup: "O-", phone: "555-0105", condition: "Asthma", allergies: "Dust" },
            { id: "PAT-006", name: "Samuel Ade", email: "samuel@email.com", bloodGroup: "A-", phone: "555-0106", condition: "Fracture follow-up", allergies: "None" },
            { id: "PAT-007", name: "Maryam Ali", email: "maryam@email.com", bloodGroup: "B-", phone: "555-0107", condition: "Ear infection", allergies: "Ibuprofen" },
            { id: "PAT-008", name: "Peter Nnamdi", email: "peter@email.com", bloodGroup: "O+", phone: "555-0108", condition: "Anxiety disorder", allergies: "None" }
        ], "email");

        upsertMany("users", [
            { id: "PAT-001", name: "John Doe", email: "patient@test.com", password: btoa("patient123"), role: "patient", createdAt: new Date().toISOString() },
            { id: "PAT-002", name: "Jane Smith", email: "jane@email.com", password: btoa("patient123"), role: "patient", createdAt: new Date().toISOString() },
            { id: "PAT-004", name: "Amina Musa", email: "amina@email.com", password: btoa("patient123"), role: "patient", createdAt: new Date().toISOString() },
            { id: "DOC-001", name: "Dr. James Wilson", email: "james@u5hms.com", password: btoa("doctor123"), role: "doctor", specialization: "Cardiology", license: "LIC-001", createdAt: new Date().toISOString() },
            { id: "DOC-002", name: "Dr. Sarah Chen", email: "sarah@u5hms.com", password: btoa("doctor123"), role: "doctor", specialization: "Dermatology", license: "LIC-002", createdAt: new Date().toISOString() },
            { id: "DOC-003", name: "Dr. Michael Brown", email: "michael@u5hms.com", password: btoa("doctor123"), role: "doctor", specialization: "Neurology", license: "LIC-003", createdAt: new Date().toISOString() },
            { id: "DOC-004", name: "Dr. Emily Davis", email: "emily@u5hms.com", password: btoa("doctor123"), role: "doctor", specialization: "Pediatrics", license: "LIC-004", createdAt: new Date().toISOString() },
            { id: "DOC-005", name: "Dr. Aisha Bello", email: "aisha@u5hms.com", password: btoa("doctor123"), role: "doctor", specialization: "Gynecology", license: "LIC-005", createdAt: new Date().toISOString() },
            { id: "DOC-006", name: "Dr. Tunde Okafor", email: "tunde@u5hms.com", password: btoa("doctor123"), role: "doctor", specialization: "Orthopedics", license: "LIC-006", createdAt: new Date().toISOString() },
            { id: "DOC-007", name: "Dr. Fatima Yusuf", email: "fatima@u5hms.com", password: btoa("doctor123"), role: "doctor", specialization: "ENT", license: "LIC-007", createdAt: new Date().toISOString() },
            { id: "DOC-008", name: "Dr. David Mensah", email: "david@u5hms.com", password: btoa("doctor123"), role: "doctor", specialization: "Psychiatry", license: "LIC-008", createdAt: new Date().toISOString() },
            { id: "DOC-009", name: "Dr. Helen Obi", email: "helen@u5hms.com", password: btoa("doctor123"), role: "doctor", specialization: "Urology", license: "LIC-009", createdAt: new Date().toISOString() },
            { id: "DOC-010", name: "Dr. Robert Kim", email: "robert@u5hms.com", password: btoa("doctor123"), role: "doctor", specialization: "Ophthalmology", license: "LIC-010", createdAt: new Date().toISOString() },
            { id: "DOC-011", name: "Dr. Priya Nair", email: "priya@u5hms.com", password: btoa("doctor123"), role: "doctor", specialization: "Radiology", license: "LIC-011", createdAt: new Date().toISOString() },
            { id: "DOC-012", name: "Dr. Omar Aziz", email: "omar@u5hms.com", password: btoa("doctor123"), role: "doctor", specialization: "Oncology", license: "LIC-012", createdAt: new Date().toISOString() },
            { id: "DOC-013", name: "Dr. Mia Johnson", email: "mia@u5hms.com", password: btoa("doctor123"), role: "doctor", specialization: "Emergency Medicine", license: "LIC-013", createdAt: new Date().toISOString() },
            { id: "DOC-014", name: "Dr. Carlos Vega", email: "carlos@u5hms.com", password: btoa("doctor123"), role: "doctor", specialization: "Physiotherapy", license: "LIC-014", createdAt: new Date().toISOString() }
        ], "email");

        // Seed lab test catalog
        if (U5DB.getStore("lab_test_catalog").length === 0) {
            const tests = [
                { id: 1, name: "Complete Blood Count (CBC)", category: "Hematology", price: 50, turnaround: "24 hours" },
                { id: 2, name: "Lipid Panel", category: "Chemistry", price: 75, turnaround: "24 hours" },
                { id: 3, name: "Blood Glucose", category: "Chemistry", price: 25, turnaround: "2 hours" },
                { id: 4, name: "Urinalysis", category: "Urinalysis", price: 40, turnaround: "4 hours" },
                { id: 5, name: "Chest X-Ray", category: "Radiology", price: 150, turnaround: "1 hour" },
                { id: 6, name: "ECG", category: "Cardiology", price: 100, turnaround: "1 hour" },
                { id: 7, name: "MRI Scan", category: "Radiology", price: 500, turnaround: "48 hours" },
                { id: 8, name: "Thyroid Panel", category: "Endocrinology", price: 120, turnaround: "24 hours" }
            ];
            U5DB.setStore("lab_test_catalog", tests);
        }

        // Seed pharmacy inventory
        if (U5DB.getStore("pharmacy_inventory").length === 0) {
            const medicines = [
                { id: 1, name: "Paracetamol 500mg", category: "Analgesic", quantity: 500, minStock: 50, price: 5, expiryDate: "2027-12-31" },
                { id: 2, name: "Amoxicillin 250mg", category: "Antibiotic", quantity: 200, minStock: 30, price: 15, expiryDate: "2026-08-15" },
                { id: 3, name: "Omeprazole 20mg", category: "Gastro", quantity: 300, minStock: 40, price: 12, expiryDate: "2027-03-20" },
                { id: 4, name: "Metformin 500mg", category: "Diabetes", quantity: 150, minStock: 30, price: 10, expiryDate: "2026-11-30" },
                { id: 5, name: "Aspirin 75mg", category: "Cardiovascular", quantity: 80, minStock: 30, price: 8, expiryDate: "2026-06-15" },
                { id: 6, name: "Ibuprofen 400mg", category: "Anti-inflammatory", quantity: 400, minStock: 50, price: 7, expiryDate: "2027-09-01" },
                { id: 7, name: "Cetirizine 10mg", category: "Antihistamine", quantity: 25, minStock: 30, price: 6, expiryDate: "2026-05-10" },
                { id: 8, name: "Salbutamol Inhaler", category: "Respiratory", quantity: 60, minStock: 20, price: 25, expiryDate: "2027-01-15" }
            ];
            U5DB.setStore("pharmacy_inventory", medicines);
        }
        const staff = JSON.parse(localStorage.getItem("u5_staff")) || [];
        [
            { id: "ADMIN-001", name: "System Admin", empId: "ADMIN-001", password: btoa("admin123"), role: "admin", department: "IT", salary: 95000 },
            { id: "DOC-001", name: "Dr. James Wilson", empId: "DOC-001", password: btoa("doctor123"), role: "doctor", department: "Cardiology", email: "james@u5hms.com", salary: 155000 },
            { id: "PHARM-001", name: "Ada Pharmacy", empId: "PHARM-001", password: btoa("staff123"), role: "pharmacist", department: "Pharmacy", salary: 68000 },
            { id: "LAB-001", name: "Leo Diagnostics", empId: "LAB-001", password: btoa("staff123"), role: "lab_technician", department: "Laboratory", salary: 56000 },
            { id: "NUR-001", name: "Nurse Clara", empId: "NUR-001", password: btoa("staff123"), role: "nurse", department: "Ward", salary: 63000 },
            { id: "REC-001", name: "Rita Frontdesk", empId: "REC-001", password: btoa("staff123"), role: "receptionist", department: "Front Desk", salary: 49000 },
            { id: "GOPD-001", name: "GOPD Officer", empId: "GOPD-001", password: btoa("staff123"), role: "gopd", department: "GOPD", salary: 54000 },
            { id: "ACC-001", name: "Accountant Ben", empId: "ACC-001", password: btoa("staff123"), role: "accountant", department: "Accounts", salary: 72000 }
        ].forEach(item => {
            if (!staff.find(s => s.empId === item.empId)) staff.push(item);
        });
        localStorage.setItem("u5_staff", JSON.stringify(staff));


        console.log("âœ… U5 HMS Database Seeded Successfully");
    }
};

// Initialize and seed
U5DB.seedAll();

// Make available globally
window.U5DB = U5DB;

// ==================== PAYROLL STORE HELPERS ====================
U5DB.getPayrollStore = function() { return U5DB.getStore('payroll') || []; };
U5DB.setPayrollStore = function(data) { U5DB.setStore('payroll', data); };

U5DB.seedPayrollData = function() {
    if (U5DB.getPayrollStore().length > 0) return;
    const payroll = [
        {
            id: U5DB.generateId('PAY'), year: 2026, month: 'May',
            employeeId: 'DOC-001', name: 'Dr. James Wilson', role: 'doctor',
            grossPay: 320000, tax: 48000, otherDeductions: 16000, netPay: 256000,
            status: 'pending', paidOn: null,
            accountDetails: { bank: 'First Bank', accountNumber: '1234567890', payMethod: 'transfer' }
        },
        {
            id: U5DB.generateId('PAY'), year: 2026, month: 'May',
            employeeId: 'DOC-002', name: 'Dr. Sarah Chen', role: 'doctor',
            grossPay: 280000, tax: 42000, otherDeductions: 14000, netPay: 224000,
            status: 'paid', paidOn: '2026-05-15',
            accountDetails: { bank: 'GTBank', accountNumber: '0987654321', payMethod: 'transfer' }
        },
        {
            id: U5DB.generateId('PAY'), year: 2026, month: 'May',
            employeeId: 'PHARM-001', name: 'Olivia Bello', role: 'pharmacist',
            grossPay: 180000, tax: 27000, otherDeductions: 9000, netPay: 144000,
            status: 'pending', paidOn: null,
            accountDetails: { bank: 'Access Bank', accountNumber: '5678901234', payMethod: 'transfer' }
        }
    ];
    U5DB.setPayrollStore(payroll);
};

U5DB.addPayrollEntry = function(entry) {
    const payroll = U5DB.getPayrollStore();
    const newEntry = { id: U5DB.generateId('PAY'), status: 'pending', paidOn: null, ...entry };
    payroll.unshift(newEntry);
    U5DB.setPayrollStore(payroll);
    U5DB.logActivity('payroll_added', { employeeId: entry.employeeId });
    return newEntry;
};

U5DB.updatePayrollEntry = function(id, patch) {
    const payroll = U5DB.getPayrollStore().map(item =>
        item.id === id ? { ...item, ...patch } : item
    );
    U5DB.setPayrollStore(payroll);
    return payroll.find(item => item.id === id);
};

U5DB.deletePayrollEntry = function(id) {
    const payroll = U5DB.getPayrollStore().filter(item => item.id !== id);
    U5DB.setPayrollStore(payroll);
};

U5DB.markPayrollPaid = function(id, paid = true) {
    const payroll = U5DB.getPayrollStore().map(item => {
        if (item.id !== id) return item;
        return {
            ...item,
            status: paid ? 'paid' : 'pending',
            paidOn: paid ? new Date().toISOString().slice(0, 10) : null
        };
    });
    U5DB.setPayrollStore(payroll);
    U5DB.logActivity('payroll_marked_paid', { payrollId: id });
};

U5DB.getPayrollByEmployee = function(employeeId) {
    return U5DB.getPayrollStore().filter(item => item.employeeId === employeeId);
};

U5DB.getPayrollSummary = function() {
    const payroll = U5DB.getPayrollStore();
    return payroll.reduce((acc, item) => {
        acc.totalGross += item.grossPay || 0;
        acc.totalNet += item.netPay || 0;
        acc.totalTax += item.tax || 0;
        acc.totalDeductions += item.otherDeductions || 0;
        if (item.status === 'paid') acc.totalPaid += item.netPay || 0;
        else acc.totalOutstanding += item.netPay || 0;
        acc.count = payroll.length;
        acc.averageSalary = payroll.length > 0 ? Math.round(acc.totalGross / payroll.length) : 0;
        return acc;
    }, {
        totalGross: 0, totalNet: 0, totalTax: 0, totalDeductions: 0,
        totalPaid: 0, totalOutstanding: 0, count: 0, averageSalary: 0
    });
};

// ==================== DOCTOR CONTACT INFO ====================
U5DB.saveContactInfo = function(employeeId, contact) {
    const updateInList = (list) => list.map(item =>
        item.id === employeeId || item.empId === employeeId ?
        { ...item, contactDetails: { ...(item.contactDetails || {}), ...contact } } : item
    );
    if (U5DB.getStore('staff').length > 0) {
        U5DB.setStore('staff', updateInList(U5DB.getStore('staff')));
    }
    U5DB.setStore('doctors', updateInList(U5DB.getStore('doctors')));
};

U5DB.updateDoctorPhone = function(doctorId, phone) {
    const doctors = U5DB.getStore('doctors').map(doc =>
        doc.id === doctorId ? { ...doc, phone } : doc
    );
    U5DB.setStore('doctors', doctors);
};

// ==================== DISCIPLINE ====================
U5DB.addDisciplinaryAction = function(employeeId, { type = 'Warning', note = '' } = {}) {
    const actions = U5DB.getStore('discipline') || [];
    actions.unshift({
        id: U5DB.generateId('DISC'),
        employeeId,
        type,
        note,
        createdAt: new Date().toISOString(),
        createdBy: (JSON.parse(localStorage.getItem('u5_session') || '{}')).name || 'Admin'
    });
    U5DB.setStore('discipline', actions);
    U5DB.logActivity('discipline_added', { employeeId, type });
    return actions;
};

U5DB.getDisciplinaryActions = function(employeeId) {
    return (U5DB.getStore('discipline') || []).filter(action => action.employeeId === employeeId);
};

// ==================== STAFF MANAGEMENT ====================
U5DB.addStaffMember = function(staffData) {
    let staff = JSON.parse(localStorage.getItem('u5_staff') || '[]');
    const newStaff = {
        id: U5DB.generateId('STF'),
        empId: 'EMP-' + Date.now().toString().slice(-6),
        password: btoa(staffData.password || 'staff123'),
        ...staffData,
        createdAt: new Date().toISOString()
    };
    staff.push(newStaff);
    localStorage.setItem('u5_staff', JSON.stringify(staff));
    U5DB.logActivity('staff_added', { empId: newStaff.empId });
    return newStaff;
};

U5DB.updateStaffMember = function(id, updates) {
    let staff = JSON.parse(localStorage.getItem('u5_staff') || '[]');
    staff = staff.map(s => s.id === id || s.empId === id ? { ...s, ...updates } : s);
    localStorage.setItem('u5_staff', JSON.stringify(staff));
    return staff.find(s => s.id === id || s.empId === id);
};

U5DB.deleteStaffMember = function(id) {
    let staff = JSON.parse(localStorage.getItem('u5_staff') || '[]');
    staff = staff.filter(s => s.id !== id && s.empId !== id);
    localStorage.setItem('u5_staff', JSON.stringify(staff));
    U5DB.logActivity('staff_deleted', { staffId: id });
};

// ==================== SEED ALL DATA ====================
// Note: U5DB.seedAll() is defined earlier inside the object literal.

