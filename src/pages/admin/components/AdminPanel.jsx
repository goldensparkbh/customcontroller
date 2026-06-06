import React from 'react';

const AdminPanel = ({ children, className = '', flush = true, style = {} }) => (
  <section
    className={`admin-panel ${flush ? 'admin-panel--flush' : ''} ${className}`.trim()}
    style={style}
  >
    {children}
  </section>
);

export default AdminPanel;
