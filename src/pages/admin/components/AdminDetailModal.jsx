import React, { useEffect } from 'react';
import { adminAlign } from '../adminUi.js';

const AdminDetailModal = ({
  open,
  onClose,
  title,
  subtitle,
  isAr,
  width = 'min(980px, 100%)',
  children
}) => {
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="admin-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="admin-modal"
        style={{ width, direction: isAr ? 'rtl' : 'ltr' }}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="admin-modal__header" style={{ flexDirection: isAr ? 'row-reverse' : 'row' }}>
          <div style={{ textAlign: adminAlign(isAr) }}>
            <div className="admin-modal__title">{title}</div>
            {subtitle ? <div className="admin-modal__subtitle">{subtitle}</div> : null}
          </div>
          <button type="button" className="admin-btn admin-btn--ghost" onClick={onClose}>
            {isAr ? 'إغلاق' : 'Close'}
          </button>
        </div>
        <div className="admin-modal__body">{children}</div>
      </div>
    </div>
  );
};

export default AdminDetailModal;
