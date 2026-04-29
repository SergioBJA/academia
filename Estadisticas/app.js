const API_URL = '/api';

function statsApp() {
    return {
        loading: false,
        stats: {
            monthly: [],
            total_students: 0,
            total_active: 0,
            total_inactive: 0
        },
        selectedMonth: null,
        expandedMonth: null,

        toggleBreakdown(month) {
            this.expandedMonth = this.expandedMonth === month ? null : month;
        },

        async init() {
            await this.refreshData();
        },

        async refreshData() {
            this.loading = true;
            try {
                const response = await fetch(`${API_URL}?action=get_statistics`);
                const data = await response.json();
                
                if (data.success) {
                    this.stats = data;
                    // Seleccionar el mes más reciente por defecto si hay datos
                    if (this.stats.monthly && this.stats.monthly.length > 0) {
                        this.selectedMonth = this.stats.monthly[this.stats.monthly.length - 1];
                    }
                } else {
                    console.error("Error en la API:", data.error);
                }
            } catch (error) {
                console.error("Error al cargar estadísticas:", error);
            } finally {
                this.loading = false;
            }
        },

        get reversedMonthly() {
            return [...(this.stats.monthly || [])].reverse();
        },

        formatMonth(monthStr) {
            if (!monthStr) return '';
            const [year, month] = monthStr.split('-');
            const months = [
                'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
            ];
            return `${months[parseInt(month) - 1]} ${year}`;
        },

        getInitials(name) {
            if (!name) return '?';
            return name
                .split(',')
                .map(part => part.trim().charAt(0))
                .join('')
                .toUpperCase()
                .substring(0, 2);
        }
    }
}
