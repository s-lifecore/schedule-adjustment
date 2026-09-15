import React, { useState, useEffect, useCallback } from 'react';
import { collection, addDoc, query, where, getDocs, doc, deleteDoc, updateDoc, arrayRemove, deleteField } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useToast, ToastContainer } from './Toast';
import ConfirmModal from './ConfirmModal';
import AboutSiteInfo from './AboutSiteInfo';

const HostDashboard = ({ user, onBack, onViewResults, showCreateForm: initialShowCreateForm = false, onCreateNew }) => {
  const [events, setEvents] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(initialShowCreateForm);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [candidateDates, setCandidateDates] = useState(['']);
  const [classPeriods, setClassPeriods] = useState([]);
  const [responseDeadline, setResponseDeadline] = useState('');
  const [loading, setLoading] = useState(false);
  const [defaultInPersonAvailable, setDefaultInPersonAvailable] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDates, setEditDates] = useState(['']);
  const [editClassPeriods, setEditClassPeriods] = useState([]);
  const [editDefaultInPerson, setEditDefaultInPerson] = useState(false);
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [rangeDayFilter, setRangeDayFilter] = useState('all'); // 'all' | 'weekday' | 'weekend'
  const [dateInputMode, setDateInputMode] = useState(null); // null | 'single' | 'range'
  const [detailEvent, setDetailEvent] = useState(null);
  const { toast, toasts } = useToast();
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [editResponseDeadline, setEditResponseDeadline] = useState('');

  // 自分が主催（hostId）または共同ホスト（coHostIds）のイベントを取得
  const fetchAccessibleEvents = useCallback(async () => {
    const eventsRef = collection(db, 'events');
    const [hostSnapshot, coHostSnapshot] = await Promise.all([
      getDocs(query(eventsRef, where('hostId', '==', user.uid))),
      getDocs(query(eventsRef, where('coHostIds', 'array-contains', user.uid)))
    ]);

    const eventDocsById = new Map();
    hostSnapshot.docs.forEach(d => eventDocsById.set(d.id, d));
    coHostSnapshot.docs.forEach(d => { if (!eventDocsById.has(d.id)) eventDocsById.set(d.id, d); });

    const eventsData = await Promise.all(
      Array.from(eventDocsById.values()).map(async (eventDoc) => {
        const eventData = { id: eventDoc.id, ...eventDoc.data() };

        // responseCountはイベント作成時/回答の作成・削除時に更新している値をそのまま使う。
        // それ以前に作成された古いイベントだけ、初回表示時に数え直して書き戻す（以降は高速化）。
        if (eventData.responseCount === undefined) {
          const responsesRef = collection(db, 'events', eventDoc.id, 'responses');
          const responsesSnapshot = await getDocs(responsesRef);
          eventData.responseCount = responsesSnapshot.size;
          updateDoc(doc(db, 'events', eventDoc.id), { responseCount: eventData.responseCount }).catch(() => {});
        }

        return eventData;
      })
    );
    // JavaScriptでソート（createdAtで降順）
    eventsData.sort((a, b) => {
      const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt) || new Date(0);
      const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt) || new Date(0);
      return dateB - dateA;
    });
    return eventsData;
  }, [user]);

  useEffect(() => {
    const loadUserEvents = async () => {
      try {
        setEvents(await fetchAccessibleEvents());
      } catch (error) {
        console.error('イベント取得エラー:', error);
      }
    };

    loadUserEvents();
  }, [fetchAccessibleEvents]);

  const addDateInput = () => {
    setCandidateDates([...candidateDates, '']);
  };

  const updateDate = (index, value) => {
    const newDates = [...candidateDates];
    newDates[index] = value;
    setCandidateDates(newDates);
  };

  const removeDate = (index) => {
    const newDates = candidateDates.filter((_, i) => i !== index);
    setCandidateDates(newDates);
  };

  // 授業時間帯（コマ）の操作
  const addClassPeriod = () => {
    setClassPeriods([...classPeriods, { name: '', start: '', end: '' }]);
  };

  const updateClassPeriod = (index, field, value) => {
    const updated = [...classPeriods];
    updated[index] = { ...updated[index], [field]: value };
    setClassPeriods(updated);
  };

  const removeClassPeriod = (index) => {
    setClassPeriods(classPeriods.filter((_, i) => i !== index));
  };

  const createEvent = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validDates = candidateDates.filter(date => date.trim() !== '');
      
      if (validDates.length === 0) {
        toast.error('候補日を少なくとも1つ入力してください');
        setLoading(false);
        return;
      }

      const validClassPeriods = classPeriods
        .filter(p => p.name.trim() !== '' && p.start && p.end)
        .map(p => ({ name: p.name.trim(), start: p.start, end: p.end }));

      const eventData = {
        title: eventTitle,
        description: eventDescription,
        candidateDates: validDates,
        classPeriods: validClassPeriods,
        hostId: user.uid,
        hostName: user.displayName || user.email,
        defaultInPersonAvailable: defaultInPersonAvailable,
        responseDeadline: responseDeadline ? new Date(responseDeadline) : null,
        responseCount: 0,
        createdAt: new Date()
      };

      await addDoc(collection(db, 'events'), eventData);

      // フォームリセット
      setEventTitle('');
      setEventDescription('');
      setCandidateDates(['']);
      setClassPeriods([]);
      setResponseDeadline('');
      setDefaultInPersonAvailable(false);
      setDateInputMode(null);
      setShowCreateForm(false);
      
      // イベント一覧更新
      await loadUserEventsRefresh();
      
      toast.success('イベントを作成しました');
    } catch (error) {
      console.error('イベント作成エラー:', error);
      toast.error('イベントの作成に失敗しました');
    }
    
    setLoading(false);
  };

  const loadUserEventsRefresh = async () => {
    try {
      setEvents(await fetchAccessibleEvents());
    } catch (error) {
      console.error('イベント取得エラー:', error);
    }
  };

  const viewEventResults = (eventId) => {
    if (onViewResults) {
      onViewResults(eventId);
    }
  };

  const copyShareLink = async (eventId) => {
    try {
      const shareUrl = `${window.location.origin}?eventId=${eventId}`;
      await navigator.clipboard.writeText(shareUrl);
      toast.success('共有リンクをコピーしました');
    } catch (error) {
      // クリップボードAPIが使えない場合のフォールバック
      const shareUrl = `${window.location.origin}?eventId=${eventId}`;
      const fallbackText = `イベントID: ${eventId}\n共有リンク: ${shareUrl}`;

      const textArea = document.createElement('textarea');
      textArea.value = fallbackText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);

      toast.success('共有情報をコピーしました');
    }
  };

  const copyCoHostInviteLink = async (eventId) => {
    const inviteUrl = `${window.location.origin}/?eventId=${eventId}&cohost=1`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success('共同ホスト招待リンクをコピーしました');
    } catch (error) {
      const textArea = document.createElement('textarea');
      textArea.value = inviteUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      toast.success('共同ホスト招待リンクをコピーしました');
    }
  };

  const removeCoHost = async (eventId, coHostUid) => {
    try {
      await updateDoc(doc(db, 'events', eventId), {
        coHostIds: arrayRemove(coHostUid),
        [`coHostNames.${coHostUid}`]: deleteField()
      });
      const refreshedEvents = await fetchAccessibleEvents();
      setEvents(refreshedEvents);
      setDetailEvent(prev => (prev && prev.id === eventId)
        ? refreshedEvents.find(e => e.id === eventId) || null
        : prev);
      toast.success('共同ホストを削除しました');
    } catch (error) {
      console.error('共同ホスト削除エラー:', error);
      toast.error('共同ホストの削除に失敗しました');
    }
  };

  const closeConfirmModal = () => setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null });

  const today = new Date().toISOString().split('T')[0];

  // イベント削除機能
  const deleteEvent = (eventId, eventTitle) => {
    setConfirmModal({
      isOpen: true,
      title: 'イベントを削除しますか？',
      message: `「${eventTitle}」を削除します。この操作は取り消せません。参加者の回答もすべて削除されます。`,
      onConfirm: () => { closeConfirmModal(); execDeleteEvent(eventId); },
    });
  };

  const execDeleteEvent = async (eventId) => {
    setLoading(true);
    try {
      // 1. 回答（responses）を取得して削除
      const responsesRef = collection(db, 'events', eventId, 'responses');
      const responsesSnapshot = await getDocs(responsesRef);
      
      const deletePromises = responsesSnapshot.docs.map(async (responseDoc) => {
        // 1.1 各回答の timeSlots を削除
        const timeSlotsRef = collection(db, 'events', eventId, 'responses', responseDoc.id, 'timeSlots');
        const timeSlotsSnapshot = await getDocs(timeSlotsRef);
        const slotDeletePromises = timeSlotsSnapshot.docs.map(slotDoc => deleteDoc(slotDoc.ref));
        await Promise.all(slotDeletePromises);
        
        // 1.2 回答本体を削除
        return deleteDoc(responseDoc.ref);
      });
      
      await Promise.all(deletePromises);

      // 2. イベント本体を削除
      await deleteDoc(doc(db, 'events', eventId));

      // イベント一覧を再読み込み
      setEvents(await fetchAccessibleEvents());

      toast.success('イベントを削除しました');
    } catch (error) {
      console.error('イベント削除エラー:', error);
      toast.error('イベントの削除に失敗しました');
    }
    setLoading(false);
  };

  // 編集開始
  const startEdit = (event) => {
    setEditingEvent(event.id);
    setEditTitle(event.title);
    setEditDescription(event.description || '');
    setEditDates(event.candidateDates || ['']);
    setEditClassPeriods(event.classPeriods || []);
    setEditDefaultInPerson(event.defaultInPersonAvailable || false);
    // 日付型をローカル形式の文字列に変換
    if (event.responseDeadline) {
      const deadline = event.responseDeadline.toDate?.() || new Date(event.responseDeadline);
      const localISOTime = new Date(deadline.getTime() - deadline.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setEditResponseDeadline(localISOTime);
    } else {
      setEditResponseDeadline('');
    }
  };

  // 編集キャンセル
  const cancelEdit = () => {
    setEditingEvent(null);
    setEditTitle('');
    setEditDescription('');
    setEditDates(['']);
    setEditClassPeriods([]);
    setEditDefaultInPerson(false);
    setEditResponseDeadline('');
  };

  // 編集候補日の操作
  const addEditDateInput = () => {
    setEditDates([...editDates, '']);
  };

  const updateEditDate = (index, value) => {
    const newDates = [...editDates];
    newDates[index] = value;
    setEditDates(newDates);
  };

  const removeEditDate = (index) => {
    const newDates = editDates.filter((_, i) => i !== index);
    setEditDates(newDates);
  };

  // 編集用：授業時間帯（コマ）の操作
  const addEditClassPeriod = () => {
    setEditClassPeriods([...editClassPeriods, { name: '', start: '', end: '' }]);
  };

  const updateEditClassPeriod = (index, field, value) => {
    const updated = [...editClassPeriods];
    updated[index] = { ...updated[index], [field]: value };
    setEditClassPeriods(updated);
  };

  const removeEditClassPeriod = (index) => {
    setEditClassPeriods(editClassPeriods.filter((_, i) => i !== index));
  };

  // イベント更新
  const updateEvent = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validDates = editDates.filter(date => date.trim() !== '');
      
      if (validDates.length === 0) {
        toast.error('候補日を少なくとも1つ入力してください');
        setLoading(false);
        return;
      }

      const validEditClassPeriods = editClassPeriods
        .filter(p => p.name.trim() !== '' && p.start && p.end)
        .map(p => ({ name: p.name.trim(), start: p.start, end: p.end }));

      const updateData = {
        title: editTitle,
        description: editDescription,
        candidateDates: validDates,
        classPeriods: validEditClassPeriods,
        defaultInPersonAvailable: editDefaultInPerson,
        responseDeadline: editResponseDeadline ? new Date(editResponseDeadline) : null,
        updatedAt: new Date()
      };

      await updateDoc(doc(db, 'events', editingEvent), updateData);

      // イベント一覧を再読み込み
      setEvents(await fetchAccessibleEvents());

      // 編集モード終了
      cancelEdit();
      toast.success('イベントを更新しました');

    } catch (error) {
      console.error('イベント更新エラー:', error);
      toast.error('イベントの更新に失敗しました');
    }
    setLoading(false);
  };

  return (
    <div className="host-dashboard">
      <div className="header">
        <button onClick={onBack} className="back-btn">← 戻る</button>
        <h2>ホストダッシュボード</h2>
        <p>ようこそ、{user.displayName || user.email}さん</p>
      </div>

      <div className="actions">
        <button 
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="create-btn"
        >
          {showCreateForm ? 'キャンセル' : '新しいイベントを作成'}
        </button>
      </div>

      {showCreateForm && (
        <div className="create-form">
          <h3>新しいイベント作成</h3>
          <p className="form-hint">以下の内容は、回答画面に自動で表示されます（編集不要）。</p>
          <AboutSiteInfo />
          <form onSubmit={createEvent}>
            <div className="form-group">
              <label htmlFor="event-title">イベントタイトル</label>
              <input
                id="event-title"
                name="eventTitle"
                type="text"
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                placeholder="例: チームミーティング"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="event-description">説明（任意）</label>
              <textarea
                id="event-description"
                name="eventDescription"
                value={eventDescription}
                onChange={(e) => setEventDescription(e.target.value)}
                placeholder="イベントの詳細や注意事項を記入してください"
                rows="3"
              />
            </div>

            <div className="form-group">
              <label>候補日程</label>

              {!dateInputMode ? (
                <>
                  <div className="date-input-mode-selector">
                    <button
                      type="button"
                      className="mode-btn"
                      onClick={() => setDateInputMode('single')}
                    >
                      ひとつずつ入力する
                    </button>
                    <button
                      type="button"
                      className="mode-btn"
                      onClick={() => setDateInputMode('range')}
                    >
                      連続日程を追加する
                    </button>
                  </div>
                  <small className="mode-change-hint">
                    選択後も入力方式はいつでも変更できます。
                    {candidateDates.some(d => d.trim()) && (
                      <><br />入力済みの日程は保持されています。</>
                    )}
                  </small>
                </>
              ) : (
                <>
                  {dateInputMode === 'single' ? (
                    <>
                      {candidateDates.map((date, index) => (
                        <div key={index} className="date-input">
                          <input
                            id={`candidate-date-${index}`}
                            name={`candidateDate${index}`}
                            type="date"
                            value={date}
                            min={today}
                            onChange={(e) => updateDate(index, e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={() => removeDate(index)}
                            className="remove-btn"
                          >
                            削除
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={addDateInput}
                        className="add-date-btn"
                      >
                        候補日を追加
                      </button>
                    </>
                  ) : (
                    <div className="date-range-input">
                      <div>
                        <input
                          type="date"
                          value={rangeStart}
                          min={today}
                          onChange={e => setRangeStart(e.target.value)}
                        />
                        <span>〜</span>
                        <input
                          type="date"
                          value={rangeEnd}
                          min={today}
                          onChange={e => setRangeEnd(e.target.value)}
                        />
                        <button
                          type="button"
                          className="add-date-btn"
                          onClick={() => {
                            if (!rangeStart || !rangeEnd) {
                              toast.error('開始日と終了日を入力してください');
                              return;
                            }
                            const start = new Date(rangeStart);
                            const end = new Date(rangeEnd);
                            if (end < start) {
                              toast.error('終了日は開始日以降の日付を選択してください');
                              return;
                            }
                            const dates = [];
                            let d = new Date(start);
                            while (d <= end) {
                              const dayOfWeek = d.getDay(); // 0:日, 6:土
                              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                              const included =
                                rangeDayFilter === 'all' ||
                                (rangeDayFilter === 'weekday' && !isWeekend) ||
                                (rangeDayFilter === 'weekend' && isWeekend);
                              if (included) {
                                const yyyy = d.getFullYear();
                                const mm = String(d.getMonth()+1).padStart(2,'0');
                                const dd = String(d.getDate()).padStart(2,'0');
                                dates.push(`${yyyy}-${mm}-${dd}`);
                              }
                              d.setDate(d.getDate()+1);
                            }
                            const existingDates = candidateDates.filter(date => date.trim() !== '');
                            const newDates = dates.filter(date => !existingDates.includes(date));
                            if (newDates.length === 0) {
                              toast.info(dates.length === 0
                                ? '指定条件に合う日付がありませんでした'
                                : '指定範囲の日付はすでに候補に含まれています');
                              return;
                            }
                            setCandidateDates([...existingDates, ...newDates]);
                            setRangeStart('');
                            setRangeEnd('');
                          }}
                        >
                          追加
                        </button>
                      </div>
                      <div className="range-day-filter">
                        <label>
                          <input
                            type="radio"
                            name="rangeDayFilter"
                            value="all"
                            checked={rangeDayFilter === 'all'}
                            onChange={() => setRangeDayFilter('all')}
                          />
                          すべての日
                        </label>
                        <label>
                          <input
                            type="radio"
                            name="rangeDayFilter"
                            value="weekday"
                            checked={rangeDayFilter === 'weekday'}
                            onChange={() => setRangeDayFilter('weekday')}
                          />
                          平日のみ（土日を除く）
                        </label>
                        <label>
                          <input
                            type="radio"
                            name="rangeDayFilter"
                            value="weekend"
                            checked={rangeDayFilter === 'weekend'}
                            onChange={() => setRangeDayFilter('weekend')}
                          />
                          休日のみ（土日）
                        </label>
                      </div>
                      <small>開始日〜終了日までの日付を条件に沿って一括追加します</small>
                      {candidateDates.some(d => d.trim()) && (
                        <div className="added-dates-preview">
                          {candidateDates.map((date, i) => date.trim() ? (
                            <span key={i} className="date-chip">
                              {date}
                              <button
                                type="button"
                                className="chip-remove"
                                onClick={() => setCandidateDates(prev => prev.filter((_, idx) => idx !== i))}
                              >×</button>
                            </span>
                          ) : null)}
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    className="mode-change-btn"
                    onClick={() => setDateInputMode(null)}
                  >
                    ← 入力方式を変える
                  </button>
                </>
              )}
            </div>

            <div className="form-group">
              <label>授業時間帯（コマ）の設定（任意）</label>
              <small className="help-text">
                大学の時間割に合わせて「1限 9:00〜10:30」のようにコマを設定すると、参加者はコマ単位で参加可能時間を選べるようになります（未設定の場合は午前・午後・夜間のボタンが表示されます）。
              </small>
              {classPeriods.map((period, index) => (
                <div key={index} className="class-period-input">
                  <input
                    type="text"
                    value={period.name}
                    onChange={(e) => updateClassPeriod(index, 'name', e.target.value)}
                    placeholder="例: 1限"
                    className="class-period-name"
                  />
                  <input
                    type="time"
                    value={period.start}
                    onChange={(e) => updateClassPeriod(index, 'start', e.target.value)}
                  />
                  <span>〜</span>
                  <input
                    type="time"
                    value={period.end}
                    onChange={(e) => updateClassPeriod(index, 'end', e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => removeClassPeriod(index)}
                    className="remove-btn"
                  >
                    削除
                  </button>
                </div>
              ))}
              <button type="button" onClick={addClassPeriod} className="add-date-btn">
                コマを追加
              </button>
            </div>

            <div className="form-group">
              <label htmlFor="response-deadline">回答期限（任意）</label>
              <input
                id="response-deadline"
                name="responseDeadline"
                type="datetime-local"
                value={responseDeadline}
                onChange={(e) => setResponseDeadline(e.target.value)}
                placeholder="回答期限を設定してください"
              />
              <small className="help-text">
                期限を設定すると、参加者に期限が表示され、期限後は回答できなくなります
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="default-in-person" className="checkbox-label">
                <input
                  id="default-in-person"
                  name="defaultInPersonAvailable"
                  type="checkbox"
                  checked={defaultInPersonAvailable}
                  onChange={(e) => setDefaultInPersonAvailable(e.target.checked)}
                />
                <span className="checkbox-text">参加者の対面会議を初期状態でONにする</span>
              </label>
              <small className="help-text">
                チェックすると、参加者の回答フォームで「対面での話し合いが可能」が初期選択されます
              </small>
            </div>

            <button type="submit" disabled={loading}>
              {loading ? '作成中...' : 'イベント作成'}
            </button>
          </form>
        </div>
      )}

      <div className="events-list">
        <h3>管理しているイベント</h3>
        {events.length === 0 ? (
          <p>まだイベントがありません</p>
        ) : (
          <div className="event-cards-grid">
          {events.map(event => (
            <div
              key={event.id}
              className={`event-card${editingEvent === event.id ? ' expanded' : ''}`}
            >
              {editingEvent === event.id ? (
                // 編集モード
                <div className="edit-form">
                  <h4>イベント編集</h4>
                  <form onSubmit={updateEvent}>
                    <div className="form-group">
                      <label htmlFor={`edit-title-${event.id}`}>イベントタイトル</label>
                      <input
                        id={`edit-title-${event.id}`}
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor={`edit-description-${event.id}`}>説明（任意）</label>
                      <textarea
                        id={`edit-description-${event.id}`}
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="イベントの説明を入力してください"
                        rows="3"
                      />
                    </div>

                    <div className="form-group">
                      <label>候補日</label>
                      {editDates.map((date, index) => (
                        <div key={index} className="date-input">
                          <input
                            type="text"
                            value={date}
                            onChange={(e) => updateEditDate(index, e.target.value)}
                            placeholder="例: 2024/01/15"
                            required
                          />
                          {editDates.length > 1 && (
                            <button 
                              type="button" 
                              onClick={() => removeEditDate(index)}
                              className="remove-date-btn"
                            >
                              削除
                            </button>
                          )}
                        </div>
                      ))}
                      <button 
                        type="button" 
                        onClick={addEditDateInput}
                        className="add-date-btn"
                      >
                        候補日を追加
                      </button>
                    </div>

                    <div className="form-group">
                      <label>授業時間帯（コマ）の設定（任意）</label>
                      <small className="help-text">
                        大学の時間割に合わせてコマを設定すると、参加者はコマ単位で参加可能時間を選べるようになります。
                      </small>
                      {editClassPeriods.map((period, index) => (
                        <div key={index} className="class-period-input">
                          <input
                            type="text"
                            value={period.name}
                            onChange={(e) => updateEditClassPeriod(index, 'name', e.target.value)}
                            placeholder="例: 1限"
                            className="class-period-name"
                          />
                          <input
                            type="time"
                            value={period.start}
                            onChange={(e) => updateEditClassPeriod(index, 'start', e.target.value)}
                          />
                          <span>〜</span>
                          <input
                            type="time"
                            value={period.end}
                            onChange={(e) => updateEditClassPeriod(index, 'end', e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={() => removeEditClassPeriod(index)}
                            className="remove-btn"
                          >
                            削除
                          </button>
                        </div>
                      ))}
                      <button type="button" onClick={addEditClassPeriod} className="add-date-btn">
                        コマを追加
                      </button>
                    </div>

                    <div className="form-group">
                      <label htmlFor={`edit-deadline-${event.id}`}>回答期限（任意）</label>
                      <input
                        id={`edit-deadline-${event.id}`}
                        type="datetime-local"
                        value={editResponseDeadline}
                        onChange={(e) => setEditResponseDeadline(e.target.value)}
                      />
                      <small className="help-text">
                        期限を設定すると、参加者に期限が表示され、期限後は回答できなくなります
                      </small>
                    </div>

                    <div className="form-group">
                      <label>
                        <input
                          type="checkbox"
                          checked={editDefaultInPerson}
                          onChange={(e) => setEditDefaultInPerson(e.target.checked)}
                        />
                        デフォルトで対面可能とする
                      </label>
                    </div>

                    <div className="edit-actions">
                      <button type="submit" disabled={loading}>
                        {loading ? '更新中...' : '更新'}
                      </button>
                      <button type="button" onClick={cancelEdit}>
                        キャンセル
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                // 通常表示モード
                <>
                  <div className="event-card-summary">
                    <div className="event-card-main">
                      <h4>
                        {event.title}
                        {event.hostId !== user.uid && (
                          <span className="cohost-badge">共同ホスト</span>
                        )}
                      </h4>
                      <p className="event-meta-row">
                        <span>ID: {event.id}</span>
                        <span>作成日: {event.createdAt?.toDate?.()?.toLocaleDateString?.() || '不明'}</span>
                        <span>回答者: {event.responseCount || 0}人</span>
                      </p>
                    </div>
                    <button
                      className="event-expand-btn"
                      onClick={() => setDetailEvent(event)}
                    >
                      詳細を見る
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
          </div>
        )}
      </div>
      {detailEvent && (
        <div className="modal-overlay" onClick={() => setDetailEvent(null)}>
          <div className="modal-box event-detail-modal-box" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">
              {detailEvent.title}
              {detailEvent.hostId !== user.uid && (
                <span className="cohost-badge">共同ホスト</span>
              )}
            </h3>

            {detailEvent.description && (
              <p className="event-description">{detailEvent.description}</p>
            )}
            <p>候補日: {detailEvent.candidateDates.join(', ')}</p>
            {detailEvent.classPeriods && detailEvent.classPeriods.length > 0 && (
              <p>コマ: {detailEvent.classPeriods.map(p => `${p.name}(${p.start}-${p.end})`).join(', ')}</p>
            )}
            {detailEvent.responseDeadline && (
              <p>
                <span className={`deadline-badge${new Date() > detailEvent.responseDeadline.toDate?.() ? ' over' : ''}`}>
                  締切 {detailEvent.responseDeadline.toDate?.()?.toLocaleString?.() || '不明'}
                  {new Date() > detailEvent.responseDeadline.toDate?.() && '（期限切れ）'}
                </span>
              </p>
            )}
            <div className="event-actions">
              <button onClick={() => viewEventResults(detailEvent.id)}>結果を見る</button>
              <button onClick={() => copyShareLink(detailEvent.id)}>共有リンクをコピー</button>
              <button
                className="edit-btn"
                onClick={() => { setDetailEvent(null); startEdit(detailEvent); }}
              >
                編集
              </button>
              {detailEvent.hostId === user.uid && (
                <button
                  className="delete-btn"
                  onClick={() => { setDetailEvent(null); deleteEvent(detailEvent.id, detailEvent.title); }}
                  disabled={loading}
                >
                  削除
                </button>
              )}
            </div>

            {detailEvent.hostId === user.uid && (
              <div className="cohost-section">
                <h5>共同ホスト</h5>
                {(!detailEvent.coHostIds || detailEvent.coHostIds.length === 0) ? (
                  <p className="help-text">まだ共同ホストはいません</p>
                ) : (
                  <ul className="cohost-list">
                    {detailEvent.coHostIds.map(uid => (
                      <li key={uid}>
                        <span>{detailEvent.coHostNames?.[uid] || uid}</span>
                        <button
                          type="button"
                          className="remove-btn"
                          onClick={() => removeCoHost(detailEvent.id, uid)}
                        >
                          削除
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  className="add-date-btn"
                  onClick={() => copyCoHostInviteLink(detailEvent.id)}
                >
                  共同ホスト招待リンクをコピー
                </button>
                <small className="help-text">
                  リンクを開いてログインした人が共同ホストとして追加されます
                </small>
              </div>
            )}

            <div className="modal-actions">
              <button className="modal-btn modal-btn-cancel" onClick={() => setDetailEvent(null)}>閉じる</button>
            </div>
          </div>
        </div>
      )}
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

export default HostDashboard;
