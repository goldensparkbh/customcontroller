import React from 'react';

const AdminPageHeader = ({ title, subtitle, actions }) => (
  <header className="admin-page-header">
    <div>
      {title ? <h1 className="admin-page-header__title">{title}</h1> : null}
      {subtitle ? <p className="admin-page-header__subtitle">{subtitle}</p> : null}
    </div>
    {actions ? <div className="admin-page-header__actions">{actions}</div> : null}
  </header>
);

export default AdminPageHeader;
