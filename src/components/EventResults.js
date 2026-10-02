import React, { useState, useEffect } from 'react';
import { doc, deleteDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useToast, ToastContainer } from './Toast';
import ConfirmModal from './ConfirmModal';
import ResponseDetailModal from './ResponseDetailModal';
import { useEventResponses } from '../hooks/useEventResponses';
import { parseTimeRangeToMinutes, minToLabel, formatDateLabel, getDateSlots } from '../utils/scheduleFormat';
import { generateSchedulePassword } from '../utils/generatePassword';

const SLOT_MIN = 15;
const SLOTS_PER_DAY = 1440 / SLOT_MIN;

function computeDaySegments(dateStr, responses) {
  const total = responses.length;
  const slotStatus = new Array(SLOTS_PER_DAY).fill(null);

  for (let s = 0; s < SLOTS_PER_DAY; s++) {
    const slotStart = s * SLOT_MIN;
    const availableIds = new Set();
    for (const r of responses) {
      const slots = getDateSlots(r, dateStr);
      const covered = slots.some(slot => {
        const range = parseTimeRangeToMinutes(slot.timeRange);
        return range && slotStart >= range[0] && slotStart < range[1];
      });
      if (covered) availableIds.add(r.id);
    }
    const count = availableIds.size;
    let status = 'partial';
    let missing = null;
    if (total > 0 && count === total) {
      status = 'full';
    } else if (total >= 2 && count === total - 1) {
      status = 'almost';
      missing = responses.filter(r => !availableIds.has(r.id)).map(r => r.name || '不明');
    }
    slotStatus[s] = { status, missing };
  }

  const segments = [];
  let cur = null;
  for (let s = 0; s < SLOTS_PER_DAY; s++) {
    const st = slotStatus[s];
    const missingKey = st.missing ? st.missing.join(',') : '';
    if (cur && cur.status === st.status && cur.missingKey === missingKey) {
      cur.end = (s + 1) * SLOT_MIN;
    } else {
      if (cur) segments.push(cur);
      cur = { start: s * SLOT_MIN, end: (s + 1) * SLOT_MIN, status: st.status, missing: st.missing, missingKey };
    }
  }
  if (cur) segments.push(cur);
  return segments;
}

