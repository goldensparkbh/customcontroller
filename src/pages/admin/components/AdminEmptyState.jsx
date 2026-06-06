import React from 'react';
import { adminAlign } from '../adminUi.js';

const AdminEmptyState = ({ lang = 'ar', message, hint }) => {
  const isAr = lang === 'ar';
  return (
    <div className="admin-empty" style={{ textAlign: adminAlign(isAr) }}>
      <div className="admin-empty__title">{message}</div>
      {hint ? <div className="admin-empty__hint">{hint}</div> : null}
    </div>
  );
};

export default AdminEmptyState;
