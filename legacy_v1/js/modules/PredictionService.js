
export class PredictionService {
    constructor(store) {
        this.store = store;
    }

    calculateReliability(patientId) {
        if (!patientId) return null;

        const appointments = this.store.state.appointments || [];
        const history = appointments.filter(a => a.patientId === patientId && (a.status === 'done' || a.status === 'cancelled' || a.status === 'noshow'));

        if (history.length < 3) {
            return {
                score: 100,
                level: 'unknown',
                color: 'bg-gray-400',
                reason: 'Datos insuficientes (Nuevo)'
            };
        }

        let cancellations = 0;
        let noShows = 0;
        let total = history.length;

        // Day of week stats
        const dayStats = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }; // 0=Sun
        const dayFails = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

        history.forEach(a => {
            const d = new Date(a.start);
            const day = d.getDay();
            dayStats[day]++;

            if (a.status === 'cancelled') {
                cancellations++;
                dayFails[day]++;
            } else if (a.status === 'noshow') {
                noShows++;
                dayFails[day]++;
            }
        });

        // Weights: NoShow is worse than Cancelled
        const penalty = (cancellations * 1) + (noShows * 3);
        // Heuristic: Max penalty per unit. 
        // If 100% cancelled => penalty = total. Score = 0.
        // If 100% noshow => penalty = total*3. Score needs clamping.

        let rawScore = 100 - ((penalty / total) * 100);
        if (rawScore < 0) rawScore = 0;

        // Trends
        let trend = '';
        let worstDay = -1;
        let worstRate = 0;

        for (let i = 0; i <= 6; i++) {
            if (dayStats[i] > 2) { // Min 3 appts on that day to judge
                const rate = dayFails[i] / dayStats[i];
                if (rate > 0.5 && rate > worstRate) {
                    worstRate = rate;
                    worstDay = i;
                }
            }
        }

        if (worstDay !== -1) {
            const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
            trend = `Falla a menudo los ${days[worstDay]}.`;
            rawScore -= 10; // Extra penalty for predictable fail
        }

        // Levels
        let level = 'high'; // Green
        let color = 'bg-green-500';
        let reason = 'Paciente fiable.';

        if (rawScore < 50) {
            level = 'low'; // Red
            color = 'bg-red-500';
            reason = 'Muy alta tasa de cancelaciones.';
        } else if (rawScore < 80) {
            level = 'medium'; // Orange
            color = 'bg-amber-500';
            reason = 'Fiabilidad media. Algunas cancelaciones.';
        }

        if (trend) reason += ' ' + trend;

        return {
            score: Math.round(rawScore),
            level,
            color,
            reason
        };
    }
}
