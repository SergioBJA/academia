/**
 * Attendance System - Premium Frontend Refactor
 * Implements Provider Pattern for flexible data sources (Google Drive / OneDrive)
 */

class GoogleSheetsProvider {
    constructor(apiUrl) {
        this.apiUrl = apiUrl;
    }

    async getSheets() {
        const res = await fetch(`${this.apiUrl}?action=get_sheets&t=${Date.now()}`);
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Error al cargar cursos');
        }
        const data = await res.json();
        return data.sheets;
    }

    async getAllStudents() {
        const res = await fetch(`${this.apiUrl}?action=get_all_students&t=${Date.now()}`);
        if (!res.ok) throw new Error('Error en búsqueda global');
        const data = await res.json();
        return data.students;
    }

    async getAttendance(sheetName, date) {
        const res = await fetch(`${this.apiUrl}?sheetName=${encodeURIComponent(sheetName)}&date=${date}&t=${Date.now()}`);
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Error al cargar asistencia');
        }
        const data = await res.json();
        return data;
    }

    async saveAttendance(sheetName, date, attendances) {
        const res = await fetch(this.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sheetName, date, attendances })
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Error al guardar');
        }
        return await res.json();
    }

    async getSummary(sheetName) {
        const res = await fetch(`${this.apiUrl}?action=get_summary&sheetName=${encodeURIComponent(sheetName)}&t=${Date.now()}`);
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Error al calcular resumen');
        }
        return await res.json();
    }

    async bulkSaveSummary(sheetName, summaryData) {
        const res = await fetch(this.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'bulk_save_summary',
                sheetName,
                summaryData
            })
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Error al guardar cambios masivos');
        }
        return await res.json();
    }
}

/** AttendanceApp v6.0 - 2026-04-07 **/
console.log("AttendanceApp v6.0 loaded - Mon-Fri Logic Active");
class AttendanceApp {
    constructor(provider) {
        this.provider = provider;
        this.anulados = []; // NUEO: Lista de alumnos dados de baja
        this.highlights = {}; // NUEVO: Alumnos destacados en rojo
        this.summaryData = null;
        this.historicalMarks = {};
        this.dayOverrides = {}; // New: Manual labels for day columns
        this.isC1Course = false; // Detection for C1 levels
        this.whatsappTemplate = 'Hola {nombre}';
        this.horario = ''; // Horario del curso (I2)

        this.init();
    }

    init() {
        this.cacheElements();
        this.bindEvents();
        this.setupInitialState();
        this.loadHistoricalMarks();
    }

    cacheElements() {
        this.els = {
            dateSelector: document.getElementById('dateSelector'),
            courseSelector: document.getElementById('courseSelector'),
            studentsList: document.getElementById('studentsList'),
            errorDiv: document.getElementById('error'),
            saveBtn: document.getElementById('saveBtn'),
            tableContainer: document.getElementById('tableContainer'),
            summaryContainer: document.getElementById('summaryContainer'),
            summaryListContainer: document.getElementById('summaryListContainer'),
            globalSearch: document.getElementById('globalSearch'),
            searchResults: document.getElementById('searchResults'),
            loading: document.getElementById('loading'),
            syncTime: document.getElementById('syncTime'),
            googleStatus: document.getElementById('googleStatus'),
            professorContainer: document.getElementById('professorContainer'),
            professorName: document.getElementById('professorName'),
            courseNameContainer: document.getElementById('courseNameContainer'),
            courseNameDisplay: document.getElementById('courseNameDisplay'),
            prevCourseBtn: document.getElementById('prevCourseBtn'),
            nextCourseBtn: document.getElementById('nextCourseBtn'),
            prevCourseNavLabel: document.getElementById('prevCourseNavLabel'),
            nextCourseNavLabel: document.getElementById('nextCourseNavLabel')
        };
    }

    bindEvents() {
        this.els.dateSelector.addEventListener('change', () => this.handleDateChange());
        this.els.courseSelector.addEventListener('change', () => this.handleCourseChange());
        this.els.saveBtn.addEventListener('click', () => this.saveAttendance());
        this.els.globalSearch.addEventListener('input', (e) => this.handleGlobalSearch(e));

        window.switchTab = (tabId) => this.switchTab(tabId);

        document.addEventListener('click', (e) => {
            if (!this.els.globalSearch.contains(e.target) && !this.els.searchResults.contains(e.target)) {
                this.els.searchResults.classList.add('hidden');
            }
        });
    }

    setupInitialState() {
        const today = new Date().toISOString().split('T')[0];
        this.els.dateSelector.value = today;
        const token = localStorage.getItem('google_access_token');
        if (token && this.els.googleStatus) {
            this.els.googleStatus.classList.remove('hidden');
        }
        this.loadCourses();
    }

