import React, { useCallback, useEffect, useState } from 'react';
import { adminGetDoc } from '../../services/backendApi.js';
import { adminAlign } from './adminUi.js';

const AdminStockAlerts = ({ lang = 'ar' }) => {
    const isAr = lang === 'ar';
    const [alert, setAlert] = useState(null);

    const loadAlerts = useCallback(async () => {
        try {
            let settingsSnap = null;
            let baseSnap = null;
            try {
                [settingsSnap, baseSnap] = await Promise.all([
                    adminGetDoc('admin_settings/general'),
                    adminGetDoc('configurator_settings/general')
                ]);
            } catch {
                return;
            }

            const { path: sp, id: si, ...settingsData } = settingsSnap && typeof settingsSnap === 'object' ? settingsSnap : {};
            void sp;
            void si;
            const { path: bp, id: bi, ...baseData } = baseSnap && typeof baseSnap === 'object' ? baseSnap : {};
            void bp;
            void bi;

            const threshold = Number(settingsData.baseControllerLowStockThreshold);
            const lowThreshold = Number.isFinite(threshold) && threshold >= 0 ? threshold : 5;
            const qty = Number(baseData.quantity) || 0;

            if (qty <= lowThreshold) {
                setAlert({
                    qty,
                    threshold: lowThreshold,
                    isOut: qty <= 0
                });
            } else {
                setAlert(null);
            }
        } catch (err) {
            console.error('Failed to load stock alerts', err);
        }
    }, []);

    useEffect(() => {
        loadAlerts();
        const interval = window.setInterval(loadAlerts, 60000);
        return () => window.clearInterval(interval);
    }, [loadAlerts]);

    if (!alert) return null;

    return (
        <div
            className={`admin-alert-banner ${alert.isOut ? 'admin-alert-banner--danger' : 'admin-alert-banner--warning'}`}
            style={{ textAlign: adminAlign(isAr) }}
        >
            <strong>{isAr ? 'تنبيه مخزون وحدة التحكم الأساسي' : 'Base controller stock alert'}</strong>
            {' — '}
            {alert.isOut
                ? (isAr ? 'نفد مخزون وحدة التحكم الأساسي. يرجى إعادة التوريد.' : 'Base controller unit is out of stock. Please restock.')
                : (isAr
                    ? `مخزون وحدة التحكم الأساسي منخفض (${alert.qty} متبقي، الحد ${alert.threshold}).`
                    : `Base controller stock is low (${alert.qty} left, threshold ${alert.threshold}).`)}
        </div>
    );
};

export default AdminStockAlerts;
