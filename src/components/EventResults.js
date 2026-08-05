import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useToast, ToastContainer } from './Toast';
import ConfirmModal from './ConfirmModal';

const SLOT_MIN = 15;
const SLOTS_PER_DAY = 1440 / SLOT_MIN;

function parseTimeRangeToMinutes(range) {
  const parts = (range || '').split('-');
  if (parts.length !== 2) return null;
  const toMin = (t) => {
    const m = t.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  };
  const s = toMin(parts[0]);
  const e = toMin(parts[1]);
  if (s === null || e === null) return null;
  return [s, e];
}

function minToLabel(min) {
  min = Math.max(0, Math.min(1440, min));
  const h = Math.floor(min / 60);
  const m = min % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

function formatDateLabel(dateStr) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const d = new Date(dateStr + 'T00:00:00');
    const wd = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
    return `${d.getMonth() + 1}/${d.getDate()}(${wd})`;
  }
  return dateStr;
}

function getDateSlots(response, dateStr) {
  const entry = (response.timeSlots || []).find(ts => ts.date === dateStr);
  const slots = (entry && entry.timeSlots) || [];
  return [...slots].sort((a, b) => (b.inPersonAvailable ? 1 : 0) - (a.inPersonAvailable ? 1 : 0));
}

function computeDaySegments(dateStr, responses) {
  const total = responses.length;
  const slotStatus = new Array(SLOTS_PER_DAY).fill(null);

  for (let s = 0; s < SLOTS_PER_DAY; s++) {
    const slotStart = s * SLOT_MIN;
    const availableNames = [];
    for (const r of responses) {
      const slots = getDateSlots(r, dateStr);
      const covered = slots.some(slot => {
        const range = parseTimeRangeToMinutes(slot.timeRange);
        return range && slotStart >= range[0] && slotStart < range[1];
      });
      if (covered) availableNames.push(r.name);
    }
    const count = availableNames.length;
    let status = 'partial';
    let missing = null;
    if (total > 0 && count === total) {
      status = 'full';
    } else if (total >= 2 && count === total - 1) {
      status = 'almost';
      missing = responses.map(r => r.name).filter(n => !availableNames.includes(n));
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

const EventResults = ({ eventId, onBack }) => {
  const [event, setEvent] = useState(null);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast, toasts } = useToast();
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  const closeConfirmModal = () => setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null });

  useEffect(() => {
    if (!eventId) {
      setLoading(false);
      return;
    }

    const loadEventAndResponses = async () => {
      setLoading(true);
      try {
        const eventDoc = await getDoc(doc(db, 'events', eventId));
        if (!eventDoc.exists()) {
          console.error('イベントが見つかりません');
          setLoading(false);
          return;
        }

        const eventData = { id: eventDoc.id, ...eventDoc.data() };
        setEvent(eventData);

        const responsesRef = collection(db, 'events', eventId, 'responses');
        const snapshot = await getDocs(responsesRef);

        const responsesData = await Promise.all(
          snapshot.docs.map(async (responseDoc) => {
            const responseData = { id: responseDoc.id, ...responseDoc.data() };

            const timeSlotsRef = collection(db, 'events', eventId, 'responses', responseDoc.id, 'timeSlots');
            const timeSlotsSnapshot = await getDocs(timeSlotsRef);

            responseData.timeSlots = timeSlotsSnapshot.docs.map(timeSlotDoc => ({
              id: timeSlotDoc.id,
              ...timeSlotDoc.data()
            })) || [];

            if (responseData.timeSlots.length === 0 && responseData.times) {
              responseData.timeSlots = responseData.times || [];
            }

            return responseData;
          })
        );

        responsesData.sort((a, b) => {
          const aTime = a.submittedAt?.toDate?.() || new Date(0);
          const bTime = b.submittedAt?.toDate?.() || new Date(0);
          return bTime - aTime;
        });

        setResponses(responsesData);
      } catch (error) {
        console.error('イベント・回答取得エラー:', error);
      }
      setLoading(false);
    };

    loadEventAndResponses();
  }, [eventId]);

  const deleteResponse = (responseId, participantName) => {
    setConfirmModal({
      isOpen: true,
      title: '回答を削除しますか？',
      message: `${participantName}さんの回答を削除します。この操作は取り消せません。`,
      onConfirm: () => { closeConfirmModal(); execDeleteResponse(responseId); },
    });
  };

  const execDeleteResponse = async (responseId) => {
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'events', eventId, 'responses', responseId));
      window.location.reload();
    } catch (error) {
      console.error('回答削除エラー:', error);
      toast.error('回答の削除に失敗しました');
      setLoading(false);
    }
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
                <div key={response.id} className="p-row">
                  <div>
                    <div className="response-header">
                      <span className="p-name">{response.name}</span>
                      <button
                        className="delete-response-btn"
                        onClick={() => deleteResponse(response.id, response.name)}
                        disabled={loading}
                      >
                        削除
                      </button>
                    </div>
                    {response.memo && <div className="p-memo">備考: {response.memo}</div>}
                  </div>
                  <span className="p-time">{summary}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
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
