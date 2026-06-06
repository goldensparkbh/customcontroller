import React from 'react';
import { adminAlign } from '../adminUi.js';
import AdminEmptyState from './AdminEmptyState.jsx';

export const AdminDataGridHeader = ({ columnTemplate, lang = 'ar', children, className = '' }) => (
  <div
    className={`admin-data-grid__header ${className}`.trim()}
    style={{
      gridTemplateColumns: columnTemplate,
      textAlign: adminAlign(lang === 'ar')
    }}
  >
    {children}
  </div>
);

export const AdminDataGridRow = ({
  columnTemplate,
  lang = 'ar',
  selected = false,
  onClick,
  children,
  as = 'button',
  className = ''
}) => {
  const rowClass = [
    'admin-data-grid__row',
    selected ? 'admin-data-grid__row--selected' : '',
    !onClick ? 'admin-data-grid__row--static' : '',
    className
  ].filter(Boolean).join(' ');

  const sharedProps = {
    className: rowClass,
    style: {
      gridTemplateColumns: columnTemplate,
      textAlign: adminAlign(lang === 'ar')
    },
    onClick
  };

  if (as === 'div') {
    return <div {...sharedProps}>{children}</div>;
  }

  return (
    <button type="button" {...sharedProps}>
      {children}
    </button>
  );
};

export const AdminDataGridCell = ({
  children,
  muted = false,
  mono = false,
  numeric = false,
  className = ''
}) => (
  <div
    className={[
      'admin-data-grid__cell',
      muted ? 'admin-data-grid__cell--muted' : '',
      mono ? 'admin-data-grid__cell--mono' : '',
      numeric ? 'admin-data-grid__cell--numeric' : '',
      className
    ].filter(Boolean).join(' ')}
  >
    {children}
  </div>
);

const AdminDataGrid = ({
  columnTemplate,
  lang = 'ar',
  header,
  children,
  emptyMessage,
  emptyHint,
  maxHeight,
  className = ''
}) => {
  const hasRows = React.Children.count(children) > 0;

  return (
    <div
      className={`admin-data-grid ${className}`.trim()}
      style={maxHeight ? { maxHeight, overflow: 'auto' } : undefined}
    >
      {header}
      <div className="admin-data-grid__body">
        {hasRows ? children : (
          <AdminEmptyState lang={lang} message={emptyMessage} hint={emptyHint} />
        )}
      </div>
    </div>
  );
};

export default AdminDataGrid;