const DayBlock = ({ date, responses }) => {
  const segments = computeDaySegments(date, responses);
  const ticks = [0, 3, 6, 9, 12, 15, 18, 21, 24];
  const highlighted = segments.filter(seg => seg.status === 'full' || seg.status === 'almost');

  return (
    <div className="day-block">
      <div className="day-title">{formatDateLabel(date)}</div>
      <div className="ruler">
        {ticks.map(h => (
          <span key={h} className="tick" style={{ left: `${(h / 24) * 100}%` }}>
            {String(h).padStart(2, '0')}
          </span>
        ))}
      </div>
      <div className="track">
        {segments.map((seg, i) => {
          const left = (seg.start / 1440) * 100;
          const width = ((seg.end - seg.start) / 1440) * 100;
          let label = '';
          if (seg.status === 'full') label = '◎';
          else if (seg.status === 'almost') label = '△';
          return (
            <div
              key={i}
              className={`seg ${seg.status}`}
              style={{ left: `${left}%`, width: `${width}%` }}
            >
              {width > 4 ? label : ''}
            </div>
          );
        })}
      </div>
      <div className="legend-list">
        {highlighted.length === 0 ? (
          <div className="empty-note">全員参加・1人以外参加可能な時間帯はまだありません。</div>
        ) : (
          highlighted.map((seg, i) => {
            const timeLabel = `${minToLabel(seg.start)}–${minToLabel(seg.end)}`;
            if (seg.status === 'full') {
              return (
                <div key={i} className="row">
                  <span className="mark full">◎</span>
                  <span className="time">{timeLabel}</span>
                  <span className="desc">全員参加可能</span>
                </div>
              );
            }
            const who = seg.missing && seg.missing.length ? seg.missing.join('・') : '1名';
            return (
              <div key={i} className="row">
                <span className="mark almost">△</span>
                <span className="time">{timeLabel}</span>
                <span className="desc">{who}さん以外参加可能</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

const EventResults = ({ eventId, onBack, onViewSchedule, user }) => {
  const { event, responses, loading, setEvent, setResponses } = useEventResponses(eventId);
  const { toast, toasts } = useToast();
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [detailResponse, setDetailResponse] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const closeConfirmModal = () => setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null });

  const isHostOrCoHost = !!(user && event && (
    event.hostId === user.uid || (event.coHostIds || []).includes(user.uid)
  ));

  // 共有カレンダーの閲覧パスワードが未発行のイベントには、ホストが管理画面を開いたタイミングで自動発行する
  useEffect(() => {
    if (!event || !eventId || event.schedulePassword || !isHostOrCoHost) return;
    const password = generateSchedulePassword();
    updateDoc(doc(db, 'events', eventId), { schedulePassword: password })
      .then(() => setEvent(prev => prev ? { ...prev, schedulePassword: password } : prev))
      .catch(() => {});
  }, [event, eventId, isHostOrCoHost, setEvent]);

  const scheduleShareUrl = event ? `${window.location.origin}/${event.id}/results/schedule` : '';

  const copyScheduleShareUrl = () => {
    navigator.clipboard.writeText(scheduleShareUrl).then(() => {
      toast.success('共有URLをコピーしました');
    }).catch(() => {
      toast.error('コピーに失敗しました');
    });
  };

  const copySchedulePassword = () => {
    if (!event?.schedulePassword) return;
    navigator.clipboard.writeText(event.schedulePassword).then(() => {
      toast.success('パスワードをコピーしました');
    }).catch(() => {
      toast.error('コピーに失敗しました');
    });
  };

  const regenerateSchedulePassword = () => {
    setConfirmModal({
      isOpen: true,
      title: 'パスワードを再発行しますか？',
      message: 'すでに共有リンクを伝えている人は、新しいパスワードを知らないとカレンダーを閲覧できなくなります。',
      onConfirm: () => { closeConfirmModal(); execRegenerateSchedulePassword(); },
    });
  };

  const execRegenerateSchedulePassword = async () => {
    const password = generateSchedulePassword();
    try {
      await updateDoc(doc(db, 'events', eventId), { schedulePassword: password });
      setEvent(prev => prev ? { ...prev, schedulePassword: password } : prev);
      toast.success('パスワードを再発行しました');
    } catch (error) {
      console.error('パスワード再発行エラー:', error);
      toast.error('パスワードの再発行に失敗しました');
    }
  };

  const deleteResponse = (responseId, participantName) => {
    setConfirmModal({
      isOpen: true,
      title: '回答を削除しますか？',
      message: `${participantName}さんの回答を削除します。この操作は取り消せません。`,
      onConfirm: () => { closeConfirmModal(); execDeleteResponse(responseId); },
    });
  };

  const execDeleteResponse = async (responseId) => {
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'events', eventId, 'responses', responseId));
      updateDoc(doc(db, 'events', eventId), { responseCount: increment(-1) }).catch(() => {});
      setResponses(prev => prev.filter(r => r.id !== responseId));
    } catch (error) {
      console.error('回答削除エラー:', error);
      toast.error('回答の削除に失敗しました');
    }
    setDeleting(false);
  };

  const copyEventLink = () => {
    if (!event) return;
    const url = `${window.location.origin}?eventId=${event.id}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success('共有リンクをコピーしました');
    }).catch(() => {
      toast.error('コピーに失敗しました');
    });
  };

  if (loading) {
    return <div className="loading">読み込み中...</div>;
  }

  if (!event) {
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

  const deadlineOver = event.responseDeadline && new Date() > event.responseDeadline.toDate?.();

  return (
    <div className="event-results">
      <div className="header">
        <button onClick={onBack} className="back-btn">← 戻る</button>
        <h2>{event.title}</h2>
      </div>

      {onViewSchedule && (
        <div className="mode-tabs">
          <button className="tab-btn active">一覧表示</button>
          <button className="tab-btn" onClick={() => onViewSchedule(event.id)}>カレンダー表示</button>
        </div>
      )}

      {onViewSchedule && (
        <div className="card schedule-share-card">
          <h3>カレンダー表示の共有</h3>
          <p className="share-hint">このURLとパスワードを知っている人は、ログインなしでカレンダー表示を閲覧できます。</p>
          <div className="share-field">
            <label>共有URL</label>
            <div className="share-field-row">
              <code className="share-value">{scheduleShareUrl}</code>
              <button onClick={copyScheduleShareUrl} className="share-btn">コピー</button>
            </div>
          </div>
          <div className="share-field">
            <label>パスワード</label>
            <div className="share-field-row">
              <code className="share-value">{event.schedulePassword || '発行中...'}</code>
              <button onClick={copySchedulePassword} className="share-btn" disabled={!event.schedulePassword}>コピー</button>
            </div>
          </div>
          <button
            onClick={regenerateSchedulePassword}
            className="regenerate-password-btn"
            disabled={!event.schedulePassword}
          >
            パスワードを再発行する
          </button>
        </div>
      )}

      <div className="event-info">
        <p><strong>候補日:</strong> {event.candidateDates.join(', ')}</p>
        <p><strong>回答数:</strong> {responses.length}件</p>
        {event.responseDeadline && (
          <p>
            <span className={`deadline-badge${deadlineOver ? ' over' : ''}`}>
              締切 {event.responseDeadline.toDate?.()?.toLocaleString?.() || '不明'}
              {deadlineOver && '（期限切れ）'}
            </span>
          </p>
        )}
        {event.description && (
          <div className="event-description">
            <strong>イベント説明:</strong><br />
            <span>{event.description}</span>
          </div>
        )}
        <button onClick={copyEventLink} className="share-btn">
          共有リンクをコピー
        </button>
      </div>

      {responses.length === 0 ? (
        <div className="card">
          <div className="empty-note">まだ誰も回答していません。共有リンクを参加者に伝えて回答を待ちましょう。</div>
        </div>
      ) : (
        <>
          <div className="card">
            <div className="legend-list results-legend">
              <div className="row"><span className="mark full">◎</span><span className="desc">全員が参加可能</span></div>
              <div className="row"><span className="mark almost">△</span><span className="desc">1人を除いて参加可能</span></div>
            </div>
          </div>
          {event.candidateDates.map(date => (
            <div key={date} className="card">
              <DayBlock date={date} responses={responses} />
            </div>
          ))}
        </>
      )}

      <div className="card">
        <h3>回答者一覧</h3>
        {responses.length === 0 ? (
          <div className="empty-note">回答者はまだいません。</div>
        ) : (
          <div className="participant-list">
            {responses.map(response => {
              const summary = event.candidateDates.map(date => {
                const slots = getDateSlots(response, date);
                if (slots.length === 0) return `${formatDateLabel(date)}: -`;
                return `${formatDateLabel(date)}: ${slots.map(s => s.timeRange + (s.inPersonAvailable ? '(対面可)' : '')).join(', ')}`;
              }).join(' / ');

              return (
                <div key={response.id} className="p-entry">
                  <div className="p-row">
                    <div className="p-info">
                      <span className="p-name">{response.name}</span>
                      <span className="p-submitted-at">
                        {response.submittedAt?.toDate?.()?.toLocaleString?.() || ''}
                      </span>
                    </div>
                    <span className="p-time">{summary}</span>
                    <button
                      className="event-expand-btn"
                      onClick={() => setDetailResponse(response)}
                    >
                      詳細を見る
                    </button>
                    <button
                      className="delete-response-btn"
                      onClick={() => deleteResponse(response.id, response.name)}
                      disabled={deleting}
                    >
                      削除
                    </button>
                  </div>
                  {response.memo && (
                    <div className="p-memo">備考: {response.memo}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <ResponseDetailModal event={event} response={detailResponse} onClose={() => setDetailResponse(null)} />
      <ToastContainer toasts={toasts} />
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={closeConfirmModal}
      />
    </div>
  );
};

export default EventResults;
