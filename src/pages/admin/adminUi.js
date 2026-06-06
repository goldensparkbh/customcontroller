/** Text alignment for admin titles, table headers, and form labels */
export function adminAlign(isAr) {
  return isAr ? 'right' : 'left';
}

export const adminPanelStyle = {
  background: 'var(--admin-surface)',
  border: '1px solid var(--admin-border)',
  borderRadius: '12px',
  boxShadow: 'var(--admin-shadow)',
  overflow: 'hidden'
};

/** @deprecated use adminPanelStyle or AdminPanel component */
export const panelStyle = adminPanelStyle;

/** Shared inline field styles (uses admin CSS variables from admin-theme.css) */
export const adminFieldStyle = {
  padding: '0.72rem 0.8rem',
  borderRadius: '8px',
  border: '1px solid var(--admin-border)',
  background: 'var(--admin-raised)',
  color: 'var(--admin-input-text)',
  outline: 'none'
};
