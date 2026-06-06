import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { fetchSiteStatus } from '../services/backendApi.js';
import LoadingState from './LoadingState.jsx';
import MaintenancePage from '../pages/MaintenancePage.jsx';

const POLL_MS = 60_000;

export default function MaintenanceGate({ children }) {
  const location = useLocation();
  const [status, setStatus] = useState(null);
  const bypassMaintenance =
    location.pathname.startsWith('/admin') || location.pathname.startsWith('/pos');

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const next = await fetchSiteStatus();
        if (alive) setStatus(next);
      } catch {
        if (alive) setStatus({ maintenanceMode: false });
      }
    };

    load();
    const timer = window.setInterval(load, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  if (status === null) {
    return <LoadingState message="Loading..." fullScreen />;
  }

  if (status.maintenanceMode && !bypassMaintenance) {
    return (
      <MaintenancePage messageAr={status.messageAr} messageEn={status.messageEn} />
    );
  }

  return children;
}