    showError(msg) {
        if (!msg) {
            this.els.errorDiv.classList.add('hidden');
            return;
        }
        this.els.errorDiv.innerHTML = `
            <div class="flex items-center gap-3">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <span>${msg}</span>
            </div>
        `;
        this.els.errorDiv.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    showLoading(show, type = 'main') {
        if (type !== 'main') return;
        const target = this.els.loading;
        const container = this.els.tableContainer;
        if (target) target.classList.toggle('hidden', !show);
        if (show && container) container.classList.add('hidden');
    }

    async loadCourses() {
        this.showLoading(true);
        this.showError(null);
        try {
            const sheets = await this.provider.getSheets();
            this.els.courseSelector.innerHTML = '<option value="">-- Selecciona un curso --</option>';
            sheets.forEach(sheet => {
                const opt = document.createElement('option');
                opt.value = opt.textContent = sheet;
                this.els.courseSelector.appendChild(opt);
            });
            this.els.courseSelector.disabled = false;
        } catch (err) {
            console.error('Core Error:', err);
            this.showError(`Error fatal: ${err.message}`);
        } finally {
            this.showLoading(false);
        }
    }

    async handleCourseChange() {
        const course = this.els.courseSelector.value;
        if (!course) {
            this.els.tableContainer.classList.add('hidden');
            this.els.summaryContainer.classList.add('hidden');
            return;
        }
        await this.loadAttendance();
        this.loadSummary();
    }

    handleDateChange() {
        if (this.els.courseSelector.value) {
            this.loadAttendance();
        }
    }

    async loadAttendance() {
        const course = this.els.courseSelector.value;
        const date = this.els.dateSelector.value;
        if (!course || !date) return;
        this.showLoading(true);
        this.showError(null);
        try {
            // Load Web Config for WhatsApp templates
            await this.loadWebConfig();

            const data = await this.provider.getAttendance(course, date);
            this.highlights = data.highlights || {}; // Sincronizar destacados
            this.currentStudents = (data.students || []).map(s => ({
                ...s,
                isHighlighted: !!this.highlights[s.name],
                statuses: s.status ? s.status.split(',').map(st => st.trim().toUpperCase()) : []
            }));
            this.anulados = data.anulados || []; // Sincronizar anulados
            if (data.professor) {
                this.els.professorName.textContent = data.professor;
                this.els.professorContainer.classList.remove('hidden');
            } else {
                this.els.professorContainer.classList.add('hidden');
            }
            if (data.courseName) {
                this.els.courseNameDisplay.textContent = data.courseName;
                this.els.courseNameContainer.classList.remove('hidden');
            } else {
                this.els.courseNameContainer.classList.add('hidden');
            }
            this.horario = data.horario || ''; // Capturar horario (I2)

            // Centralized C1 detection
            const searchStr = (course + " " + (data.courseName || "")).toUpperCase();
            this.isC1Course = searchStr.includes('C1');

            this.renderStudents();
            this.els.tableContainer.classList.remove('hidden');
            this.updateSyncTime();
            this.updateNavButtons();
        } catch (err) {
            this.showError(err.message);
        } finally {
            this.showLoading(false);
        }
    }

    normalizeStr(str) {
        if (!str) return '';
        return str.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    }

    async loadWebConfig() {
        try {
            const res = await fetch('/api?action=get_web_config');
            const data = await res.json();
            if (data.success && data.web_config && data.web_config.whatsapp_templates) {
                this.whatsappTemplate = data.web_config.whatsapp_templates.asistencias;
            }
        } catch (e) {
            console.error('Error loading web config:', e);
        }
    }

    renderStudents() {
        this.els.studentsList.innerHTML = '';
        if (this.currentStudents.length === 0) {
            this.els.studentsList.innerHTML = '<tr><td colspan="2" class="p-12 text-center text-slate-400 font-medium italic">No se encontraron alumnos.</td></tr>';
            return;
        }
        const sorted = [...this.currentStudents].sort((a, b) => {
            const isA = this.anulados.includes(a.name) || a.name.toUpperCase().includes('BAJA');
            const isB = this.anulados.includes(b.name) || b.name.toUpperCase().includes('BAJA');
            if (isA !== isB) return isA ? 1 : -1;
            return a.name.localeCompare(b.name);
        });

        const isC1 = this.isC1Course;

        const statusOptions = isC1 ? [
            { id: 'XX', label: 'Doble Asist.', active: 'bg-emerald-600 text-white shadow-lg shadow-emerald-200', inactive: 'bg-slate-50 text-emerald-600 hover:bg-emerald-50' },
            { id: 'FF', label: 'Doble Falta', active: 'bg-rose-600 text-white shadow-lg shadow-rose-200', inactive: 'bg-slate-50 text-rose-600 hover:bg-rose-50' },
            { id: 'O', label: 'Online', active: 'bg-sky-500 text-white shadow-lg shadow-sky-100', inactive: 'bg-slate-50 text-slate-400 hover:bg-sky-50 hover:text-sky-600' },
            { id: 'RC', label: 'Recup.', active: 'bg-indigo-500 text-white shadow-lg shadow-indigo-100', inactive: 'bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600' },
            { id: 'XF', label: 'Asist. y Falta', active: 'text-white shadow-lg shadow-orange-100 border-none', inactive: 'bg-slate-50 text-slate-400 hover:bg-orange-50 hover:text-orange-600' },
            { id: 'RA', label: 'Asist. y Recup.', active: 'bg-split-ra text-white shadow-lg shadow-indigo-100 border-none', inactive: 'bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600' },
            { id: 'T', label: 'Taller', active: 'bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-100', inactive: 'bg-slate-50 text-slate-400 hover:bg-fuchsia-50 hover:text-fuchsia-600' }
        ] : [
            { id: 'X', label: 'Presente', active: 'bg-emerald-500 text-white shadow-lg shadow-emerald-100', inactive: 'bg-slate-50 text-emerald-600 hover:bg-emerald-50' },
            { id: 'F', label: 'Falta', active: 'bg-rose-500 text-white shadow-lg shadow-rose-100', inactive: 'bg-slate-50 text-rose-600 hover:bg-rose-50' },
            { id: 'O', label: 'Online', active: 'bg-sky-500 text-white shadow-lg shadow-sky-100', inactive: 'bg-slate-50 text-slate-400 hover:bg-sky-50 hover:text-sky-600' },
            { id: 'RC', label: 'Recup.', active: 'bg-indigo-500 text-white shadow-lg shadow-indigo-100', inactive: 'bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600' },
            { id: 'RA', label: 'Asist. y Recup.', active: 'bg-split-ra text-white shadow-lg shadow-indigo-100 border-none', inactive: 'bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600' },
            { id: 'T', label: 'Taller', active: 'bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-100', inactive: 'bg-slate-50 text-slate-400 hover:bg-fuchsia-50 hover:text-fuchsia-600' }
        ];

        sorted.forEach(student => {
            const isBaja = this.anulados.includes(student.name) || student.name.toUpperCase().includes('BAJA');
            const originalIdx = this.currentStudents.findIndex(s => s.name === student.name);
            const currentStatus = student.statuses[0] || '';
            
            const wpText = (this.whatsappTemplate || 'Hola').replace(/{nombre}/g, student.name);
            let wpButton = student.phone ? `
                <a href="https://wa.me/${student.phone}?text=${encodeURIComponent(wpText)}" target="_blank" class="p-2 rounded-full bg-green-50 text-green-600 hover:bg-green-100 transition-colors ml-2">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 0C5.385 0 0 5.385 0 12.031c0 2.128.552 4.137 1.541 5.918L.023 24l6.236-1.492a11.97 11.97 0 005.772 1.488c6.643 0 12.031-5.385 12.031-12.031S18.675 0 12.031 0zm0 21.942a9.927 9.927 0 01-5.074-1.393l-.364-.216-3.772.903.916-3.666-.237-.377a9.928 9.928 0 01-1.428-5.163c0-5.513 4.444-9.957 9.959-9.957s9.957 4.444 9.957 9.957-4.444 9.957-9.957 9.957zm5.46-7.443c-.299-.15-1.771-.875-2.046-.975-.274-.1-.474-.15-.674.15-.2.3-.774.975-.949 1.175-.174.2-.349.225-.649.075-.3-.15-1.264-.466-2.408-1.487-.89-.794-1.49-1.774-1.664-2.074-.175-.3-.019-.462.131-.612.135-.135.299-.35.449-.525.15-.175.2-.3.3-.5.1-.2.05-.375-.025-.525-.075-.15-.674-1.625-.924-2.225-.241-.58-.485-.502-.674-.511-.174-.009-.374-.009-.574-.009s-.524.075-.799.375c-.274.3-1.049 1.025-1.049 2.5s1.074 2.899 1.224 3.099c.15.2 2.112 3.224 5.112 4.524.714.309 1.272.493 1.708.631.716.227 1.368.195 1.884.118.577-.086 1.771-.724 2.021-1.424.25-.7.25-1.3.175-1.424-.075-.125-.275-.2-.575-.35z"/></svg>
                </a>` : '';

            const buttonsHtml = statusOptions.map(opt => {
                const isActive = currentStatus === opt.id;
                let style = '';
                if (isActive) {
                    if (opt.id === 'RA') style = 'background: linear-gradient(90deg, #10b981 50%, #6366f1 50%) !important;';
                    else if (opt.id === 'XF') style = 'background: linear-gradient(90deg, #10b981 50%, #f43f5e 50%) !important;';
                }
                const isFalta = opt.id === 'F' || opt.id === 'FF';
                return `<button onclick="app.toggleStatus(${originalIdx}, '${opt.id}')"
                            class="px-6 py-3 rounded-2xl text-[13px] font-black transition-all border border-transparent ${isActive ? opt.active : opt.inactive} ${isFalta ? 'mr-10' : ''}"
                            style="${style}">
                            ${opt.label}
                        </button>`;
            }).join('');

            const tr = document.createElement('tr');
            tr.className = `group hover:bg-slate-50 transition-all ${isBaja ? 'opacity-50' : ''}`;
            
            const currentCourse = this.els.courseSelector.value || '';

            tr.innerHTML = `
                <td class="px-8 py-8 border-r border-slate-50 w-1/3 min-w-[300px] max-w-[400px]">
                    <div class="flex items-center justify-between w-full">
                        <div class="flex items-center gap-4">
                            <!-- Cuadro de Anulación (Baja) -->
                            <button onclick="app.toggleBaja('${student.name.replace(/'/g, "\\'")}', event)" 
                                    class="w-9 h-9 rounded-xl flex items-center justify-center transition-all border-2 shrink-0 ${isBaja ? 'bg-brand-blue border-brand-blue text-white shadow-lg shadow-brand-blue/20' : 'bg-white border-slate-300 text-transparent hover:border-brand-blue hover:text-brand-blue shadow-sm'}"
                                    title="Alternar estado de Baja">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="4" d="M5 13l4 4L19 7"></path>
                                </svg>
                            </button>

                            <!-- Avatar Circle (Notas style) -->
                            <div class="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-lg font-black text-brand-blue group-hover:bg-brand-blue group-hover:text-white transition-all shrink-0 shadow-sm border border-slate-50">
                                ${student.name.charAt(0)}
                            </div>
                            
                            <div class="flex flex-col">
                                <span onclick="app.toggleHighlight(${originalIdx})" 
                                      class="font-black text-lg whitespace-nowrap cursor-pointer select-none transition-colors ${student.isHighlighted ? 'text-rose-600' : 'text-slate-800'}"
                                      title="Clic para destacar en rojo">
                                    ${student.name}
                                </span>
                                <span class="text-[11px] font-bold text-slate-400 uppercase tracking-tight">
                                    ${isBaja ? 'Alumno en Baja' : currentCourse}
                                </span>
                            </div>
                        </div>
                        ${wpButton}
                    </div>
                </td>
                <td class="px-8 py-8">
                    <div class="flex flex-wrap gap-2 justify-start">
                        ${buttonsHtml}
                    </div>
                </td>
            `;
            this.els.studentsList.appendChild(tr);
        });
    }

    async toggleBaja(studentName, evt) {
        if (evt) evt.stopPropagation();
        const isBaja = this.anulados.includes(studentName);
        const newStatus = !isBaja;
        if (newStatus) { if (!this.anulados.includes(studentName)) this.anulados.push(studentName); }
        else { this.anulados = this.anulados.filter(n => n !== studentName); }
        this.renderStudents();
        try {
            await fetch('/api', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'toggle_anulado', alumno_id: studentName, anulado: newStatus })
            });
        } catch (e) { console.error("Error al guardar baja:", e); }
    }

    toggleStatus(idx, status) {
        const student = this.currentStudents[idx];
        if (!student) return;
        if (student.statuses.includes(status) && status !== '') {
            student.statuses = [];
        } else {
            student.statuses = status ? [status] : [];
        }
        this.renderStudents();
    }

    toggleHighlight(idx) {
        const student = this.currentStudents[idx];
        if (student) {
            student.isHighlighted = !student.isHighlighted;
            this.highlights[student.name] = student.isHighlighted;
            this.renderStudents();

            // Sincronizar con el servidor de forma asíncrona (Background)
            fetch('/api', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'save_highlight',
                    studentName: student.name,
                    isHighlighted: student.isHighlighted
                })
            }).catch(e => console.error("Error al guardar destacado:", e));
        }
    }

    async saveAttendance() {
        const course = this.els.courseSelector.value;
        const rawDate = this.els.dateSelector.value;
        if (!rawDate) return;

        // Convert YYYY-MM-DD to DD/MM/YYYY for the JSON database
        const [y, m, d] = rawDate.split('-');
        const dateStr = `${d}/${m}/${y}`;

        const btn = this.els.saveBtn;
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<span class="animate-pulse">Sincronizando...</span>';
        btn.disabled = true;

        try {
            const attendances = this.currentStudents.map(s => ({ name: s.name, status: s.statuses.join(', ') }));

            // 1. SAVE TO JSON DATABASE ONLY (User explicitly requested not to touch Google Sheets)
            const marksToSync = {};
            attendances.forEach(a => {
                if (a.status) marksToSync[`${course}|${a.name}|${dateStr}`] = a.status;
            });

            const res = await fetch('/api', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'save_historical_marks',
                    marks: marksToSync
                })
            });
            const data = await res.json();
            const count = data.count || 0;

            // Update local historical marks to reflect the change immediately
            Object.assign(this.historicalMarks, marksToSync);

            // AUTOMATICALLY RE-RENDER THE HISTORY TABLE IF IT EXISTS
            if (this.summaryData) {
                this.renderHistoricalSummary(this.summaryData);
            }

            btn.innerHTML = `¡Guardado!`;

            btn.classList.replace('bg-[#163675]', 'bg-emerald-600');


            setTimeout(() => {
                btn.innerHTML = originalHtml;
                btn.classList.replace('bg-emerald-600', 'bg-[#163675]');
                btn.disabled = false;
                this.updateSyncTime();
            }, 2000);
        } catch (err) {
            this.showError(err.message);
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
    }

    async loadSummary() {
        const course = this.els.courseSelector.value;
        if (!course) return;
        try {
            const data = await this.provider.getSummary(course);
            this.summaryData = data || { summaryByMonth: {} };
            this.renderHistoricalSummary(this.summaryData);
            this.els.summaryContainer.classList.remove('hidden');
        } catch (err) { this.renderHistoricalSummary({ summaryByMonth: {} }); }
    }

    renderHistoricalSummary(apiData = { summaryByMonth: {} }) {
        const students = this.currentStudents;
        if (!students || students.length === 0) return;
        const course = this.els.courseSelector.value;
        const isGroupA = course.toUpperCase().endsWith('A');
        const isGroupB = course.toUpperCase().endsWith('B');
        const monthOrder = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
        const now = new Date();
        const container = this.els.summaryListContainer;
        const activeCount = students.filter(s => {
            const isBaja = this.anulados.includes(s.name) || s.name.toUpperCase().includes('BAJA');
            return !isBaja;
        }).length;

        container.innerHTML = `
            <div class="mb-10 pb-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div class="text-center sm:text-left flex-1">
                    <h2 class="text-2xl font-black text-slate-800 mb-1 tracking-tight">Historial de Clases de <span class="text-[#163675] dark:text-blue-400 uppercase">${this.els.courseNameDisplay.textContent || course}</span></h2>
                    <div class="flex flex-col sm:flex-row items-center gap-2">
                        <p class="text-slate-400 font-medium text-xs">Haz clic en los cuadros para gestionar asistencias.</p>
                        <span class="hidden sm:block text-slate-300">•</span>
                        <div class="inline-flex items-center gap-2.5 px-5 py-2 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20 shadow-sm transition-transform hover:scale-105">
                            <div class="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></div>
                            <span class="text-sm font-black uppercase tracking-widest">${activeCount} ALUMNOS ACTIVOS</span>
                        </div>
                    </div>
                </div>
                <div class="flex-1 text-center hidden md:block">
                    <div class="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-400/10 border border-indigo-100 dark:border-indigo-400/20 shadow-sm">
                        <svg class="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <span class="text-sm font-black text-indigo-700 dark:text-indigo-300 uppercase tracking-widest">${this.horario || 'SIN HORARIO'}</span>
                    </div>
                </div>
                <div class="flex-1 flex justify-end">
                    <button onclick="app.saveHistoricalMarks()" id="saveHistoryBtn" 
                        class="px-6 py-3 bg-orange-500 text-white rounded-xl font-black text-sm shadow-lg shadow-orange-100 hover:bg-orange-600 transition-all flex items-center gap-2 whitespace-nowrap">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg>
                        SINCRONIZAR HISTORIAL
                    </button>
                </div>
            </div>
        `;

        for (let i = 0; i < 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthIdx = d.getMonth(), year = d.getFullYear(), monthLabel = `${monthOrder[monthIdx]} ${year}`;
            const monthDates = [];
            const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
            for (let day = 1; day <= daysInMonth; day++) {
                const dateObj = new Date(year, monthIdx, day);
                const dow = dateObj.getDay();
                let isClassDay = isGroupA ? (dow === 1 || dow === 3) : (isGroupB ? (dow === 2 || dow === 4) : (dow >= 1 && dow <= 5));

                // Show all weekdays (Mon-Fri)
                if (dow >= 1 && dow <= 5) {
                    monthDates.push({
                        dateStr: `${String(day).padStart(2, '0')}/${String(monthIdx + 1).padStart(2, '0')}/${year}`,
                        isOfficial: isClassDay,
                        label: day,
                        dayNum: day
                    });
                }
            }
            // Explicitly sort by day number to ensure ascending order
            monthDates.sort((a, b) => a.dayNum - b.dayNum);

            if (monthDates.length === 0) continue;

            const sorted = [...students].sort((a, b) => {
                const isA = this.anulados.includes(a.name) || a.name.toUpperCase().includes('BAJA');
                const isB = this.anulados.includes(b.name) || b.name.toUpperCase().includes('BAJA');
                if (isA !== isB) return isA ? 1 : -1;
                return a.name.localeCompare(b.name);
            });
            const isCurrentMonth = (monthIdx === now.getMonth() && year === now.getFullYear());
            const isFirstMonth = (i === 0);
            const selector = this.els.courseSelector;
            const currentIndex = selector.selectedIndex;
            
            let navHtml = '';
            if (isFirstMonth) {
                const prevIndex = currentIndex - 1;
                const nextIndex = currentIndex + 1;
                const prevName = prevIndex > 0 ? selector.options[prevIndex].text : '';
                const nextName = nextIndex < selector.options.length ? selector.options[nextIndex].text : '';
                
                if (prevName) {
                    navHtml += `
                        <button onclick="app.changeCourseNav(-1)" 
                                class="absolute -left-4 lg:-left-24 top-1/2 -translate-y-1/2 w-16 lg:w-20 h-24 lg:h-32 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-md shadow-2xl flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 hover:text-brand-blue dark:hover:text-amber-400 hover:scale-105 active:scale-95 transition-all z-20 border border-white dark:border-white/10 group">
                            <svg class="w-6 h-6 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
                            <span class="text-[10px] font-black uppercase tracking-tighter text-center px-1 leading-tight">${prevName}</span>
                        </button>`;
                }
                if (nextName) {
                    navHtml += `
                        <button onclick="app.changeCourseNav(1)" 
                                class="absolute -right-4 lg:-right-24 top-1/2 -translate-y-1/2 w-16 lg:w-20 h-24 lg:h-32 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-md shadow-2xl flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 hover:text-brand-blue dark:hover:text-amber-400 hover:scale-105 active:scale-95 transition-all z-20 border border-white dark:border-white/10 group">
                            <svg class="w-6 h-6 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19l7-7-7-7"></path></svg>
                            <span class="text-[10px] font-black uppercase tracking-tighter text-center px-1 leading-tight">${nextName}</span>
                        </button>`;
                }
            }

            const monthEl = document.createElement('div');
            monthEl.className = 'mb-14 relative';
            monthEl.innerHTML = `
                ${navHtml}
                <div class="flex items-center gap-4 mb-6">
                    <div class="summary-month-badge ${isCurrentMonth ? 'current' : ''}">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                        </svg>
                        ${monthLabel}
                    </div>
                    <div class="h-px flex-1 bg-slate-200 dark:bg-white/10"></div>
                </div>
                <div class="overflow-x-auto bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-100 dark:border-white/10 shadow-lg">
                    <table class="min-w-full text-left">
                        <tr class="bg-slate-50 dark:bg-slate-800/50">
                            <th class="px-8 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 sticky left-0 bg-slate-50 dark:bg-slate-800/90 border-r dark:border-slate-700 min-w-[200px]">Alumno</th>
                            <th class="px-2 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 border-r dark:border-slate-700 text-center">PDF</th>
                            ${monthDates.map(dt => {
                const overrideKey = `${course}|${dt.dateStr}`;
                const displayLabel = this.dayOverrides[overrideKey] || dt.label;
                const isFestivo = /f/i.test(String(displayLabel));
                const isEdited = !!this.dayOverrides[overrideKey];
                return `<th 
                                    contenteditable="true"
                                    onkeydown="if(event.key==='Enter'){event.preventDefault(); app.saveDayOverride('${dt.dateStr}', this.innerText.trim()); this.blur();}"
                                    class="px-0.5 py-3 text-[10px] text-center min-w-[28px] border-l dark:border-slate-700 outline-none focus:bg-white focus:ring-1 focus:ring-indigo-300 transition-all ${isFestivo ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 font-black' : (isEdited ? 'text-sky-600 dark:text-sky-400 font-black' : (dt.isOfficial ? 'bg-blue-100/50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-300' : ''))}"
                                    title="Haz clic para editar el número del día. Enter para guardar.">
                                    ${displayLabel}
                                </th>`;
            }).join('')}
                        </tr>
                ${sorted.map(s => {
                const markKey = (courseCtx, student, date) => `${courseCtx}|${student}|${date}`;
                const cells = monthDates.map(dt => {
                    const overrideKey = `${course}|${dt.dateStr}`;
                    const displayLabel = this.dayOverrides[overrideKey] || dt.label;
                    const isFestivo = /f/i.test(String(displayLabel));
                    const val = this.historicalMarks[markKey(course, s.name, dt.dateStr)] || '';
                    let dotClass = 'bg-slate-50 border border-slate-100';
                    if (val === 'X') dotClass = 'bg-emerald-500 text-white border-emerald-500';
                    else if (val === 'F') dotClass = 'bg-rose-500 text-white border-rose-500';
                    else if (val === 'O') dotClass = 'bg-sky-500 text-white border-sky-500';
                    else if (val === 'XX') dotClass = 'bg-emerald-600 text-white border-emerald-600';
                    else if (val === 'FF') dotClass = 'bg-rose-600 text-white border-rose-600';
                    else if (val === 'RC') dotClass = 'bg-indigo-500 text-white border-indigo-500';
                    else if (val === 'RA') dotClass = 'bg-split-ra text-white border-indigo-500';
                    else if (val === 'XF') dotClass = 'text-white border-orange-500';
                    else if (val === 'T') dotClass = 'bg-fuchsia-600 text-white border-fuchsia-600';

                    let customStyle = '';
                    if (val === 'RA') customStyle = 'background: linear-gradient(90deg, #10b981 50%, #6366f1 50%) !important;';
                    if (val === 'XF') customStyle = 'background: linear-gradient(90deg, #10b981 50%, #f43f5e 50%) !important;';
                    let displayVal = val || (isFestivo ? 'FE' : '');

                    return `<td class="p-0.5 text-center border-l dark:border-slate-700 cursor-pointer relative group/cell ${isFestivo ? 'bg-rose-50/50 dark:bg-rose-900/10' : (dt.isOfficial ? 'bg-blue-50/30 dark:bg-blue-900/20' : 'dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-800')}" onclick="app.toggleHistoricalMark('${course.replace(/'/g, "\\'")}', '${s.name.replace(/'/g, "\\'")}', '${dt.dateStr}', '${monthLabel}')">
                                    <div class="w-6 h-6 rounded-md ${dotClass} mx-auto flex items-center justify-center text-[10px] font-black transition-all group-hover/cell:scale-110" style="${customStyle}">${displayVal}</div>
                                    ${val ? `<button onclick="app.clearHistoricalMark('${course.replace(/'/g, "\\'")}', '${s.name.replace(/'/g, "\\'")}', '${dt.dateStr}', event)" 
                                               class="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity shadow-sm z-10" title="Limpiar">
                                               <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"></path></svg>
                                             </button>` : ''}
                                </td>`;
                }).join('');
                const isBajaStudent = this.anulados.includes(s.name) || s.name.toUpperCase().includes('BAJA');
                return `<tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/80 transition-colors border-b dark:border-slate-700 last:border-0 ${isBajaStudent ? 'opacity-40 grayscale-[0.5]' : ''}">
                                <td class="px-8 py-4 text-base font-black sticky left-0 bg-white dark:bg-slate-900 border-r dark:border-slate-700 truncate max-w-[280px] ${this.highlights[s.name] ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}">${s.name}</td>
                                <td class="px-2 py-4 text-center border-r dark:border-slate-700"><button onclick="app.generateStudentReport('${s.name.replace(/'/g, "\\'")}', '${monthLabel}')" class="p-1 px-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-black hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors">PDF</button></td>
                                ${cells}
                            </tr>`;
            }).join('')}
                    </table>
                </div>
            `;
            container.appendChild(monthEl);
        }
    }

    toggleHistoricalMark(course, studentName, dateStr, monthLabel) {
        const key = `${course}|${studentName}|${dateStr}`;
        const isC1 = this.isC1Course;
        const cycle = isC1 
            ? ['', 'XX', 'FF', 'O', 'RC', 'XF', 'RA', 'T']
            : ['', 'X', 'F', 'O', 'RC', 'RA', 'T'];
        const current = this.historicalMarks[key] || '';
        let nextIndex = cycle.indexOf(current) + 1;
        if (nextIndex >= cycle.length || (nextIndex === 0 && current !== '')) nextIndex = 0;
        this.historicalMarks[key] = cycle[nextIndex];
        this.renderHistoricalSummary(this.summaryData);
    }

    clearHistoricalMark(course, studentName, dateStr, evt) {
        if (evt) evt.stopPropagation();
        const key = `${course}|${studentName}|${dateStr}`;
        this.historicalMarks[key] = '';
        this.renderHistoricalSummary(this.summaryData);
    }

    async generateStudentReport(studentName, monthLabel) {
        const loader = document.createElement('div');
        loader.id = 'pdf-gen-overlay';
        Object.assign(loader.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            background: '#ffffff', zIndex: '99999',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        });
        loader.innerHTML = `
            <!-- SPINNER UI (Visible to user) -->
            <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: #ffffff; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 1000; font-family: 'Outfit', sans-serif;">
                <div class="animate-spin rounded-full h-16 w-16 border-4 border-indigo-600 border-t-transparent mb-6"></div>
                <h2 style="color: #1e293b; font-size: 18px; font-weight: 800; margin: 0;">PREPARANDO DOCUMENTO OFICIAL</h2>
                <p style="color: #64748b; font-size: 13px; margin-top: 10px;">Consolidando todos los cursos del alumno. No cierres esta ventana.</p>
            </div>
            <!-- CAPTURE AREA (Hidden from user via z-index, but visible to browser) -->
            <div id="pdf-capture-container" style="position: absolute; top: 0; left: 0; width: 800px; padding: 40px; background: white; z-index: 1; opacity: 1;">
                <div id="pdf-capture-area" style="background: white; width: 100%; min-height: 980px; display: flex; flex-direction: column;"></div>
            </div>
        `;


        document.body.appendChild(loader);
        
        if (!this.allStudentsCache) {
            try { this.allStudentsCache = await this.provider.getAllStudents(); } catch(e) {}
        }
        
        const monthOrder = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
        const [labelMonth, labelYear] = monthLabel.toUpperCase().split(' ');
        const monthIdx = monthOrder.indexOf(labelMonth);
        const yearInt = parseInt(labelYear);

        let targetCourses = [this.els.courseSelector.value];
        if (this.allStudentsCache) {
            const studentEntries = this.allStudentsCache.filter(s => s.name === studentName);
            if (studentEntries.length > 0) {
                targetCourses = studentEntries.map(s => s.course);
            }
        }

        const captureArea = loader.querySelector('#pdf-capture-area');
        let htmlContent = '';
        let isFirstCourse = true;

        for (const course of targetCourses) {
            const holidayDates = new Set();
            const daysInMonth = new Date(yearInt, monthIdx + 1, 0).getDate();
            for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${String(d).padStart(2, '0')}/${String(monthIdx + 1).padStart(2, '0')}/${yearInt}`;
                const override = this.dayOverrides[`${course}|${dateStr}`] || d;
                if (/f/i.test(String(override))) holidayDates.add(dateStr);
            }

            const marks = Object.entries(this.historicalMarks)
                .filter(([k]) => k.startsWith(`${course}|${studentName}|`))
                .map(([k, v]) => ({ date: k.split('|')[2], status: v }))
                .filter(m => m.status !== '');

            // Merge holidays that don't have marks
            holidayDates.forEach(hd => {
                if (!marks.find(m => m.date === hd)) {
                    marks.push({ date: hd, status: 'FESTIVO' });
                }
            });

            marks.sort((a, b) => {
                if (a.date.startsWith('Extra') || b.date.startsWith('Extra')) return 0;
                const [da, ma, ya] = a.date.split('/').map(Number), [db, mb, yb] = b.date.split('/').map(Number);
                return new Date(ya, ma - 1, da) - new Date(yb, mb - 1, db);
            });

        const statusMap = {
            'X': '<span style="color: #10b981; font-weight: bold;">ASISTENCIA</span>',
            'F': '<span style="color: #ef4444; font-weight: bold;">FALTA</span>',
            'O': '<span style="color: #0ea5e9; font-weight: bold;">ONLINE</span>',
            'XX': '<span style="color: #059669; font-weight: bold;">DOBLE ASISTENCIA</span>',
            'FF': '<span style="color: #e11d48; font-weight: bold;">DOBLE FALTA</span>',
            'RC': '<span style="color: #6366f1; font-weight: bold;">RECUPERACIÓN</span>',
            'RA': '<span style="font-weight: bold;"><span style="color: #6366f1;">RECUPERACIÓN</span> <span style="color: #1e293b;">Y</span> <span style="color: #10b981;">ASISTENCIA</span></span>',
            'XF': '<span style="font-weight: bold;"><span style="color: #10b981;">ASISTENCIA</span> <span style="color: #1e293b;">Y</span> <span style="color: #ef4444;">FALTA</span></span>',
            'T': '<span style="color: #d946ef; font-weight: bold;">TALLER</span>',
            'FESTIVO': '<span style="color: #e11d48; font-weight: 800;">DÍA FESTIVO</span>'
        };

        htmlContent += `
            <div style="${!isFirstCourse ? 'page-break-before: always; margin-top: 40px;' : ''}">
            <!-- HEADER PREMIUM -->
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #4f46e5; padding-bottom: 20px; margin-bottom: 30px;">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <img src="../CertificadosAgenciaTributaria/logo.png" style="width: 60px; height: 60px; object-fit: contain;">
                    <div>
                        <h1 style="margin:0; font-size: 24px; font-weight: 900; color: #1e293b; font-family: 'Outfit', sans-serif;">ACADEMIA YES OF COURSE</h1>
                        <p style="margin:2px 0 0; font-size: 12px; color: #6366f1; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;">Control de Asistencia Oficial</p>
                    </div>
                </div>
            </div>

            <!-- INFO CARDS -->
            <div style="display: grid; grid-template-columns: 1.5fr 1.5fr 1fr 1fr; gap: 15px; margin-bottom: 30px;">
                <div style="background: #f8fafc; padding: 15px; border-radius: 12px; border-left: 4px solid #4f46e5;">
                    <p style="font-size: 9px; color: #94a3b8; font-weight: 800; margin: 0 0 5px; text-transform: uppercase;">ESTUDIANTE</p>
                    <p style="font-size: 14px; font-weight: 700; color: #1e293b; margin: 0;">${studentName}</p>
                </div>
                <div style="background: #f8fafc; padding: 15px; border-radius: 12px; border-left: 4px solid #6366f1;">
                    <p style="font-size: 9px; color: #94a3b8; font-weight: 800; margin: 0 0 5px; text-transform: uppercase;">CURSO Y MES</p>
                    <p style="font-size: 14px; font-weight: 700; color: #1e293b; margin: 0;">${course.toUpperCase()} - ${monthLabel.toUpperCase()}</p>
                </div>
                <div style="background: #fef2f2; padding: 15px; border-radius: 12px; border-left: 4px solid #ef4444; text-align: center;">
                    <p style="font-size: 9px; color: #f87171; font-weight: 800; margin: 0 0 5px; text-transform: uppercase;">FALTAS</p>
                    <p style="font-size: 28px; font-weight: 900; color: #b91c1c; margin: 0; line-height: 1;">${marks.reduce((sum, m) => sum + (m.status === 'F' ? 1 : m.status === 'FF' ? 2 : m.status === 'XF' ? 1 : 0), 0)}</p>
                </div>
                <div style="background: #f0f9ff; padding: 15px; border-radius: 12px; border-left: 4px solid #0ea5e9; text-align: center;">
                    <p style="font-size: 9px; color: #0ea5e9; font-weight: 800; margin: 0 0 5px; text-transform: uppercase;">RECUP.</p>
                    <p style="font-size: 28px; font-weight: 900; color: #0284c7; margin: 0; line-height: 1;">${marks.reduce((sum, m) => sum + (m.status === 'RC' ? 1 : m.status === 'RA' ? 1 : 0), 0)}</p>
                </div>
            </div>

            <!-- DATA TABLE -->
            <table style="width: 100%; border-collapse: collapse; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05); margin-bottom: 20px;">
                <thead>
                    <tr style="background-color: #4f46e5;">
                        <th style="padding: 12px 20px; text-align: left; font-size: 11px; font-weight: 800; color: #ffffff; text-transform: uppercase;">FECHA</th>
                        <th style="padding: 12px 20px; text-align: center; font-size: 11px; font-weight: 800; color: #ffffff; text-transform: uppercase;">ESTADO DE CLASE</th>
                    </tr>
                </thead>
                <tbody style="background: white;">
                    ${marks.length > 0 ? marks.map((m, i) => {
                        const isFestivo = holidayDates.has(m.date) || m.status === 'FESTIVO';
                        const rowBg = isFestivo ? '#fff1f2' : (i % 2 === 0 ? '#ffffff' : '#f8fafc');
                        return `
                            <tr style="background-color: ${rowBg};">
                                <td style="padding: 14px 20px; font-size: 13px; font-weight: 600; color: #334155; border-bottom: 1px solid #f1f5f9;">${m.date}</td>
                                <td style="padding: 14px 20px; text-align: center; border-bottom: 1px solid #f1f5f9;">
                                    ${isFestivo && m.status !== 'FESTIVO' ? '<div style="margin-bottom:4px;"><span style="color: #e11d48; font-size: 9px; font-weight: 800;">FESTIVO</span></div>' : ''}
                                    ${statusMap[m.status] || ''}
                                </td>
                            </tr>
                        `;
                    }).join('') : '<tr><td colspan="2" style="padding: 60px; text-align: center; color: #94a3b8; font-family: Outfit; font-style: italic;">No se han registrado incidencias en este periodo.</td></tr>'}
                </tbody>
            </table>

            <!-- FOOTER AT BOTTOM -->
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #f1f5f9; text-align: center;">
                <p style="font-size: 10px; color: #94a3b8; margin-bottom: 5px;">Este documento es un reporte oficial de Academia Yes Of Course generado automáticamente para el curso ${course.toUpperCase()}.</p>
                <p style="font-size: 10px; color: #4f46e5; font-weight: 800; margin: 0;">www.academiayesofcourse.com</p>
            </div>
            </div>`;
            isFirstCourse = false;
        }
        captureArea.innerHTML = htmlContent;



        const opt = {
            margin: 10,
            filename: `Reporte_${studentName.replace(/ /g, '_')}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                logging: false,
                scrollY: 0,
                backgroundColor: '#ffffff'
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: 'avoid-all' }
        };


        try {
            window.scrollTo(0, 0);
            await new Promise(r => setTimeout(r, 1200)); // Even more time

            const element = document.getElementById('pdf-capture-area');
            await html2pdf().set(opt).from(element).save();
        } catch (err) {


            console.error('PDF error:', err);
            alert('Error al generar el PDF: ' + err.message);
        } finally {
            if (document.getElementById('pdf-gen-overlay')) {
                document.body.removeChild(loader);
            }
        }
    }

    handleGlobalSearch(e) {
        const term = this.normalizeStr(e.target.value).trim();
        if (term.length < 2) { this.els.searchResults.classList.add('hidden'); return; }
        if (!this.allStudentsCache) { this.provider.getAllStudents().then(s => this.allStudentsCache = s); return; }
        const filtered = this.allStudentsCache.filter(s => {
            const studentNameNorm = this.normalizeStr(s.name);
            return studentNameNorm.includes(term);
        });
        if (filtered.length > 0) {
            this.els.searchResults.innerHTML = filtered.map(s => `
                <div class="px-5 py-3 hover:bg-slate-50 cursor-pointer text-xs flex flex-col gap-0.5 border-b border-slate-50 last:border-0" onclick="app.selectSearchStudent('${s.name.replace(/'/g, "\\'")}', '${s.course}')">
                    <span class="font-bold text-slate-800">${s.name}</span>
                    <span class="text-[10px] font-black text-slate-400 tracking-tighter uppercase">${s.course || 'Sin curso'}</span>
                </div>
            `).join('');
            this.els.searchResults.classList.remove('hidden');
        }
    }

    selectSearchStudent(name, sheet) {
        this.els.searchResults.classList.add('hidden');
        this.els.globalSearch.value = name;
        this.els.courseSelector.value = sheet;
        this.handleCourseChange();
    }

    switchTab(tabId) {
        document.querySelectorAll('.tab-content').forEach(t => t.classList.toggle('active', t.id === tabId));
        document.querySelectorAll('.tab-btn').forEach(b => {
            const isActive = b.id === `btn-${tabId}`;
            b.classList.toggle('bg-white', isActive); b.classList.toggle('text-indigo-600', isActive);
        });
        if (tabId === 'tab-consultar') document.getElementById('summaryContainer').scrollIntoView({ behavior: 'smooth' });
    }

    async loadHistoricalMarks() {
        try {
            const res = await fetch('/api?action=get_historical_marks');
            const data = await res.json();
            
            if (data.marks) {
                this.historicalMarks = {};
                let needsMigrationSave = false;
                
                // Detectar formato antiguo para realizar migración silenciosa en background
                const oldKeysExist = Object.keys(data.marks).some(k => k.split('|').length === 2);
                if (oldKeysExist && !this.allStudentsCache) {
                    try { this.allStudentsCache = await this.provider.getAllStudents(); } catch(e) {}
                }

                for (const [k, v] of Object.entries(data.marks)) {
                    const parts = k.split('|');
                    if (parts.length === 2 && this.allStudentsCache) {
                        try {
                            const studentData = this.allStudentsCache.find(s => s.name === parts[0]);
                            const mappedCourse = studentData ? studentData.course : 'CURSO_DESCONOCIDO';
                            this.historicalMarks[`${mappedCourse}|${parts[0]}|${parts[1]}`] = v;
                            needsMigrationSave = true;
                        } catch(e) {
                             this.historicalMarks[k] = v; // fallback inside catch
                        }
                    } else {
                        // Either modern key (course|student|date) or no cache fallback.
                        this.historicalMarks[k] = v;
                    }
                }
                if (needsMigrationSave) {
                    // Start saving the migrated base quietly
                    setTimeout(() => this.saveHistoricalMarks(), 3000); 
                }
            }
            if (data.overrides) {
                this.dayOverrides = data.overrides;
            }
        } catch (err) {
            console.error('Error loading historical marks:', err);
        }
    }

    async saveDayOverride(dateStr, newLabel) {
        const course = this.els.courseSelector.value;
        const key = `${course}|${dateStr}`;
        const label = newLabel.trim();

        try {
            await fetch('/api', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'save_day_override',
                    key: key,
                    label: label
                })
            });
            this.dayOverrides[key] = label;
            if (this.summaryData) {
                this.renderHistoricalSummary(this.summaryData);
            }
        } catch (err) {
            console.error('Error saving day override:', err);
            alert('Error al guardar la etiqueta del día');
        }
    }

    async saveHistoricalMarks() {
        const btn = document.getElementById('saveHistoryBtn');
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<span class="animate-pulse">Sincronizando...</span>';
        btn.disabled = true;

        console.log('Sending marks:', this.historicalMarks);

        try {
            const res = await fetch('/api', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'save_historical_marks',
                    marks: this.historicalMarks
                })
            });
            const data = await res.json();
            if (data.message) {
                const count = data.count || 0;
                btn.innerHTML = `¡OK!`;
                btn.classList.replace('bg-orange-500', 'bg-emerald-500');
                setTimeout(() => {
                    btn.innerHTML = originalHtml;
                    btn.classList.replace('bg-emerald-500', 'bg-orange-500');
                    btn.disabled = false;
                }, 3000);
            }
        } catch (err) {
            alert('Error al guardar: ' + err.message);
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
    }

    updateSyncTime() {
        this.els.syncTime.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Navegación rápida entre cursos (Botones laterales)
    changeCourseNav(delta) {
        const selector = this.els.courseSelector;
        const currentIndex = selector.selectedIndex;
        const nextIndex = currentIndex + delta;

        if (nextIndex >= 0 && nextIndex < selector.options.length) {
            const nextValue = selector.options[nextIndex].value;
            if (nextValue) { // Evitar la opción vacía "-- Selecciona un curso --"
                selector.selectedIndex = nextIndex;
                this.handleCourseChange();
            }
        }
    }

    // Actualiza las etiquetas de los botones de navegación
    updateNavButtons() {
        const selector = this.els.courseSelector;
        const currentIndex = selector.selectedIndex;
        
        // Botón Anterior
        const prevIndex = currentIndex - 1;
        if (prevIndex > 0) { // Ignorar la opción 0 que es el placeholder
            const prevName = selector.options[prevIndex].text;
            this.els.prevCourseBtn.classList.remove('hidden');
            if (this.els.prevCourseNavLabel) this.els.prevCourseNavLabel.textContent = prevName;
        } else {
            this.els.prevCourseBtn.classList.add('hidden');
        }

        // Botón Siguiente
        const nextIndex = currentIndex + 1;
        if (nextIndex < selector.options.length) {
            const nextName = selector.options[nextIndex].text;
            this.els.nextCourseBtn.classList.remove('hidden');
            if (this.els.nextCourseNavLabel) this.els.nextCourseNavLabel.textContent = nextName;
        } else {
            this.els.nextCourseBtn.classList.add('hidden');
        }
    }
}

const app = new AttendanceApp(new GoogleSheetsProvider('/api'));
