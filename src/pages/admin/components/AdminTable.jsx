import React from 'react';
import { adminAlign } from '../adminUi.js';
import AdminEmptyState from './AdminEmptyState.jsx';

const AdminTable = ({
  lang = 'ar',
  columns = [],
  children,
  emptyMessage,
  emptyHint,
  stickyHeader = true,
  className = ''
}) => {
  const isAr = lang === 'ar';
  const colSpan = columns.length || 1;

  return (
    <div className={`admin-table-wrap ${className}`.trim()}>
      <table className={`admin-table${stickyHeader ? ' admin-table--sticky' : ''}`}>
        {columns.length > 0 && (
          <thead>
            <tr style={{ textAlign: adminAlign(isAr) }}>
              {columns.map((col) => (
                <th
                  key={col.key || col.label}
                  className={[
                    col.numeric ? 'admin-table__cell--numeric' : '',
                    col.mono ? 'admin-table__cell--mono' : '',
                    col.align === 'center' ? 'admin-table__cell--center' : ''
                  ].filter(Boolean).join(' ')}
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody style={{ textAlign: adminAlign(isAr) }}>
          {React.Children.count(children) === 0 && emptyMessage ? (
            <tr>
              <td colSpan={colSpan} className="admin-table__empty">
                <AdminEmptyState lang={lang} message={emptyMessage} hint={emptyHint} />
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
};

export const AdminTableRow = ({ children, selected = false, dimmed = false, onClick, className = '' }) => {
  if (onClick) {
    return (
      <tr
        className={[
          'admin-table__row--clickable',
          selected ? 'admin-table__row--selected' : '',
          dimmed ? 'admin-table__row--dimmed' : '',
          className
        ].filter(Boolean).join(' ')}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onClick(event);
          }
        }}
      >
        {children}
      </tr>
    );
  }

  return (
    <tr className={[dimmed ? 'admin-table__row--dimmed' : '', className].filter(Boolean).join(' ')}>
      {children}
    </tr>
  );
};

export default AdminTable;
