import React from 'react';

export default function ConfirmModal({ isOpen, title, message, confirmLabel = '削除する', onConfirm, onCancel }) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        {title && <h3 className="modal-title">{title}</h3>}
        <p className="modal-message">{message}</p>
        <div className="modal-actions">
          <button className="modal-btn modal-btn-cancel" onClick={onCancel}>キャンセル</button>
          <button className="modal-btn modal-btn-danger" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
