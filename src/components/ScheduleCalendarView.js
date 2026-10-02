import React, { useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import ResponseDetailModal from './ResponseDetailModal';
import { useEventResponses } from '../hooks/useEventResponses';
import { parseTimeRangeToMinutes, minToLabel, formatDateLabel, getDateSlots } from '../utils/scheduleFormat';

const unlockStorageKey = (eventId) => `scheduleUnlocked:${eventId}`;

// dataviz skill categorical palette (fixed order — never cycled for ranked data,
// but reused here once participants exceed 8, same as Google Calendar's own behavior)
const PARTICIPANT_COLORS = [
  '#2a78d6', '#eb6834', '#1baf7a', '#eda100',
  '#e87ba4', '#008300', '#4a3aa7', '#e34948',
];

const HOUR_PX = 48;

function computeHourRange(event, responses) {
  let min = null;
  let max = null;
  (event?.candidateDates || []).forEach(date => {
    responses.forEach(r => {
      getDateSlots(r, date).forEach(slot => {
        const range = parseTimeRangeToMinutes(slot.timeRange);
        if (!range) return;
        if (min === null || range[0] < min) min = range[0];
        if (max === null || range[1] > max) max = range[1];
      });
    });
  });
  if (min === null) {
    return { startHour: 9, endHour: 18 };
  }
  const startHour = Math.max(0, Math.floor(min / 60) - 1);
  const endHour = Math.min(24, Math.ceil(max / 60) + 1);
  return { startHour, endHour: Math.max(endHour, startHour + 1) };
}

function layoutDayEvents(events) {
  const sorted = [...events].sort((a, b) => a.start - b.start || a.end - b.end);
  const columnEndTimes = [];
  const placed = sorted.map(ev => {
    let col = columnEndTimes.findIndex(end => end <= ev.start);
    if (col === -1) {
      col = columnEndTimes.length;
      columnEndTimes.push(ev.end);
    } else {
      columnEndTimes[col] = ev.end;
    }
    return { ...ev, col };
  });
  const totalCols = columnEndTimes.length || 1;
  return placed.map(ev => ({ ...ev, totalCols }));
}

const ScheduleCalendarView = ({ eventId, onBack, onViewList, user }) => {
  const [eventMeta, setEventMeta] = useState(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [detailResponse, setDetailResponse] = useState(null);

  useEffect(() => {
    if (!eventId) {
      setMetaLoading(false);
      return;
    }
    setMetaLoading(true);
    getDoc(doc(db, 'events', eventId))
      .then(snap => setEventMeta(snap.exists() ? { id: snap.id, ...snap.data() } : null))
      .catch(() => setEventMeta(null))
      .finally(() => setMetaLoading(false));
  }, [eventId]);

  const isHostOrCoHost = !!(user && eventMeta && (
    eventMeta.hostId === user.uid || (eventMeta.coHostIds || []).includes(user.uid)
  ));

  useEffect(() => {
    if (!eventId || !eventMeta) return;
    if (isHostOrCoHost || !eventMeta.schedulePassword) {
      setUnlocked(true);
      return;
    }
    if (sessionStorage.getItem(unlockStorageKey(eventId)) === '1') {
      setUnlocked(true);
    }
  }, [eventId, eventMeta, isHostOrCoHost]);

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (passwordInput.trim().toUpperCase() === (eventMeta?.schedulePassword || '')) {
      sessionStorage.setItem(unlockStorageKey(eventId), '1');
      setPasswordError('');
      setUnlocked(true);
    } else {
      setPasswordError('パスワードが正しくありません');
    }
  };

  const { event, responses, loading } = useEventResponses(unlocked ? eventId : null);

  const colorByResponseId = useMemo(() => {
    const map = {};
    responses.forEach((r, i) => { map[r.id] = PARTICIPANT_COLORS[i % PARTICIPANT_COLORS.length]; });
    return map;
  }, [responses]);

  const { startHour, endHour } = useMemo(
    () => computeHourRange(event, responses),
    [event, responses]
  );

  if (metaLoading) {
    return <div className="loading">読み込み中...</div>;
  }

  if (!eventMeta) {
    return (
      <div className="event-results">
        <div className="header">
          <button onClick={onBack} className="back-btn">← 戻る</button>
          <h2>イベントが見つかりません</h2>
        </div>
        <p>指定されたイベントが存在しないか、削除された可能性があります。</p>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="event-results schedule-calendar-view">
        <div className="header">
          <button onClick={onBack} className="back-btn">← 戻る</button>
          <h2>{eventMeta.title}</h2>
        </div>
        <div className="card password-gate-card">
          <h3>このカレンダーはパスワードで保護されています</h3>
          <p className="password-gate-hint">共有リンクと一緒に伝えられたパスワードを入力してください。</p>
          <form onSubmit={handlePasswordSubmit} className="password-gate-form">
            <div className="form-group">
              <label htmlFor="schedule-password">パスワード</label>
              <input
                id="schedule-password"
                type="text"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                autoFocus
              />
            </div>
            {passwordError && <p className="password-gate-error">{passwordError}</p>}
            <button type="submit" className="submit-btn">表示する</button>
          </form>
        </div>
      </div>
    );
  }

  if (loading || !event) {
    return <div className="loading">読み込み中...</div>;
  }

  const hours = [];
  for (let h = startHour; h < endHour; h++) hours.push(h);
  const gridHeight = (endHour - startHour) * HOUR_PX;
  const totalMinutes = (endHour - startHour) * 60;

  return (
    <div className="event-results schedule-calendar-view">
      <div className="header">
        <button onClick={onBack} className="back-btn">← 戻る</button>
        <h2>{event.title}</h2>
      </div>

      {isHostOrCoHost && (
        <div className="mode-tabs">
          <button className="tab-btn" onClick={() => onViewList(event.id)}>一覧表示</button>
          <button className="tab-btn active">カレンダー表示</button>
        </div>
      )}

      {responses.length === 0 ? (
        <div className="card">
          <div className="empty-note">まだ誰も回答していません。共有リンクを参加者に伝えて回答を待ちましょう。</div>
        </div>
      ) : (
        <div className="card">
          <div className="calendar-legend">
            {responses.map(r => (
              <button
                key={r.id}
                type="button"
                className="calendar-legend-item"
                onClick={() => setDetailResponse(r)}
              >
                <span className="calendar-legend-dot" style={{ background: colorByResponseId[r.id] }} />
                {r.name}
              </button>
            ))}
          </div>

          <div className="calendar-grid-wrap">
            <div
              className="calendar-grid"
              style={{ gridTemplateColumns: `56px repeat(${event.candidateDates.length}, minmax(140px, 1fr))` }}
            >
              <div className="calendar-corner" />
              {event.candidateDates.map(date => (
                <div key={date} className="calendar-col-header">{formatDateLabel(date)}</div>
              ))}

              <div className="calendar-time-axis" style={{ height: `${gridHeight}px` }}>
                {hours.map(h => (
                  <div key={h} className="calendar-hour-row" style={{ height: `${HOUR_PX}px` }}>
                    <span className="calendar-hour-label">{String(h).padStart(2, '0')}:00</span>
                  </div>
                ))}
              </div>

              {event.candidateDates.map(date => {
                const dayEvents = [];
                responses.forEach(r => {
                  getDateSlots(r, date).forEach((slot, idx) => {
                    const range = parseTimeRangeToMinutes(slot.timeRange);
                    if (!range) return;
                    dayEvents.push({
                      key: `${r.id}-${date}-${idx}`,
                      responseId: r.id,
                      name: r.name,
                      start: Math.max(range[0], startHour * 60),
                      end: Math.min(range[1], endHour * 60),
                      inPersonAvailable: slot.inPersonAvailable,
                      response: r,
                    });
                  });
                });
                const placed = layoutDayEvents(dayEvents);

                return (
                  <div key={date} className="calendar-day-col" style={{ height: `${gridHeight}px` }}>
                    {hours.map(h => (
                      <div
                        key={h}
                        className="calendar-hour-gridline"
                        style={{ top: `${(h - startHour) * HOUR_PX}px` }}
                      />
                    ))}
                    {placed.length === 0 && (
                      <div className="calendar-day-empty">回答なし</div>
                    )}
                    {placed.map(ev => {
                      const top = ((ev.start - startHour * 60) / totalMinutes) * gridHeight;
                      const height = Math.max(((ev.end - ev.start) / totalMinutes) * gridHeight, 18);
                      const width = 100 / ev.totalCols;
                      const left = ev.col * width;
                      return (
                        <button
                          key={ev.key}
                          type="button"
                          className="calendar-event-block"
                          style={{
                            top: `${top}px`,
                            height: `${height}px`,
                            left: `${left}%`,
                            width: `calc(${width}% - 2px)`,
                            background: colorByResponseId[ev.responseId],
                          }}
                          onClick={() => setDetailResponse(ev.response)}
                          title={`${ev.name} ${minToLabel(ev.start)}–${minToLabel(ev.end)}`}
                        >
                          <span className="calendar-event-name">{ev.name}</span>
                          <span className="calendar-event-time">{minToLabel(ev.start)}–{minToLabel(ev.end)}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <ResponseDetailModal event={event} response={detailResponse} onClose={() => setDetailResponse(null)} />
    </div>
  );
};

export default ScheduleCalendarView;
