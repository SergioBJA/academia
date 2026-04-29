/**
 * Lógica Principal - Notas de Idiomas Web
 * Academia YES OF COURSE!
 */

const GOOGLE_CLIENT_ID = '862884316906-q5gs2ta79bg7v16vdnduddtsc0iirqqg.apps.googleusercontent.com';
const API_URL = '/api'; // Backend en Python (FastAPI)

function notasAppV5() {
    return {
        // Estado
        activeTab: 'cursos',
        isDarkMode: ThemeManager.isDark(),
        toggleTheme() { this.isDarkMode = ThemeManager.toggle(); },
        isGoogleConnected: false,
        isExporting: false,
        isEditingNotaId: null,
        showAddNotaModal: false,
        showPdfPreviewModal: false,
        showResetPasswordModal: false,
        resetPasswordInput: '',
        courseToReset: '',
        resetError: '',

        // Estados para Borrado
        showDeleteModal: false,
        notaToDelete: null,
        searchQuery: '',
        searchTimeout: null, // NEW: Debouncer
        _adminConsolidatedCache: null, // NEW: Caching for the expensive list union
        contactsList: [],
        filteredContacts: [],
        courseStudents: [],
        courseStudentsMerged: [],
        selectedStudent: null,
        selectedStudentNotas: [],
        alumnoSearchQuery: '',
        alumnoResult: null,
        alumnoResultNotas: [],
        studentGradoMap: {}, // ID del alumno -> Grado académico
        allSheetStudents: [], // Todos los alumnos de todas las hojas
        anulados: [], // Array de IDs de alumnos anulados
        sheetMeta: {}, // Metadata como iconos e imágenes desde E2
        isLoggedOut: false, // Mostrar pantalla de desconexion visible
        cursosEscolares: [],
        selectedGrado: 'TODOS',
        selectedProfessor: '',
        selectedCourseName: '',
        selectedCourseNote: '',
        selectedCourseVideo: '',
        selectedCourseQR: '',
        isExam: false,
        trimesterChecks: {}, // studentId -> { t1, t2, t3, t3_date }
        teacherNotes: {}, // studentId -> string
        snapshots: [], // Snapshot de notas históricas
        whatsappTemplates: {}, // Plantillas dinámicas desde app_data.json

        // Estado de Google OAuth
        googleTokenClient: null,

        // Configuración de Cálculos (Máximos por Skill y Curso)
        maximos: {
            'B1 EXAMS': { reading: 32, writing: 40, listening: 25 },
            'B2 EXAMS': { reading: 70, writing: 40, listening: 30 },
            'C1 EXAMS': { reading: 78, writing: 40, listening: 30 }
        },
        newNota: {
            curso: 'B2 EXAMS',
            reading: '',
            fecha_reading: new Date().toISOString().split('T')[0],
            writing: '',
            fecha_writing: new Date().toISOString().split('T')[0],
            listening: '',
            fecha_listening: new Date().toISOString().split('T')[0],
            grado_academico: ''
        },

        async init() {
            // Estado inicial: arrancar en "Por Cursos" sin curso seleccionado.
            this.activeTab = 'cursos';
            this.selectedGrado = 'TODOS';
            this.sheetMeta = {}; 

            await this.refreshData();

            // Inicializar Google Centralizado
            if (window.GoogleAuthCentral) {
                GoogleAuthCentral.init((token) => this.fetchGoogleContacts(token));
                GoogleAuthCentral.setupAlpineSync(this);
            }

            // Cargar configuración de WhatsApp
            this.fetchWebConfig();
        },

        async refreshData() {
            try {
                // LLAMADA CONSOLIDADA DE OPTIMIZACIÓN
                const res = await fetch(`${API_URL}?action=get_portal_init`);
                if (!res.ok) {
                    const errorText = await res.text();
                    throw new Error(`HTTP ${res.status}: ${errorText.substring(0, 100)}`);
                }
                const data = await res.json();

                // 1. Cursos/Grados
                this.cursosEscolares = data.cursos || [];
                if (this.cursosEscolares.length > 0 && !this.newNota.grado_academico) {
                    this.newNota.grado_academico = this.cursosEscolares[0];
                }

                // 2. Alumnos de todas las hojas
                this.allSheetStudents = data.students || [];
                this.sheetMeta = data.meta || {}; 
                this.anulados = data.anulados || []; 
                this.trimesterChecks = data.trimester_checks || {};
                this.teacherNotes = data.teacher_notes || {};
                
                // Normalizar snapshots como array
                const rawSnapshots = data.snapshots || [];
                this.snapshots = Array.isArray(rawSnapshots) ? rawSnapshots : Object.values(rawSnapshots);


                // Migración de IDs antiguos (sólo nombres) a sheet:normName para estabilidad
                Object.keys(this.trimesterChecks).forEach(key => {
                    if (key && !key.includes('/') && !key.startsWith('sheet:')) {
                        const newKey = `sheet:${this.normalizeName(key)}`;
                        if (!this.trimesterChecks[newKey]) this.trimesterChecks[newKey] = this.trimesterChecks[key];
                    }
                });
                Object.keys(this.teacherNotes).forEach(key => {
                    if (key && !key.includes('/') && !key.startsWith('sheet:')) {
                        const newKey = `sheet:${this.normalizeName(key)}`;
                        if (!this.teacherNotes[newKey]) this.teacherNotes[newKey] = this.teacherNotes[key];
                    }
                });

                // 2b. Auto-reset Check: 30 días después de T3
                this.checkAutoReset();

                // 3. Mapeo de alumnos a grados (desde las notas existentes)
                const map = {};
                (data.notas || []).forEach(r => {
                    const alunoId = r[0];
                    const grado = r[11]; // Columna L
                    if (alunoId && grado) map[alunoId] = grado;
                });
                this.studentGradoMap = map;

                // 4. Invalidar caché y refrescar UI local
                this._adminConsolidatedCache = null;
                this.searchContacts();

                // 5. Si hay un alumno seleccionado, recargar sus notas también
                if (this.selectedStudent) {
                    await this.loadNotas();
                }

            } catch (err) {
                console.error('Error en carga de datos:', err);
                // No mostrar alert en refresh de fondo para no interrumpir
            }
        },


        // --- GOOGLE CONTACTS ---
        connectGoogle() {
            GoogleAuthCentral.connect();
        },

        contactsMap: {},
        async fetchGoogleContacts(token) {
            try {
                const response = await fetch('https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers&pageSize=2000', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (!response.ok) {
                    throw new Error(`Token inválido o expirado. Status: ${response.status}`);
                }
                
                const data = await response.json();

                if (data.connections && data.connections.length > 0) {
                    this.contactsList = data.connections.map(person => {
                        const name = person.names ? person.names[0].displayName : 'Sin nombre';
                        const phoneRaw = person.phoneNumbers && person.phoneNumbers[0] ? (person.phoneNumbers[0].value || '') : '';
                        // Normalizar teléfono: quitar todo excepto dígitos y +
                        let phoneDigits = phoneRaw ? phoneRaw.replace(/[^\d+]/g, '') : '';
                        // Asegurar formato correcto con código de país
                        if (phoneDigits) {
                            if (phoneDigits.startsWith('+')) {
                                // Ya tiene código de país, dejar como está
                            } else if (phoneDigits.startsWith('0034')) {
                                phoneDigits = '+' + phoneDigits.slice(2); // 0034... → +34...
                            } else if (phoneDigits.length === 9 && /^[679]/.test(phoneDigits)) {
                                phoneDigits = '+34' + phoneDigits; // 9 dígitos España → +34...
                            }
                        }

                        return {
                            id: person.resourceName,
                            name: name,
                            normName: this.normalizeName(name), // Pre-normalizar AQUÍ
                            email: person.emailAddresses ? person.emailAddresses[0].value : 'Sin email',
                            phone: phoneDigits
                        };
                    });

                    // Construir mapa de búsqueda rápida O(1)
                    this.contactsMap = {};
                    this.contactsList.forEach(c => {
                        if (c.normName && !this.contactsMap[c.normName]) {
                            this.contactsMap[c.normName] = c;
                        }
                    });

                    // Recalcular lo que se muestra según pestaña/curso
                    this.searchContacts();
                    if (this.selectedGrado !== 'TODOS') {
                        this.loadCourseStudents(this.selectedGrado);
                    }
                }
            } catch (error) {
                console.error('Error al descargar contactos:', error);
                // Let central auth handle reconnection logic if token is invalid
            }
        },

        logout() {
            GoogleAuthCentral.logout();
            this.isLoggedOut = true;
            this.contactsList = [];
            this._adminConsolidatedCache = null;
        },

        async fetchWebConfig() {
            try {
                const res = await fetch(`${API_URL}?action=get_web_config`);
                const data = await res.json();
                if (data.success && data.web_config && data.web_config.whatsapp_templates) {
                    this.whatsappTemplates = data.web_config.whatsapp_templates;
                }
            } catch (e) {
                console.error('Error fetching web config:', e);
            }
        },

        normalizedCache: {},
        normalizeName(str) {
            if (!str) return '';
            if (this.normalizedCache[str]) return this.normalizedCache[str];

            const res = str.toString()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9\s]/gi, ' ') // Cambiado a espacio para no pegar palabras
                .replace(/\s+/g, ' ')
                .trim()
                .toLowerCase();

            this.normalizedCache[str] = res;
            return res;
        },

        // Helper para obtener un ID consistente del alumno
        getStudentId(studentName, contact = null) {
            if (contact && contact.id) return contact.id;
            // Si el nombre ya contiene el prefijo sheet: (de consolidado admin)
            if (typeof studentName === 'string' && studentName.startsWith('sheet:')) return studentName;
            return `sheet:${this.normalizeName(studentName)}`;
        },

        fuzzyMatch(target, query) {
            if (!query || !target) return false;
            const nTarget = this.normalizeName(target);
            const nQuery = this.normalizeName(query);

            if (nTarget === nQuery) return true;
            if (nTarget.includes(nQuery) || nQuery.includes(nTarget)) return true;

            // Match por palabras (todas las palabras de una están en la otra)
            const getSignificantWords = (s) => s.split(' ').filter(w => w.length > 2);
            const wordsTarget = getSignificantWords(nTarget);
            const wordsQuery = getSignificantWords(nQuery);

            if (wordsTarget.length === 0 || wordsQuery.length === 0) return false;

            // Si todas las palabras del contacto están en el nombre del alumno, o viceversa
            const allTargetInQuery = wordsTarget.every(w => nQuery.includes(w));
            const allQueryInTarget = wordsQuery.every(w => nTarget.includes(w));

            return allTargetInQuery || allQueryInTarget;
        },

        findContactByStudentName(studentName) {
            if (!studentName) return null;
            const normStudent = this.normalizeName(studentName);

            // 1. Búsqueda instantánea en mapa (O(1))
            if (this.contactsMap[normStudent]) return this.contactsMap[normStudent];

            // 2. Intento con nombre invertido (Apellido, Nombre -> Nombre Apellido)
            if (studentName.includes(',')) {
                const parts = studentName.split(',').map(p => p.trim());
                if (parts.length >= 2) {
                    const normReversed = this.normalizeName(`${parts[1]} ${parts[0]}`);
                    if (this.contactsMap[normReversed]) return this.contactsMap[normReversed];
                }
            }

            // 3. Match aproximado (sólo si no hubo exacto)
            return this.contactsList.find(c => this.fuzzyMatch(c.normName, normStudent)) || null;
        },

        getYoutubeId(url) {
            if (!url) return null;
            const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
            const match = url.match(regExp);
            return (match && match[2].length === 11) ? match[2] : null;
        },

        async loadCourseStudents(grado) {
            try {
                this.courseStudents = this.allSheetStudents.filter(s => s.course === grado);
                
                // Extraer Profesor y Nombre Real desde Meta (C2)
                const meta = this.sheetMeta[grado];
                this.selectedCourseName = (meta && meta.c2) || grado;
                this.selectedProfessor = (meta && meta.c4) || '';
                this.selectedCourseNote = (meta && meta.note) || '';
                this.selectedCourseVideo = (meta && meta.video) || '';
                this.selectedCourseQR = (meta && meta.qr) || '';

                // Mapeo con caché local para no repetir búsquedas de contactos iguales
                const localMatchCache = {};
                this.courseStudentsMerged = this.courseStudents.map(s => {
                    if (!localMatchCache[s.name]) {
                        localMatchCache[s.name] = this.findContactByStudentName(s.name);
                    }
                    const contact = localMatchCache[s.name];
                    const id = this.getStudentId(s.name, contact);
                    return {
                        id: id,
                        name: s.name,
                        contact,
                        hasContact: !!contact,
                        whatsappUrl: contact && contact.phone ? `https://wa.me/${contact.phone.replace(/^\+/, '')}` : null,
                        checks: this.trimesterChecks[id] || { t1: false, t2: false, t3: false, t3_date: null },
                        note: this.teacherNotes[id] || ''
                    };
                });

            } catch (e) {
                console.error('Error al cargar alumnos del curso', e);
                this.courseStudents = [];
                this.courseStudentsMerged = [];
            }
        },

        async selectCourse(grado) {
            this.activeTab = 'cursos';
            this.selectedGrado = grado;
            this.isExam = this.isExamGrade(grado);
            this.selectedStudent = null;
            await this.loadCourseStudents(grado);
            this.searchContacts();
        },

        debounceSearch() {
            if (this.searchTimeout) clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                this.searchContacts();
            }, 250);
        },

        async toggleTrimesterCheck(studentId, tNum) {
            console.log("Toggle Trimester Check:", studentId, tNum);
            if (!this.trimesterChecks[studentId]) {
                this.trimesterChecks[studentId] = { t1: false, t2: false, t3: false, t3_date: null };
            }
            const checks = this.trimesterChecks[studentId];
            const field = `t${tNum}`;
            checks[field] = !checks[field];
            
            if (field === 't3') {
                checks.t3_date = checks.t3 ? new Date().toISOString() : null;
            }

            // Forzar reactividad INMEDIATA (Optimistic UI)
            this.trimesterChecks[studentId] = { ...checks };
            this.trimesterChecks = { ...this.trimesterChecks };
            this.searchContacts();

            // Persistir de fondo
            try {
                await fetch(`${API_URL}?action=save_trimester_checks`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'save_trimester_checks', studentId, checks })
                });
                // NO llamar a refreshData aquí para evitar race conditions que sobreescriban el estado local (Optimistic UI)
            } catch (e) {
                console.error("Error saving checks:", e);
            }
        },

        async saveTeacherNote(studentId, note) {
            this.teacherNotes[studentId] = note;
            try {
                await fetch(`${API_URL}?action=save_teacher_note`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'save_teacher_note', studentId, note })
                });
                // Sincronización silenciosa si fuera necesaria, pero evitamos refreshData total para no perder foco o estado
            } catch (e) { console.error(e); }
        },

        async resetCourse(grado) {
            console.log("RESETEO: Solicitado para curso:", grado);
            if (!grado || grado === 'TODOS') {
                console.warn("RESETEO: Grado inválido:", grado);
                return;
            }

            const mensaje = `¿Estás seguro de que deseas resetear el curso ${grado}?\n\nEsta acción archivará todas las notas actuales y limpiará la lista permanentemente.`;
            if (!confirm(mensaje)) return;

            try {
                console.log("RESETEO: Enviando petición API para", grado);
                const res = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'reset_course', grado: grado })
                });
                
                if (res.ok) {
                    console.log("RESETEO: Éxito en API");
                    const data = await res.json();
                    this.snapshots = data.snapshots || [];
                    await this.init(); 
                    if (this.selectedGrado === grado) {
                        await this.loadCourseStudents(grado);
                    }
                } else {
                    const text = await res.text();
                    console.error("RESETEO: Error API:", text);
                    alert("Error servidor: " + text);
                }
            } catch (e) {
                console.error("RESETEO: Error Fatal:", e);
                alert('Error al resetear el curso');
            }
        },

        // confirmReset ya no es necesario ya que se integró en resetCourse sin contraseña
        async confirmReset() {
            this.resetCourse(this.courseToReset);
        },

        checkAutoReset() {
            const oneMonth = 30 * 24 * 60 * 60 * 1000;
            const now = new Date();
            const coursesToReset = new Set();

            Object.entries(this.trimesterChecks).forEach(([sId, checks]) => {
                if (checks.t3 && checks.t3_date) {
                    const t3Date = new Date(checks.t3_date);
                    if (now - t3Date > oneMonth) {
                        // Encontrar a qué curso pertenece este alumno
                        // Buscamos en studentGradoMap que tiene ID -> Grado
                        const grado = this.studentGradoMap[sId];
                        if (grado) coursesToReset.add(grado);
                    }
                }
            });

            if (coursesToReset.size > 0) {
                setTimeout(() => {
                    coursesToReset.forEach(c => {
                        if (confirm(`El curso ${c} ha cumplido un mes desde la evaluación final (3T). ¿Deseas resetearlo ahora y archivar las notas?`)) {
                            this.resetCourse(c);
                        }
                    });
                }, 1000);
            }
        },

        get adminConsolidated() {
            if (this._adminConsolidatedCache) return this._adminConsolidatedCache;

            // Fuente de verdad: Alumnos del Sheet
            let consolidated = this.allSheetStudents.map(s => {
                const contact = this.findContactByStudentName(s.name);
                const id = this.getStudentId(s.name, contact);
                
                return {
                    renderId: `${id}:${s.course}`, // ID único para Alpine (Alumno + Curso)
                    id: id,
                    name: s.name,
                    email: contact ? contact.email : 'Sin email',
                    phone: contact ? contact.phone : '',
                    hasContact: !!contact,
                    whatsappUrl: contact && contact.phone ? `https://wa.me/${contact.phone.replace(/^\+/, '')}` : null,
                    source: contact ? 'google' : 'sheet',
                    course: s.course,
                    professor: (this.sheetMeta[s.course] && this.sheetMeta[s.course].c4) || '',
                    isAnulado: this.anulados.includes(id),
                    _contact: contact // Guardar el contacto original para vinculación
                };
            });

            this._adminConsolidatedCache = consolidated;
            return consolidated;
        },

        searchContacts() {
            const query = this.normalizeName(this.searchQuery).trim();
            const grado = this.selectedGrado;

            // PESTAÑA: POR CURSOS
            if (this.activeTab === 'cursos' && grado !== 'TODOS') {
                const list = this.courseStudentsMerged || [];
                let filtered = list.filter(s => !query || this.fuzzyMatch(s.name, query));
                
                // Ordenar: Activos > Terminados (3T) > Anulados
                filtered.sort((a, b) => {
                    if (this.anulados.includes(a.id) && !this.anulados.includes(b.id)) return 1;
                    if (!this.anulados.includes(a.id) && this.anulados.includes(b.id)) return -1;
                    
                    const aFinished = a.checks && a.checks.t3;
                    const bFinished = b.checks && b.checks.t3;
                    if (aFinished && !bFinished) return 1;
                    if (!aFinished && bFinished) return -1;
                    
                    return 0;
                });

                this.filteredContacts = filtered.map(s => {
                        const id = s.id;
                        return {
                            id: id,
                            name: s.name,
                            email: s.contact ? s.contact.email : 'Sin contacto',
                            phone: s.contact ? s.contact.phone : '',
                            whatsappUrl: s.whatsappUrl,
                            hasContact: s.hasContact,
                            isAnulado: this.anulados.includes(id),
                            checks: this.trimesterChecks[id] || { t1: false, t2: false, t3: false, t3_date: null },
                            note: this.teacherNotes[id] || '',
                            course: grado, // NEW: Always include course
                            professor: (this.sheetMeta[grado] && this.sheetMeta[grado].c4) || '',
                            _contact: s.contact
                        };
                    });
            } else {
                // PESTAÑA: PANEL ADMIN (Consolidado cacheado O(1) union, solo iterado para filtro)
                const consolidated = this.adminConsolidated;

                // 3. Filtrar por búsqueda y grado
                this.filteredContacts = consolidated.filter(c => {
                    const matchesName = !query || this.fuzzyMatch(c.name, query) || (c.email && this.fuzzyMatch(c.email, query));

                    // El filtro de grado es un poco complejo si no tenemos mapa para todos
                    let matchesGrado = true;
                    if (grado !== 'TODOS') {
                        const studentGrado = this.studentGradoMap[c.id] || c.course;
                        matchesGrado = (studentGrado === grado);
                    }

                    return matchesName && matchesGrado;
                });
            }

            // Ordenar: Activos > Terminados (3T) > Anulados (Baja)
            this.filteredContacts.sort((a, b) => {
                // 1. Anulados (Baja) al final de todo
                if (a.isAnulado !== b.isAnulado) return a.isAnulado ? 1 : -1;
                
                // 2. Si ambos están activos/baja, ver si uno ha terminado el curso (3T)
                if (this.activeTab === 'cursos') {
                    const aFinished = a.checks && a.checks.t3;
                    const bFinished = b.checks && b.checks.t3;
                    if (aFinished !== bFinished) return aFinished ? 1 : -1;
                }
                
                // 3. Alfabético dentro de su grupo
                return a.name.localeCompare(b.name);
            });
        },

        // --- GESTIÓN DE NOTAS (API WORKER) ---
        async toggleAnulado(contact, evt) {
            if (evt) evt.stopPropagation();
            
            // Optimistic UI
            contact.isAnulado = !contact.isAnulado;
            if (contact.isAnulado) {
                if (!this.anulados.includes(contact.id)) this.anulados.push(contact.id);
            } else {
                this.anulados = this.anulados.filter(id => id !== contact.id);
            }
            
            // Reordenar inmediatamente
            this.searchContacts();

            try {
                await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'toggle_anulado',
                        alumno_id: contact.id,
                        alumno_name: contact.name,
                        anulado: contact.isAnulado
                    })
                });
                this.refreshData(); // Sync final
            } catch (e) {
                console.error("Error al guardar anulado:", e);
            }
        },

        async selectStudent(contact) {
            // Asegurarnos de que el contacto tenga un ID consistente
            if (!contact.id) {
                contact.id = this.getStudentId(contact.name, contact.contact || contact._contact);
            }
            
            const targetCourse = contact.course || this.selectedGrado;
            
            // Simplemente usamos el objeto contact que ya viene de la lista (filtrada o curso)
            // Esto asegura que conservamos las propiedades .note y .checks que se cargaron en loadCourseStudents
            this.selectedStudent = contact;
            
            // Asegurar que tenga el curso para loadNotas
            if (!this.selectedStudent.course) this.selectedStudent.course = targetCourse;

            await this.loadNotas();
        },

        mapNotaRow(r) {
            return {
                id: r[10] || (Date.now() + Math.random()), 
                alumno_id: r[0],
                nombre_alumno: r[1],
                curso: r[2],
                fecha_reading: r[3],
                reading: r[4],
                fecha_writing: r[5],
                writing: r[6],
                fecha_listening: r[7],
                listening: r[8],
                media: r[9],
                grado_academico: r[11]
            };
        },

        async loadNotas(studentId, gradoParam) {
            const id = studentId || (this.selectedStudent ? this.selectedStudent.id : null);
            const name = this.selectedStudent ? this.selectedStudent.name : '';
            const grado = gradoParam || this.selectedGrado;
            
            if (!id && !name) return;
            try {
                const res = await fetch(`${API_URL}?action=get_notas&alumno_id=${encodeURIComponent(id)}&nombre_alumno=${encodeURIComponent(name)}&grado_academico=${encodeURIComponent(grado)}`);
                const data = await res.json();
                this.selectedStudentNotas = (data.notas || []).map(r => this.mapNotaRow(r));
            } catch (err) {
                console.error('Error al cargar notas:', err);
                this.selectedStudentNotas = [];
            }
        },

        async saveNota() {
            if (!this.selectedStudent) return;

            try {
                const isEdit = !!this.isEditingNotaId;
                const actionName = isEdit ? 'edit_nota' : 'add_nota';
                const payload = {
                    action: actionName,
                    alumno_id: this.selectedStudent.id,
                    nombre_alumno: this.selectedStudent.name,
                    ...this.newNota
                };
                if (isEdit) payload.nota_id = this.isEditingNotaId;

                const res = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    this.showAddNotaModal = false;
                    this.isEditingNotaId = null;
                    
                    // Limpiar formulario sin perder el grado
                    const currentGrado = this.newNota.grado_academico;
                    this.resetForm();
                    this.newNota.grado_academico = currentGrado;

                    // Recarga total del estado
                    await this.refreshData();
                } else {
                    const text = await res.text();
                    console.error("Error from API:", text);
                    alert("Error al sincronizar: " + text);
                }
            } catch (err) {
                console.error('Error al guardar nota:', err);
                alert('Hubo un error al guardar o editar la nota. Revisa tu conexión.');
            }
        },

        resetForm() {
            this.isEditingNotaId = null;
            this.newNota = {
                curso: 'B2 EXAMS',
                reading: '',
                fecha_reading: new Date().toISOString().split('T')[0],
                writing: '',
                fecha_writing: new Date().toISOString().split('T')[0],
                listening: '',
                fecha_listening: new Date().toISOString().split('T')[0],
                grado_academico: ''
            };
        },

        async abrirModalEliminar(nota) {
            console.log("BORRADO: Click en papelera para nota ID:", nota.id);
            if (!nota || !nota.id) {
                console.error("BORRADO: Error - La nota no tiene ID o es inválida", nota);
                return;
            }
            if (confirm("\xbfEst\xe1s seguro de que deseas eliminar permanentemente esta nota?")) {
                this.notaToDelete = nota;
                await this.confirmarEliminarAction();
            }
        },

        async confirmarEliminarAction() {
            const nota = this.notaToDelete;
            if (!nota) return;
            console.log("BORRADO: Ejecutando borrado oficial para:", nota.id);
            this.showDeleteModal = false;
            this.notaToDelete = null;
            try {
                const res = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'delete_nota',
                        nota_id: nota.id
                    })
                });

                if (res.ok) {
                    this.selectedStudentNotas = this.selectedStudentNotas.filter(n => n.id !== nota.id);
                    await this.refreshData();
                } else {
                    const text = await res.text();
                    console.error('APP V5: Error API:', text);
                }
            } catch (err) {
                console.error('APP V5: Error Fatal:', err);
            }
        },

        async borrarNotaSkill(nota, skill) {
            const label = skill === 'reading' ? '1º Trimestre' : skill === 'writing' ? '2º Trimestre' : '3º Trimestre';
            if (!confirm(`¿Estás seguro de que deseas borrar permanentemente la nota del ${label}?`)) return;

            // Verificar si quedan otras notas en el mismo registro
            const otherFields = ['reading', 'writing', 'listening'].filter(s => s !== skill);
            const hasOtherFilled = otherFields.some(f => {
                const v = nota[f];
                return v !== '' && v !== null && v !== undefined;
            });

            console.log(`borrarNotaSkill: skill=${skill}, hasOtherFilled=${hasOtherFilled}, nota.id=${nota.id}`);

            if (!hasOtherFilled) {
                // Es la única nota: borrar fila completa
                this.notaToDelete = nota;
                await this.confirmarEliminarAction();
                return;
            }

            // Hay más notas: actualizar la fila vaciando solo este campo
            // Enviamos el registro completo para no perder datos por el ?? de PHP
            try {
                const payload = {
                    action: 'edit_nota',
                    nota_id: String(nota.id),
                    curso: nota.curso || '',
                    reading:        skill === 'reading'   ? '' : (nota.reading   || ''),
                    fecha_reading:  skill === 'reading'   ? '' : (nota.fecha_reading  || ''),
                    writing:        skill === 'writing'   ? '' : (nota.writing   || ''),
                    fecha_writing:  skill === 'writing'   ? '' : (nota.fecha_writing  || ''),
                    listening:      skill === 'listening' ? '' : (nota.listening  || ''),
                    fecha_listening:skill === 'listening' ? '' : (nota.fecha_listening || ''),
                    grado_academico: nota.grado_academico || ''
                };

                console.log('Payload borrar parcial:', payload);

                const res = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const responseText = await res.text();
                console.log('Respuesta borrar parcial:', res.status, responseText);

                if (res.ok) {
                    await this.refreshData();
                } else {
                    alert('Error al borrar nota: ' + responseText);
                }
            } catch (err) {
                console.error('Error fatal al borrar nota:', err);
            }
        },

        openAddNotaModal() {
            if (!this.selectedStudent) return;
            const grado = (this.selectedGrado === 'TODOS' ? this.selectedStudent.course : this.selectedGrado);

            this.resetForm();
            this.newNota.grado_academico = grado;
            this.newNota.curso = grado;
            this.showAddNotaModal = true;
        },

        editNota(nota) {
            this.isEditingNotaId = nota.id;
            const today = new Date().toISOString().split('T')[0];
            const hasVal = (v) => v !== '' && v !== null && v !== undefined;

            this.newNota = {
                id: nota.id,
                alumno_id: nota.alumno_id || nota.student_id,
                curso: nota.curso || 'B2 EXAMS',
                reading: nota.reading || '',
                fecha_reading: hasVal(nota.reading) ? nota.fecha_reading : today,
                writing: nota.writing || '',
                fecha_writing: hasVal(nota.writing) ? nota.fecha_writing : today,
                listening: nota.listening || '',
                fecha_listening: hasVal(nota.listening) ? nota.fecha_listening : today,
                grado_academico: nota.grado_academico || ''
            };
            this.selectedGrado = this.newNota.grado_academico;
            this.showAddNotaModal = true;
        },



        async searchAlumnoNotas() {
            if (!this.alumnoSearchQuery.trim()) return;

            try {
                const res = await fetch(`${API_URL}?action=get_all_notas`);
                const data = await res.json();

                if (matches.length > 0) {
                    this.alumnoResult = { name: matches[0].nombre_alumno };
                    this.alumnoResultNotas = (data.rows || []).map(r => this.mapNotaRow(r))
                        .filter(n => n.nombre_alumno.toLowerCase().includes(query));
                } else {
                    alert('No se encontraron notas para ese nombre.');
                    this.alumnoResult = null;
                }
            } catch (err) {
                console.error(err);
                alert('Error al buscar notas.');
            }
        },

        // --- CÁLCULOS ---
        isExamGrade(grado) {
            if (!grado || typeof grado !== 'string') return false;
            const g = grado.toUpperCase();
            // Detectar si el grado es explícitamente un examen (B1/B2/C1 EX o EXAM)
            const hasLevel = g.includes('B1') || g.includes('B2') || g.includes('C1');
            const hasEx = g.includes('EX') || g.includes('EXAM');
            return hasLevel && hasEx;
        },

        calculateMediaSkill(skill) {
            const grado = (this.selectedGrado || '').toUpperCase();
            const isExam = this.isExamGrade(grado);

            // Cogemos las últimas 3 notas que tengan valor para este skill (las más recientes por fecha)
            const notas = [...this.selectedStudentNotas]
                .filter(n => n[skill] !== '' && n[skill] !== null)
                .sort((a, b) => {
                    const da = new Date(a[`fecha_${skill}`] || 0);
                    const db = new Date(b[`fecha_${skill}`] || 0);
                    return db - da; // Más reciente primero
                })
                .slice(0, 3);

            if (notas.length === 0) return '--';

            if (!isExam) {
                // Para no-exámenes (Trimestres), devolvemos la última nota bruta
                return notas[0][skill];
            }

            let sum = 0;
            notas.forEach(n => {
                const cursoOriginal = (n.curso || 'B2 EXAMS').toUpperCase();
                
                // Lookup inteligente: buscar si el nombre del curso contiene B1, B2 o C1
                let cursoKey = 'B2 EXAMS'; // Fallback
                if (cursoOriginal.includes('B1')) cursoKey = 'B1 EXAMS';
                else if (cursoOriginal.includes('B2')) cursoKey = 'B2 EXAMS';
                else if (cursoOriginal.includes('C1')) cursoKey = 'C1 EXAMS';

                const max = this.maximos[cursoKey] ? this.maximos[cursoKey][skill] : 10;
                const valor = (parseFloat(n[skill]) / max) * 10;
                sum += valor;
            });

            return (sum / notas.length).toFixed(2);
        },

        getAprobadoStatus() {
            const media = parseFloat(this.calculateMediaGeneral());
            if (isNaN(media) || media === 0) return { text: 'PENDIENTE', class: 'bg-slate-100 text-slate-500' };

            const grado = (this.selectedGrado || '').toUpperCase();
            let threshold = 6.0; // B2 y C1 aprueban con 6
            if (grado.includes('B1')) threshold = 7.0; // B1 aprueba con 7

            if (media >= threshold) {
                return { text: 'APROBADO', class: 'bg-emerald-100 text-emerald-700' };
            } else {
                return { text: 'SUSPENSO', class: 'bg-rose-100 text-rose-700' };
            }
        },

        calculateMediaGeneral() {
            const grado = this.selectedGrado;
            if (!this.isExamGrade(grado)) return '---';

            const r = this.calculateMediaSkill('reading');
            const w = this.calculateMediaSkill('writing');
            const l = this.calculateMediaSkill('listening');

            const vals = [r, w, l].filter(v => v !== '--').map(v => parseFloat(v));
            if (vals.length === 0) return '0.00';

            return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2);
        },

        // --- EXPORTACIÓN Y COMUNICACIÓN ---
        async sendWhatsApp(contact) {
            if (!contact || !this.selectedStudent) return;

            // 1. Exportar PDF en background
            this.downloadPDF(true);

            // 1b. Auto-marcar checks de trimestre si existen notas
            if (!this.isExamGrade(this.selectedGrado)) {
                const sId = this.getStudentId(this.selectedStudent.name, this.selectedStudent.contact || this.selectedStudent._contact);
                const checks = this.trimesterChecks[sId] || { t1: false, t2: false, t3: false, t3_date: null };
                
                let updated = false;
                if (this.calculateMediaSkill('reading') !== '--') {
                    if (!checks.t1) { checks.t1 = true; updated = true; }
                }
                if (this.calculateMediaSkill('writing') !== '--') {
                    if (!checks.t2) { checks.t2 = true; updated = true; }
                }
                if (this.calculateMediaSkill('listening') !== '--') {
                    if (!checks.t3) { 
                        checks.t3 = true; 
                        checks.t3_date = new Date().toISOString();
                        updated = true; 
                    }
                }

                if (updated) {
                    this.trimesterChecks[sId] = { ...checks };
                    this.trimesterChecks = { ...this.trimesterChecks }; // Reactividad para botones en la lista
                    
                    // Persistir
                    fetch(`${API_URL}?action=save_trimester_checks`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'save_trimester_checks', studentId: sId, checks })
                    });
                    this.searchContacts(); // Actualizar lista
                }
            }

            // 2. Nombre completo
            const name = this.selectedStudent.name;
            const isExam = this.isExamGrade(this.selectedGrado);

            // 3. Calcular la nota que determina el mensaje
            let scoreForMessage = 0;

            if (isExam) {
                // Para exámenes: usar la media general de skills (sobre 10)
                const vals = ['reading', 'writing', 'listening']
                    .map(s => parseFloat(this.calculateMediaSkill(s)))
                    .filter(v => !isNaN(v));
                scoreForMessage = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
            } else {
                // Para NO-exámenes: usar la ÚLTIMA nota registrada (la más reciente)
                // selectedStudentNotas tiene las notas del alumno en el curso actual
                const notasDelCurso = (this.selectedStudentNotas || []).filter(n =>
                    n.curso === this.selectedGrado || n.grado_academico === this.selectedGrado
                );
                if (notasDelCurso.length > 0) {
                    // Ordenar por fecha más reciente (o tomar la última del array si no hay fecha)
                    const sorted = [...notasDelCurso].sort((a, b) => {
                        const da = new Date(a.fecha_reading || a.fecha_writing || a.fecha_listening || 0);
                        const db = new Date(b.fecha_reading || b.fecha_writing || b.fecha_listening || 0);
                        return db - da;
                    });
                    const last = sorted[0];
                    // Tomar la nota que tenga valor en la última entrada (en orden T1 → T2 → T3)
                    const lastVal = parseFloat(last.reading || last.writing || last.listening || 0);
                    scoreForMessage = isNaN(lastVal) ? 0 : lastVal;
                }
            }

            // 4. Elegir mensaje según la nota del repositorio dinámico
            const t = this.whatsappTemplates;
            let template = '';

            if (isExam) {
                if (scoreForMessage >= 9) template = t.notas_exam_wow;
                else if (scoreForMessage >= 7) template = t.notas_exam_good;
                else if (scoreForMessage >= 5) template = t.notas_exam_path;
                else template = t.notas_exam_error;
            } else {
                if (scoreForMessage >= 9) template = t.notas_trim_wow;
                else if (scoreForMessage >= 7) template = t.notas_trim_good;
                else if (scoreForMessage >= 5) template = t.notas_trim_path;
                else template = t.notas_trim_error;
            }

            // Fallbacks si no hay plantillas (seguridad)
            if (!template) {
                if (isExam) {
                    if (scoreForMessage >= 9) template = `WOW, *{nombre}*!!! Tus notas en *YES OF COURSE* son increíbles!! Tienes el PDF con el detalle adjunto.\n\n*"The limit is the sky"* y tú estás volando alto.\n\nEstamos súper orgullosos de tu nivel!!! Enjoy your success!!!`;
                    else if (scoreForMessage >= 7) template = `Hi, *{nombre}*!! Vaya nota has sacado en *YES OF COURSE*!! Échale un vistazo al PDF con el detalle.\n\nEstás muy cerca de la cima. Recuerda: *"Consistency is the key to success"*\n\nSigue brillando así!!! Great job!!!`;
                    else if (scoreForMessage >= 5) template = `Hey, *{nombre}*!! Ya tienes tu nota de *YES OF COURSE* disponibles en el PDF adjunto.\n\nVas por buen camino!!! Sigue dándole duro porque *"Small steps, big results"* es la clave.\n\nA por el siguiente nivel, you can do it!!`;
                    else template = `Hello, *{nombre}*!!! Ya están aquí tus notas de *YES OF COURSE*. Te enviamos el PDF con el detalle.\n\nDon't worry!! *"Every expert was once a beginner"*\n\nEstamos aquí para ayudarte a darle la vuelta a este resultado!! Let's work together!!!`;
                } else {
                    if (scoreForMessage >= 9) template = `WOW, *{nombre}*!!! Tus notas en *YES OF COURSE* son increíbles!! Tienes el PDF con el detalle adjunto.\n\n*"The limit is the sky"* y tú estás volando alto.\n\nEstamos súper orgullosos de tu nivel!!! Enjoy your success!!!`;
                    else if (scoreForMessage >= 7) template = `Hi, *{nombre}*!! Vaya nota has sacado en *YES OF COURSE*!! Échale un vistazo al PDF con el detalle.\n\nEstás muy cerca de la cima. Recuerda: *"Consistency is the key to success"*\n\nSigue brillando así!!! Great job!!!`;
                    else if (scoreForMessage >= 5) template = `Hey, *{nombre}*!! Ya tienes tu nota de *YES OF COURSE* disponibles en el PDF adjunto.\n\nVas por buen camino!!! Sigue dándole duro porque *"Small steps, big results"* es la clave.\n\nA por el siguiente nivel, you can do it!!`;
                    else template = `Hello, *{nombre}*!!! Ya están aquí tus notas de *YES OF COURSE*. Te enviamos el PDF con el detalle.\n\nDon't worry!! *"Every expert was once a beginner"*\n\nEstamos aquí para ayudarte a darle la vuelta a este resultado!! Let's work together!!!`;
                }
            }

            // Reemplazar nombre
            let message = template.replace(/{nombre}/g, name);

            // 5. Abrir WhatsApp
            const phone = contact.phone ? contact.phone.replace(/^\+/, '') : '';
            if (phone) {
                const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
                window.open(url, '_blank');
            } else {
                alert('El alumno no tiene teléfono registrado para WhatsApp.');
            }
        },

        async downloadPDF(isBackground = false) {
            console.log("Iniciando generación de PDF...");
            const originalElement = document.getElementById('pdf-report-template');
            if (!originalElement) return;
            
            let btn = null;
            let originalText = '';
            
            if (!isBackground) {
                btn = document.getElementById('download-pdf-btn');
                if (btn) {
                    originalText = btn.innerHTML;
                    btn.innerHTML = '<span class="flex items-center gap-2"><svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Generando...</span>';
                    btn.disabled = true;
                }
            }

            // CREAR UN CLON PARA NO ROMPER EL DOM NI ALPINE JS
            const clone = originalElement.cloneNode(true);
            
            // PARCHEAR EL CLON: Alpine.js x-show/x-text no se re-evalúan en el clon
            const student = this.selectedStudent;
            const note = (this.sheetMeta[this.selectedGrado] && this.sheetMeta[this.selectedGrado].note) || '';
            const video = this.selectedCourseVideo || '';
            const qr = this.selectedCourseQR || '';
            
            // 0. Parchear Cabecera vía IDs directos (Máxima prioridad)
            const idMap = {
                'pdf-student-name': student ? student.name : (this.selectedStudent?.name || ''),
                'pdf-student-email': (student && student.email !== 'Sin email') ? student.email : '',
                'pdf-selected-grado': this.selectedGrado || '',
                'pdf-course-name': this.selectedCourseName || ''
            };

            Object.entries(idMap).forEach(([id, val]) => {
                const els = clone.querySelectorAll(`#${id}`); 
                els.forEach(el => {
                    el.innerText = val;
                });
            });

            // Parchear Logo e Info Box
            const logoImg = clone.querySelector('#pdf-course-icon');
            if (logoImg) {
                logoImg.src = this.sheetMeta[this.selectedGrado]?.icon || '../CertificadosAgenciaTributaria/logo.png';
            }

            const infoBox = clone.querySelector('#pdf-student-info-box');
            if (infoBox) {
                infoBox.style.backgroundColor = '#163675';
                infoBox.style.display = 'flex';
            }

            // 1. Parchear Notas (Caja Azul de información)
            const noteContainer = clone.querySelector('#pdf-info-note-container');
            if (noteContainer) {
                if (!this.isExamGrade(this.selectedGrado) && note) {
                    noteContainer.style.display = 'block';
                    const ntText = noteContainer.querySelector('#pdf-info-note-text');
                    if (ntText) ntText.innerHTML = note; 
                } else {
                    noteContainer.style.display = 'none';
                }
            }

            // 2. Parchear Multimedia (QR + Video)
            const multimediaBox = clone.querySelector('[x-show*="selectedCourseVideo || selectedCourseQR"]');
            if (multimediaBox) {
                multimediaBox.style.display = (video || qr) ? 'block' : 'none';
                if (video || qr) {
                    const qrSection = multimediaBox.querySelector('[x-show*="selectedCourseQR"]');
                    if (qrSection && qr) {
                        qrSection.style.display = 'flex';
                        const qrImg = qrSection.querySelector('img');
                        if (qrImg) qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qr)}&size=150x150&color=1A365D`;
                    }
                    const videoSection = multimediaBox.querySelector('[x-show*="selectedCourseVideo"]');
                    if (videoSection && video) {
                        videoSection.style.display = 'flex';
                        const yid = this.getYoutubeId(video);
                        const videoImg = videoSection.querySelector('img');
                        if (videoImg && yid) videoImg.src = `https://img.youtube.com/vi/${yid}/mqdefault.jpg`;
                    }
                }
            }

            // 3. Parchear Calificaciones (1T, 2T, 3T)
            const readingVal = this.calculateMediaSkill('reading');
            const writingVal = this.calculateMediaSkill('writing');
            const listeningVal = this.calculateMediaSkill('listening');

            const rBox = clone.querySelector('[x-text*="calculateMediaSkill(\'reading\')"]');
            if (rBox) rBox.innerText = readingVal;

            const wBox = clone.querySelector('[x-text*="calculateMediaSkill(\'writing\')"]');
            if (wBox) wBox.innerText = writingVal;

            const lBox = clone.querySelector('[x-text*="calculateMediaSkill(\'listening\')"]');
            if (lBox) lBox.innerText = listeningVal;

            // 4. Parchear etiquetas de trimestres/skills
            clone.querySelectorAll('[x-show*="isExamGrade"]').forEach(el => {
                const isExam = this.isExamGrade(this.selectedGrado);
                const expr = el.getAttribute('x-show');
                if (expr === 'isExamGrade(selectedGrado)') el.style.display = isExam ? 'inline' : 'none';
                if (expr === '!isExamGrade(selectedGrado)') el.style.display = !isExam ? 'inline' : 'none';
            });
            
            // CONTENEDOR TEMPORAL
            const wrapper = document.createElement('div');
            wrapper.style.position = 'absolute';
            wrapper.style.top = window.scrollY + 'px'; 
            wrapper.style.left = '-9999px'; 
            wrapper.style.width = '794px'; 
            wrapper.style.height = '1120px'; 
            wrapper.style.zIndex = '-9999';
            wrapper.style.background = 'white';
            
            clone.style.display = 'flex';
            clone.style.width = '794px';
            clone.style.height = '1120px';
            clone.style.backgroundColor = 'white';
            
            wrapper.appendChild(clone);
            document.body.appendChild(wrapper);

            const opt = {
                margin: 0,
                filename: `Informe_${this.selectedStudent.name.replace(/\s+/g, '_')}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { 
                    scale: 2, 
                    useCORS: true, 
                    logging: false,
                    scrollY: window.scrollY
                },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    html2pdf().from(clone).set(opt).save().then(() => {
                        document.body.removeChild(wrapper);
                        if (!isBackground) {
                            this.showPdfPreviewModal = false;
                            if (btn) {
                                btn.innerHTML = originalText;
                                btn.disabled = false;
                            }
                        }
                        resolve();
                    }).catch(err => {
                        console.error('Error PDF:', err);
                        if (wrapper.parentNode) document.body.removeChild(wrapper);
                        if (!isBackground && btn) {
                            btn.innerHTML = originalText;
                            btn.disabled = false;
                        }
                        reject(err);
                    });
                }, 300);
            });
        },

        // --- LÓGICA DE INFORMES HISTÓRICOS ---
        getSnapshotStudents(snapshot) {
            if (!snapshot || !snapshot.data) return [];
            const students = {};
            
            // Asegurar que snapshot.data se trate como un array incluso si viene como objeto
            const dataArray = Array.isArray(snapshot.data) ? snapshot.data : Object.values(snapshot.data);
            
            dataArray.forEach(row => {
                if (!row || !row[1]) return;
                const name = row[1];
                if (!students[name]) {
                    students[name] = {
                        name: name,
                        media: row[9] || '--',
                        rows: []
                    };
                }
                students[name].rows.push(row);
            });
            return Object.values(students).sort((a, b) => a.name.localeCompare(b.name));
        },


        async printHistoricalStudent(snapshot, studentName) {
            console.log("Preparando impresión histórica para:", studentName);
            
            // 1. Encontrar todas las filas del alumno en este snapshot
            const dataArray = Array.isArray(snapshot.data) ? snapshot.data : Object.values(snapshot.data);
            const historicalRows = dataArray.filter(row => row && row[1] === studentName);
            if (historicalRows.length === 0) return;

            // 2. Preparar el estado TEMPORAL para downloadPDF
            const originalSelectedStudent = this.selectedStudent;
            const originalSelectedStudentNotas = this.selectedStudentNotas;
            const originalSelectedGrado = this.selectedGrado;
            const originalSelectedCourseName = this.selectedCourseName;

            // Mapear filas al formato que entiende el PDF
            const mappedNotas = historicalRows.map(r => this.mapNotaRow(r));
            
            // Mock de estudiante
            this.selectedStudent = {
                id: historicalRows[0][0],
                name: historicalRows[0][1],
                email: 'Sin email',
                course: snapshot.course
            };

            // Intentar buscar contacto real para el email/phone
            const contact = this.findContactByStudentName(studentName);
            if (contact) {
                this.selectedStudent.email = contact.email;
                this.selectedStudent.phone = contact.phone;
            }

            this.selectedStudentNotas = mappedNotas;
            this.selectedGrado = snapshot.course;
            this.selectedCourseName = (this.sheetMeta[snapshot.course] && this.sheetMeta[snapshot.course].c2) || snapshot.course;

            // 3. Generar PDF y borrar (sin esperas infinitas que puedan fallar)
            setTimeout(() => {
                this.downloadPDF(true); 
                
                // Borrar tras 1.5 segundos (tiempo de sobra para capturar el PDF)
                setTimeout(async () => {
                    console.log("Procediendo al borrado automático...");
                    await this.deleteHistoricalStudent(snapshot.date, studentName, snapshot.course);
                    
                    // Forzar limpieza del bloque si no hay más alumnos
                    const sn = this.snapshots.find(s => s.date === snapshot.date);
                    if (sn && (!sn.data || sn.data.length === 0)) {
                        this.snapshots = this.snapshots.filter(s => s.date !== snapshot.date);
                    }
                }, 1500);

                // 5. Restaurar estado tras 3 segundos
                setTimeout(() => {
                    if (this.selectedStudent && this.selectedStudent.name === studentName) {
                        this.selectedStudent = originalSelectedStudent;
                        this.selectedStudentNotas = originalSelectedStudentNotas;
                        this.selectedGrado = originalSelectedGrado;
                        this.selectedCourseName = originalSelectedCourseName;
                    }
                }, 3000);
            }, 500);
        },


        async getServerInfo() {
            try {
                const res = await fetch(API_URL + '?action=get_server_info');
                const data = await res.json();
                alert(`CARPETA DEL SERVIDOR: ${data.dir}\nFECHA ARCHIVO: ${data.mtime}\nPERMISOS: ${data.writable ? 'OK' : 'ERROR'}`);
            } catch (e) {
                alert("Error al obtener info del servidor");
            }
        },

        async deleteHistoricalStudent(date, studentName, course) {
            console.log("Borrando del histórico:", studentName, date);
            try {
                const res = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'delete_historical_student',
                        date: date,
                        studentName: studentName,
                        course: course
                    })
                });
                
                if (res.ok) {
                    const data = await res.json();
                    if (data.snapshots) {
                        this.snapshots = Array.isArray(data.snapshots) ? data.snapshots : Object.values(data.snapshots);
                    }
                    console.log("Borrado exitoso. Snapshots restantes:", this.snapshots.length);
                }
            } catch (e) {
                console.error(e);
            }
        }

    };
}

