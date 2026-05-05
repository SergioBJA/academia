/**
 * Lógica principal de la aplicación Alpine.js
 * Encargada de reactividad, cálculos y exportación PDF/Comunicación Backend
 */
const GOOGLE_CLIENT_ID = '862884316906-q5gs2ta79bg7v16vdnduddtsc0iirqqg.apps.googleusercontent.com';
function certificadoApp() {
    return {
        // Estado
        isDarkMode: ThemeManager.isDark(),
        toggleTheme() { this.isDarkMode = ThemeManager.toggle(); },
        studentName: '',
        studentPhone: '',
        fiscalYear: new Date().getFullYear() - 1,
        monthlyCost: '',
        materialsCost: '',
        extraItems: [], // Array para almacenar conceptos extra dinámicos
        contactsList: [], // Lista parseada desde el CSV
        allStudents: [], // Lista global de alumnos desde Sheets
        filteredStudents: [], // Resultados de la búsqueda
        showStudentsDropdown: false, // Control del dropdown
        whatsappTemplate: '', // Plantilla dinámica desde app_data.json

        // Estado de UI / Red
        isExporting: false,
        isGoogleConnected: false,
        googleTokenClient: null,

        init() {
            // Asegurar año fiscal correcto (un año menos del actual)
            this.fiscalYear = new Date().getFullYear() - 1;

            // Inicializar Google Centralizado
            if (window.GoogleAuthCentral) {
                GoogleAuthCentral.init((token) => this.fetchGoogleContacts(token));
                GoogleAuthCentral.setupAlpineSync(this);
            }
            
            // Cargar alumnos para el buscador total
            this.fetchAllStudentsSheet();
            
            // Cargar configuración de WhatsApp
            this.fetchWebConfig();
        },



        // Computed (si volvieras a necesitar el total, se sumaría extraItems aquí)
        get totalCost() {
            const mensual = parseFloat(this.monthlyCost) || 0;
            const materiales = parseFloat(this.materialsCost) || 0;
            const extras = this.extraItems.reduce((acc, item) => acc + (parseFloat(item.price) || 0), 0);
            return mensual + materiales + extras;
        },

        // Métodos Utilitarios
        formatCurrency(value) {
            const num = parseFloat(value) || 0;
            if (num === 0 && !value) return ''; // Evita mostrar 0,00 € por defecto si está vacío
            return new Intl.NumberFormat('es-ES', {
                style: 'currency',
                currency: 'EUR',
                minimumFractionDigits: 2
            }).format(num);
        },

        // Métodos de Lista Dinámica
        addExtraItem() {
            this.extraItems.push({ name: '', price: '' });
        },
        removeExtraItem(index) {
            this.extraItems.splice(index, 1);
        },

        // Métodos de Agenda Contactos: API Google
        connectGoogle() {
            GoogleAuthCentral.connect();
        },

        disconnectGoogle() {
            GoogleAuthCentral.logout();
        },

        async fetchGoogleContacts(token) {
            try {
                // Pide hasta 2000 contactos (ajustable), solicitando nombre y números telefónicos
                const response = await fetch('https://people.googleapis.com/v1/people/me/connections?personFields=names,phoneNumbers&pageSize=2000', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                const data = await response.json();

                if (data.connections && data.connections.length > 0) {
                    this.contactsList = data.connections.map(person => {
                        let name = '';
                        let phone = '';

                        if (person.names && person.names.length > 0) {
                            name = person.names[0].displayName.toLowerCase();
                        }
                        if (person.phoneNumbers && person.phoneNumbers.length > 0) {
                            // Toma el primer número disponible
                            phone = person.phoneNumbers[0].value;
                        }

                        return { name, phone };
                    }).filter(c => c.name && c.phone);

                    console.log(`Cargados ${this.contactsList.length} contactos desde Google People API.`);
                    this.searchContact(); // Revisar si ya hay un nombre escrito que coincida
                } else {
                    alert('No se encontraron contactos con número de teléfono guardados en esta cuenta de Google.');
                }
            } catch (error) {
                console.error('Error al descargar contactos:', error);
                // Let central auth handle reconnection logic
            }
        },

        async fetchAllStudentsSheet() {
            try {
                const res = await fetch('/api?action=get_all_students');
                if (res.ok) {
                    const data = await res.json();
                    if (data.students) {
                        this.allStudents = data.students;
                    }
                }
            } catch (err) {
                console.error('Error al cargar la lista global de alumnos:', err);
            }
        },

        async fetchWebConfig() {
            try {
                const res = await fetch('/api?action=get_web_config');
                const data = await res.json();
                if (data.success && data.web_config && data.web_config.whatsapp_templates) {
                    this.whatsappTemplate = data.web_config.whatsapp_templates.certificados;
                }
            } catch (e) {
                console.error('Error fetching web config:', e);
            }
        },
        normalizeStr(str) {
            if (!str) return '';
            return str.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        },

        filterStudents() {
            const term = this.normalizeStr(this.studentName).trim();
            if (term.length < 2) {
                this.filteredStudents = [];
                this.showStudentsDropdown = false;
                
                // Mantenemos vinculación con contactos (teléfono)
                this.searchContact();
                return;
            }
            
            // Buscar coincidencias parciales en cualquier orden
            const searchTerms = this.normalizeStr(term).split(' ').filter(t => t.length > 0);
            this.filteredStudents = this.allStudents.filter(student => {
                const studentNameNorm = this.normalizeStr(student.name);
                return searchTerms.every(t => studentNameNorm.includes(t));
            });
            
            this.showStudentsDropdown = this.filteredStudents.length > 0;
            
            // Mantenemos vinculación con contactos (teléfono)
            this.searchContact();
        },

        selectStudent(student) {
            this.studentName = student.name;
            this.showStudentsDropdown = false;
            
            // Mantenemos vinculación con contactos (teléfono)
            this.searchContact();
        },

        searchContact() {
            if (!this.studentName.trim() || this.contactsList.length === 0) {
                this.studentPhone = '';
                return;
            }

            const searchTerms = this.normalizeStr(this.studentName).split(' ').filter(term => term.length > 2);

            if (searchTerms.length === 0) {
                this.studentPhone = '';
                return;
            }

            const found = this.contactsList.find(contact => {
                const contactNameNorm = this.normalizeStr(contact.name);
                return searchTerms.every(term => contactNameNorm.includes(term));
            });

            if (found) {
                // Limpiar teléfono para que sirva a whatsapp (quitar espacios, guiones, y asegurarse de tener prefijo internacional si se quiere, o limpiar locales)
                let cleanPhone = found.phone.replace(/[\s\-\(\)\+]/g, '');
                // asumimos españa si empiezan por 6 o 7
                if (cleanPhone.length === 9 && (cleanPhone.startsWith('6') || cleanPhone.startsWith('7'))) {
                    cleanPhone = '34' + cleanPhone;
                }
                this.studentPhone = cleanPhone;
            } else {
                this.studentPhone = '';
            }
        },

        resetForm() {
            this.studentName = '';
            this.studentPhone = '';
            this.monthlyCost = '';
            this.materialsCost = '';
            this.extraItems = [];
            this.fiscalYear = new Date().getFullYear() - 1;
            this.filteredStudents = [];
            this.showStudentsDropdown = false;
        },

        // Acción Principal: Exportar a PDF
        async exportPDF(shouldReset = true) {
            this.isExporting = true;

            try {
                // Formatear nombre: Apellido_Apellido_Nombre_Año_Certificado.pdf
                let formattedName = 'Vacio';
                if (this.studentName) {
                    const nameParts = this.studentName.trim().split(/\s+/);
                    if (nameParts.length >= 3) {
                        // Caso común: Nombre Apellido1 Apellido2 -> Apellido1_Apellido2_Nombre
                        const firstNames = nameParts.slice(0, nameParts.length - 2).join('_');
                        const lastNames = nameParts.slice(nameParts.length - 2).join('_');
                        formattedName = `${lastNames}_${firstNames}`;
                    } else if (nameParts.length === 2) {
                        // Caso: Nombre Apellido -> Apellido_Nombre
                        formattedName = `${nameParts[1]}_${nameParts[0]}`;
                    } else {
                        formattedName = this.studentName.trim().replace(/\s+/g, '_');
                    }
                }

                const opt = {
                    margin: 0,
                    filename: `${formattedName}_${this.fiscalYear}_Certificado.pdf`,
                    image: { type: 'jpeg', quality: 1 },
                    html2canvas: {
                        scale: 2,
                        useCORS: true,
                        logging: false,
                        scrollY: 0
                    },
                    pagebreak: { mode: 'avoid-all' },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true }
                };

                const element = document.getElementById('certificado-a4');
                const fileName = `${formattedName}_${this.fiscalYear}_Certificado.pdf`;

                let fileHandle = null;

                // 1. Pedir permiso/ruta de guardado PRIMERO (User Gesture activo)
                if (window.showSaveFilePicker) {
                    try {
                        fileHandle = await window.showSaveFilePicker({
                            id: 'descarga_certificados_academia',
                            suggestedName: fileName,
                            types: [{
                                description: 'Documento PDF',
                                accept: { 'application/pdf': ['.pdf'] },
                            }],
                        });
                    } catch (e) {
                        if (e.name === 'AbortError') {
                            console.log('El usuario canceló el diálogo de guardado.');
                            return; 
                        }
                        throw e;
                    }
                }

                // 2. Generar el PDF (operación pesada)
                const blob = await html2pdf().set(opt).from(element).output('blob');

                // 3. Escribir el archivo en la ruta elegida o usar fallback
                if (fileHandle) {
                    const writableStream = await fileHandle.createWritable();
                    await writableStream.write(blob);
                    await writableStream.close();
                } else {
                    // Fallback: Descarga directa (comportamiento estándar o en móviles)
                    await html2pdf().set(opt).from(element).save();
                }

                if (shouldReset) {
                    this.resetForm();
                }

            } catch (error) {
                console.error('Error crítico al generar PDF:', error);
                alert('Hubo un error al generar el archivo PDF.');
            } finally {
                this.isExporting = false;
            }
        },

        // Acción: Generar el PDF y luego compartir por WhatsApp
        async shareToWhatsApp() {
            // Guardar datos necesarios antes del posible reset
            const nombreAlumno = this.studentName.trim();
            const telefonoAlumno = this.studentPhone;
            const añoFiscal = this.fiscalYear;

            // Generar el PDF sin resetear todavía
            await this.exportPDF(false);

            // Preparar el mensaje usando la plantilla o fallback
            let mensaje = this.whatsappTemplate;
            if (!mensaje) {
                mensaje = "Hola, {nombre_condicional}adjunto el certificado de la Agencia Tributaria correspondiente al alumno/a *{nombre}*, perteneciente al año fiscal *{año}*.\n\nEl PDF con el certificado detallado acaba de ser descargado en tu dispositivo. (Acuérdate de adjuntarlo en este chat usando el clip 📎). ¡Gracias!";
            }

            // Reemplazar placeholders
            mensaje = mensaje.replace(/{nombre_condicional}/g, "");
            mensaje = mensaje.replace(/{nombre}/g, nombreAlumno || "el alumno/a");
            mensaje = mensaje.replace(/{año}/g, añoFiscal);

            // Codificar el texto para la URL
            const textoCodificado = encodeURIComponent(mensaje);

            // Construir el enlace universal
            let url = `https://api.whatsapp.com/send?text=${textoCodificado}`;

            if (telefonoAlumno) {
                url += `&phone=${telefonoAlumno}`;
            }

            // Abrir Whatsapp en una nueva pestaña
            setTimeout(() => {
                window.open(url, '_blank');
                // Resetear el formulario al final
                this.resetForm();
            }, 500);
        }
    }
}
