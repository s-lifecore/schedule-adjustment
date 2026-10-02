import React from 'react';
import { getDateSlots, formatDateLabel } from '../utils/scheduleFormat';

export default function ResponseDetailModal({ event, response, onClose }) {
  if (!response) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">{response.name}さんの回答</h3>
        <p className="modal-message p-detail-submitted-at">
          {response.submittedAt?.toDate?.()?.toLocaleString?.() || ''}
        </p>
        <div className="p-detail">
          {event.candidateDates.map(date => {
            const slots = getDateSlots(response, date);
            return (
              <div key={date} className="confirm-date-group">
                <span className="confirm-date">{formatDateLabel(date)}</span>
                {slots.length === 0 ? (
                  <span className="no-slots-warning">回答なし</span>
                ) : (
                  <div className="confirm-slots">
                    {slots.map((slot, idx) => (
                      <span key={idx} className="confirm-slot-badge">
                        {slot.timeRange}{slot.inPersonAvailable ? '（対面可）' : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {response.memo && (
          <div className="confirm-item p-detail-memo">
            <strong>備考</strong>
            <div className="confirm-memo-text">{response.memo}</div>
          </div>
        )}
        <div className="modal-actions">
          <button className="modal-btn modal-btn-cancel" onClick={onClose}>閉じる</button>
        </div>
      </div>
    </div>
  );
}
