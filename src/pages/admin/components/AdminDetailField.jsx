import React from 'react';
import { adminAlign } from '../adminUi.js';

const AdminDetailField = ({ label, value, isAr, mono = false }) => (
  <div className="admin-detail-field" style={{ textAlign: adminAlign(isAr) }}>
    <div className="admin-detail-field__label">{label}</div>
    <div className={`admin-detail-field__value${mono ? ' admin-detail-field__value--mono' : ''}`}>
      {value || 'N/A'}
    </div>
  </div>
);

export default AdminDetailField;
