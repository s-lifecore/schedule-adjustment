import React, { useState, useEffect, useCallback } from 'react';
import { collection, addDoc, doc, getDoc, query, where, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useToast, ToastContainer } from './Toast';
import ConfirmModal from './ConfirmModal';

const ClientParticipation = ({ user, onBack, initialEventId, mode = 'join', isSharedLinkAccess = false, sharedEventId }) => {
  const [eventId, setEventId] = useState(sharedEventId || initialEventId || '');
  const [event, setEvent] = useState(null);
  const [participantName, setParticipantName] = useState('');
  const [timeSlots, setTimeSlots] = useState({});
  const [memo, setMemo] = useState('');
  const [loading, setLoading] = useState(false);
  const [saveHistory, setSaveHistory] = useState(false);
  const [showTimeInputFor, setShowTimeInputFor] = useState(null);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [timeSlotInPersonAvailable, setTimeSlotInPersonAvailable] = useState(false);
  const [showAllDayFor, setShowAllDayFor] = useState(null);
  const [allDayInPerson, setAllDayInPerson] = useState(false);
  const [currentMode, setCurrentMode] = useState(mode);
  const [existingResponseNotice, setExistingResponseNotice] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(null);
  const { toast, toasts } = useToast();
  const [expandedResponses, setExpandedResponses] = useState(new Set());
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, onConfirm: null });
  const closeConfirmModal = () => setConfirmModal({ isOpen: false, onConfirm: null });
  const deleteHistoryItem = async (responseId) => {
    try {
      await deleteDoc(doc(db, 'userResponses', responseId));
      setResponseHistory(prev => prev.filter(r => r.id !== responseId));
      toast.success('履歴を削除しました');
    } catch (e) {
      toast.error('削除に失敗しました');
    }
  };

  const toggleExpandResponse = (id) => setExpandedResponses(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const sortByInPerson = (slots) =>
    [...slots].sort((a, b) => (b.inPersonAvailable ? 1 : 0) - (a.inPersonAvailable ? 1 : 0));

  // イベントIDが入力された際、自動的に「新規参加」タブに切り替える
  useEffect(() => {
    if (eventId && eventId.trim().length > 0 && currentMode === 'history') {
      setCurrentMode('join');
    }
  }, [eventId, currentMode]);
  const [responseHistory, setResponseHistory] = useState([]);
  const [isConfirming, setIsConfirming] = useState(false);

  // URLからイベントIDを抽出する関数
  const extractEventIdFromUrl = (input) => {
    // 入力された文字列がURLかどうかチェック
    if (input.includes('http') || input.includes('eventId=')) {
      try {
        // eventId=XXX の形式からIDを抽出
        const eventIdMatch = input.match(/eventId=([^&\s]+)/);
        if (eventIdMatch) {
          return eventIdMatch[1];
        }
        
        // URLの最後の部分がイベントIDの可能性もチェック
        const urlParts = input.split('/');
        const lastPart = urlParts[urlParts.length - 1];
        if (lastPart && lastPart.length > 10) { // Firestore IDは通常20文字程度
          return lastPart;
        }
      } catch (error) {
        console.log('URL解析エラー:', error);
      }
    }
    
    // URLでない場合はそのまま返す
    return input;
  };

  // イベントID入力のハンドラー
  const handleEventIdInput = useCallback((value) => {
    const extractedId = extractEventIdFromUrl(value);
    setEventId(extractedId);
    
    // URLが入力された場合の視覚的フィードバック
    if (value !== extractedId) {
      // URLからIDを抽出した場合は少し遅れて表示
      setTimeout(() => {
        console.log(`URLからイベントIDを抽出しました: ${extractedId}`);
      }, 100);
    }

    // IDが入力されたら自動で「新規参加」タブへ
    if (extractedId.trim()) {
      setCurrentMode('join');
    }
  }, []);

  const findEvent = useCallback(async () => {
    if (!eventId.trim()) {
      toast.error('イベントIDを入力してください');
      return;
    }

    setLoading(true);
    try {
      // イベントIDで直接ドキュメントを取得
      const eventRef = doc(db, 'events', eventId);
      const eventSnapshot = await getDoc(eventRef);
      
      if (eventSnapshot.exists()) {
        const foundEvent = { id: eventSnapshot.id, ...eventSnapshot.data() };
        setEvent(foundEvent);
        // 各候補日の時間帯を初期化
        const initialTimeSlots = {};
        foundEvent.candidateDates.forEach(date => {
          initialTimeSlots[date] = [];
        });
        setTimeSlots(initialTimeSlots);
        
        // ログインユーザーの場合、既存の回答があるかチェック
        if (user) {
          try {
            const responsesRef = collection(db, 'events', eventSnapshot.id, 'responses');
            const existingResponseQuery = query(responsesRef, where('userId', '==', user.uid));
            const existingResponseSnapshot = await getDocs(existingResponseQuery);
            
            if (!existingResponseSnapshot.empty) {
              const existingResponse = existingResponseSnapshot.docs[0].data();
              
              // 既存の参加者名を自動入力
              if (existingResponse.name) {
                setParticipantName(existingResponse.name);
              }
              
              // 既存のメモを自動入力
              if (existingResponse.memo) {
                setMemo(existingResponse.memo);
              }
              
              // 既存の時間スロットを取得して自動入力
              const responseId = existingResponseSnapshot.docs[0].id;
              const timeSlotsRef = collection(db, 'events', eventSnapshot.id, 'responses', responseId, 'timeSlots');
              const timeSlotsSnapshot = await getDocs(timeSlotsRef);
              
              const existingTimeSlots = {};
              foundEvent.candidateDates.forEach(date => {
                existingTimeSlots[date] = [];
              });
              
              timeSlotsSnapshot.docs.forEach(doc => {
                const slotData = doc.data();
                if (slotData.date && slotData.timeSlots) {
                  existingTimeSlots[slotData.date] = sortByInPerson(slotData.timeSlots);
                }
              });
              
              setTimeSlots(existingTimeSlots);
              
              setExistingResponseNotice(true);
            }
          } catch (error) {
            console.error('既存回答の取得エラー:', error);
            // エラーがあっても処理は継続
          }
        }
        
        // イベント読み込み完了
      } else {
        toast.error('イベントが見つかりませんでした');
      }
    } catch (error) {
      console.error('イベント検索エラー:', error);
      toast.error('イベント検索に失敗しました');
    }
    setLoading(false);
  }, [eventId, user, toast]);

  // 初期イベントIDが提供された場合、自動的にイベントを検索
  useEffect(() => {
    if (initialEventId && initialEventId.trim()) {
      findEvent();
    }
  }, [initialEventId, findEvent]);

  // 共有リンクアクセス時の自動読み込み
  useEffect(() => {
    if (isSharedLinkAccess && sharedEventId && sharedEventId.trim()) {
      setEventId(sharedEventId);
      findEvent();
    }
  }, [isSharedLinkAccess, sharedEventId, findEvent]);

  // ログイン状態の変化を監視し、保存された状態を復元
  useEffect(() => {
    if (user) {
      const savedState = sessionStorage.getItem('preLoginState');
      if (savedState) {
        try {
          const state = JSON.parse(savedState);
          if (state.returnTo === 'client-join') {
            // 保存された状態を復元
            setEventId(state.eventId || '');
            setParticipantName(state.participantName || '');
            setTimeSlots(state.timeSlots || {});
            setMemo(state.memo || '');
            setSaveHistory(state.saveHistory || false);
            
            // セッションストレージをクリア
            sessionStorage.removeItem('preLoginState');
            
            // 元の回答画面に遷移
            window.history.replaceState({}, '', '/event/join');
          }
        } catch (error) {
          console.log('保存状態の復元エラー:', error);
        }
      }
      
      // ユーザー名が空で、ユーザーがログイン済みの場合、自動補完
      if (!participantName && user.displayName) {
        setParticipantName(user.displayName);
      }
    }
  }, [user, participantName]);

  // ユーザーログイン時の名前自動補完
  useEffect(() => {
    if (user && user.displayName && !participantName) {
      setParticipantName(user.displayName);
    }
  }, [user, participantName]);

  // ユーザーの回答履歴を取得する関数
  const loadResponseHistory = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // ユーザーの回答履歴を取得
      const responsesQuery = query(
        collection(db, 'userResponses'),
        where('userId', '==', user.uid)
      );
      const responsesSnapshot = await getDocs(responsesQuery);
      
      const historyData = await Promise.all(
        responsesSnapshot.docs.map(async (responseDoc) => {
          const responseData = responseDoc.data();
          
          // 各回答に対応するイベント情報を取得
          try {
            const eventDoc = await getDoc(doc(db, 'events', responseData.eventId));
            const eventData = eventDoc.exists() ? eventDoc.data() : null;
            
            return {
              id: responseDoc.id,
              eventId: responseData.eventId,
              eventTitle: eventData?.title || '削除されたイベント',
              eventDescription: eventData?.description || '',
              participantName: responseData.participantName,
              submittedAt: responseData.submittedAt,
              timeSlots: responseData.timeSlots,
              memo: responseData.memo,
              isDeleted: !eventDoc.exists(),
            };
          } catch (eventError) {
            console.error('イベント情報取得エラー:', eventError);
            return {
              id: responseDoc.id,
              eventId: responseData.eventId,
              eventTitle: '取得エラー',
              eventDescription: '',
              participantName: responseData.participantName,
              submittedAt: responseData.submittedAt,
              timeSlots: responseData.timeSlots,
              memo: responseData.memo
            };
          }
        })
      );
      
      // 送信日時で降順ソート
      historyData.sort((a, b) => {
        const dateA = a.submittedAt?.toDate?.() || new Date(a.submittedAt) || new Date(0);
        const dateB = b.submittedAt?.toDate?.() || new Date(b.submittedAt) || new Date(0);
        return dateB - dateA;
      });
      
      setResponseHistory(historyData);
    } catch (error) {
      console.error('回答履歴取得エラー:', error);
    }
    setLoading(false);
  }, [user]);

  // ユーザーがログインした時に履歴を読み込む
  useEffect(() => {
    if (user && currentMode === 'history') {
      loadResponseHistory();
    }
  }, [user, currentMode, loadResponseHistory]);

  const addTimeSlot = (date) => {
    setShowTimeInputFor(date);
    setShowAllDayFor(null);
    setStartTime('');
    setEndTime('');
    setTimeSlotInPersonAvailable(event?.defaultInPersonAvailable || false);
  };

  // 全日可ボタン：対面選択フォームを表示
  const addAllDaySlot = (date) => {
    setShowAllDayFor(date);
    setAllDayInPerson(event?.defaultInPersonAvailable || false);
    setShowTimeInputFor(null);
  };

  const confirmAllDaySlot = (date) => {
    setTimeSlots(prev => ({
      ...prev,
      [date]: sortByInPerson([...prev[date], { timeRange: '09:00-21:00', inPersonAvailable: allDayInPerson }])
    }));
    setShowAllDayFor(null);
    setAllDayInPerson(false);
  };

  // 全角数字を半角に変換する関数
  const convertToHalfWidth = (str) => {
    return str.replace(/[０-９]/g, (char) => {
      return String.fromCharCode(char.charCodeAt(0) - 0xFEE0);
    });
  };

  // 4桁の時間を HH:MM 形式にフォーマットする関数
  const formatTimeDisplay = (timeStr) => {
    if (timeStr.length === 4) {
      return `${timeStr.slice(0, 2)}:${timeStr.slice(2, 4)}`;
    }
    return timeStr;
  };

  const isValidTime = (timeStr) => {
    if (timeStr.length !== 4) return false;
    const hours = parseInt(timeStr.slice(0, 2));
    const minutes = parseInt(timeStr.slice(2, 4));
    return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
  };

  // 終了時間用：2400（深夜0時）まで許容
  const isValidEndTime = (timeStr) => {
    if (timeStr.length !== 4) return false;
    if (timeStr === '2400') return true;
    return isValidTime(timeStr);
  };

  // maxHour: 開始時間は23、終了時間は24
  const handleTimeInput = (value, setter, maxHour = 23) => {
    let converted = convertToHalfWidth(value);
    converted = converted.replace(/[^0-9]/g, '');

    if (converted.length <= 4) {
      if (converted.length >= 2) {
        const hours = parseInt(converted.slice(0, 2));
        if (hours > maxHour) {
          toast.error('翌日の時間帯に入力してください');
          converted = String(maxHour).padStart(2, '0') + converted.slice(2);
        } else if (hours === 24 && converted.length === 4) {
          const minutes = parseInt(converted.slice(2, 4));
          if (minutes > 0) {
            toast.error('翌日の時間帯に入力してください');
            converted = '2400';
          }
        } else if (hours < 24 && converted.length === 4) {
          const minutes = parseInt(converted.slice(2, 4));
          if (minutes > 59) {
            converted = converted.slice(0, 2) + '59';
          }
        }
      }
      setter(converted);
    }
  };

  const confirmTimeSlot = (date) => {
    if (!startTime || !endTime) {
      toast.error('開始時間と終了時間を入力してください');
      return;
    }

    const normalizedStartTime = convertToHalfWidth(startTime);
    const normalizedEndTime = convertToHalfWidth(endTime);

    if (normalizedStartTime.length !== 4 || normalizedEndTime.length !== 4) {
      toast.error('時間は4桁の数字で入力してください（例: 0900）');
      return;
    }

    if (!isValidTime(normalizedStartTime)) {
      toast.error('開始時間が正しくありません（時: 00-23、分: 00-59）');
      return;
    }

    if (!isValidEndTime(normalizedEndTime)) {
      if (parseInt(normalizedEndTime.slice(0, 2)) > 24) {
        toast.error('翌日の時間帯に入力してください');
      } else {
        toast.error('終了時間が正しくありません（時: 00-24、分: 00-59）');
      }
      return;
    }

    const startTimeNum = parseInt(normalizedStartTime);
    const endTimeNum = parseInt(normalizedEndTime);
    if (startTimeNum >= endTimeNum) {
      toast.error('開始時間は終了時間より前に設定してください');
      return;
    }
    
    const timeRange = `${formatTimeDisplay(normalizedStartTime)}-${formatTimeDisplay(normalizedEndTime)}`;
    const isDuplicate = (timeSlots[date] || []).some(
      slot => slot.timeRange === timeRange && slot.inPersonAvailable === timeSlotInPersonAvailable
    );
    if (isDuplicate) {
      toast.error('同じ時間帯・参加形式がすでに登録されています');
      return;
    }

    const timeSlotObj = { timeRange, inPersonAvailable: timeSlotInPersonAvailable };

    setTimeSlots(prev => ({
      ...prev,
      [date]: sortByInPerson([...prev[date], timeSlotObj])
    }));
    
    // 入力フォームを閉じる
    setShowTimeInputFor(null);
    setStartTime('');
    setEndTime('');
    setTimeSlotInPersonAvailable(false);
  };

  const cancelTimeSlot = () => {
    setShowTimeInputFor(null);
    setStartTime('');
    setEndTime('');
    setTimeSlotInPersonAvailable(false);
  };

  const removeTimeSlot = (date, index) => {
    setTimeSlots(prev => ({
      ...prev,
      [date]: prev[date].filter((_, i) => i !== index)
    }));
  };

  // 確認画面へ進む
  const handleToConfirm = () => {
    if (!participantName.trim()) {
      toast.error('お名前を入力してください');
      return;
    }
    setIsConfirming(true);
    // 確認画面へスクロール
    window.scrollTo(0, 0);
  };

  const submitResponse = async () => {
    if (event.responseDeadline && new Date() > event.responseDeadline.toDate?.()) {
      toast.error('回答期限を過ぎているため回答できません');
      return;
    }

    setLoading(true);
    try {
      let isUpdate = false;
      let existingResponseId = null;
      let existingUserResponseId = null;

      // ログインユーザーの場合、既存の回答をチェック
      if (user) {
        // イベント内の既存回答をチェック
        const responsesRef = collection(db, 'events', event.id, 'responses');
        const existingResponseQuery = query(responsesRef, where('userId', '==', user.uid));
        const existingResponseSnapshot = await getDocs(existingResponseQuery);
        
        if (!existingResponseSnapshot.empty) {
          existingResponseId = existingResponseSnapshot.docs[0].id;
          isUpdate = true;
        }

        // userResponsesコレクションの既存回答もチェック
        const userResponsesQuery = query(
          collection(db, 'userResponses'),
          where('userId', '==', user.uid),
          where('eventId', '==', event.id)
        );
        const userResponseSnapshot = await getDocs(userResponsesQuery);
        
        if (!userResponseSnapshot.empty) {
          existingUserResponseId = userResponseSnapshot.docs[0].id;
        }
      }

      const responseData = {
        name: participantName,
        userId: user?.uid || null,
        memo: memo,
        submittedAt: new Date(),
        saveToHistory: user ? true : saveHistory, // ログインユーザーは自動的に履歴保存
        ...(isUpdate && { updatedAt: new Date() })
      };

      let responseDocId;

      if (isUpdate && existingResponseId) {
        // 既存回答を更新
        await updateDoc(doc(db, 'events', event.id, 'responses', existingResponseId), responseData);
        responseDocId = existingResponseId;
      } else {
        // 新規回答を作成
        const responsesRef = collection(db, 'events', event.id, 'responses');
        const responseDoc = await addDoc(responsesRef, responseData);
        responseDocId = responseDoc.id;
      }
      
      // timeSlotsサブコレクションに時間帯を保存
      const timeSlotsData = Object.entries(timeSlots)
        .filter(([_, slots]) => slots.length > 0)
        .map(([date, slots]) => ({ 
          date, 
          timeSlots: slots.map(slot => ({
            timeRange: slot.timeRange,
            inPersonAvailable: slot.inPersonAvailable
          }))
        }));
      
      const timeSlotsRef = collection(db, 'events', event.id, 'responses', responseDocId, 'timeSlots');
      
      if (isUpdate) {
        // 既存のtimeSlotsを削除してから新しいものを追加
        const existingTimeSlotsSnapshot = await getDocs(timeSlotsRef);
        const deletePromises = existingTimeSlotsSnapshot.docs.map(doc => 
          deleteDoc(doc.ref)
        );
        await Promise.all(deletePromises);
      }
      
      // 各日付の時間帯を個別に保存
      for (const timeSlot of timeSlotsData) {
        await addDoc(timeSlotsRef, timeSlot);
      }
      
      // ログインユーザーの場合、userResponsesコレクションにも保存/更新
      if (user) {
        const userResponseData = {
          eventId: event.id,
          eventTitle: event.title,
          eventDescription: event.description || '',
          participantName: participantName,
          userId: user.uid,
          timeSlots: timeSlots,
          memo: memo,
          submittedAt: new Date(),
          ...(isUpdate && { updatedAt: new Date() })
        };
        
        if (existingUserResponseId) {
          // 既存のuserResponse更新
          await updateDoc(doc(db, 'userResponses', existingUserResponseId), userResponseData);
        } else {
          // 新規userResponse作成
          await addDoc(collection(db, 'userResponses'), userResponseData);
        }
      }
      
      const message = isUpdate
        ? '回答を更新しました。履歴も自動で更新されています。'
        : '回答を送信しました。';

      setSubmitSuccess(message);

      setTimeout(() => {
        window.location.href = '/event/history';
      }, 3000);

    } catch (error) {
      console.error('回答送信エラー:', error);
      toast.error('回答の送信に失敗しました');
    }
    setLoading(false);
  };

  return (
    <div className="client-participation">
    <div className="header">
    <button onClick={onBack} className="back-btn">← 戻る</button>
    <h2>日程調整への参加</h2>
    </div>

    {/* イベント説明を表示（イベントが存在し、説明がある場合のみ） */}
    {event && event.description && (
    <div className="event-description client-description">
      <strong>イベント説明:</strong><br />
      <span>{event.description}</span>
    </div>
    )}

      {isSharedLinkAccess && (
        <div className="shared-link-header">
          <div className="invitation-banner">
            <h3>イベントに招待されました！</h3>
            <p>共有リンクからアクセスしています。下記のイベントに参加するために回答してください。</p>
          </div>
        </div>
      )}

      {/* モード切り替えタブ */}
      {!isSharedLinkAccess && (
        <div className="mode-tabs">
          <button 
            className={`tab-btn ${currentMode === 'join' ? 'active' : ''}`}
            onClick={() => setCurrentMode('join')}
          >
            新規参加
          </button>
          <button 
            className={`tab-btn ${currentMode === 'history' ? 'active' : ''}`}
            onClick={() => {
              setCurrentMode('history');
              if (user) {
                loadResponseHistory();
              }
            }}
            disabled={!user}
          >
            回答履歴
            {!user && <small>（ログイン必要）</small>}
          </button>
        </div>
      )}
      
      {isSharedLinkAccess && (
        <div className="shared-link-mode">
          <h3>イベント参加フォーム</h3>
        </div>
      )}



      {currentMode === 'join' ? (
        // 新規参加モード
        <div className="join-mode">
          {!event ? (
        <div className="event-search">
          <div className="form-group">
            <label htmlFor="event-id">イベントID</label>
            <input
              id="event-id"
              name="eventId"
              type="text"
              value={eventId}
              onChange={(e) => handleEventIdInput(e.target.value)}
              placeholder="ホストから共有されたイベントIDまたはURLを入力"
            />
            <small className="help-text">
              共有リンク（URL）を貼り付けると、自動的にイベントIDが抽出されます
            </small>
          </div>
          <button onClick={findEvent} disabled={loading}>
            {loading ? '検索中...' : 'イベントを検索'}
          </button>
        </div>
      ) : (
        <div className="response-form">
          {existingResponseNotice && (
            <div className="notice-banner notice-info">
              以前の回答が見つかりました。参加者名・時間選択・メモが自動入力されています。必要に応じて修正してから再送信してください。
            </div>
          )}
          <div className="event-info">
            <h3>{event.title}</h3>
            <p>ホスト: {event.hostName}</p>
            {event.responseDeadline && (
              <div className="deadline-info">
                <p>
                  <strong>回答期限:</strong> {event.responseDeadline.toDate?.()?.toLocaleString?.() || '不明'}
                  {new Date() > event.responseDeadline.toDate?.() && (
                    <span className="deadline-expired"> (期限切れ)</span>
                  )}
                </p>
                {new Date() > event.responseDeadline.toDate?.() && (
                  <div className="deadline-expired-message">
                    <p>回答期限を過ぎているため、新規回答・変更はできません。</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="participant-name">お名前 *</label>
            <input
              id="participant-name"
              name="participantName"
              type="text"
              value={participantName}
              onChange={(e) => setParticipantName(e.target.value)}
              placeholder={user ? "以前の回答から自動入力されています（修正可能）" : "山田太郎"}
              required
            />
            {user && participantName && (
              <small className="name-hint">
                以前と同じ名前が入力されています。必要に応じて修正してください。
              </small>
            )}
          </div>

          <div className="time-slots-section">
            <h4>参加可能な時間帯を選択</h4>
            <p className="optional-notice">
              ※ 各日程への入力は任意です。参加可能な日程のみ時間帯を入力してください。
            </p>
            {event.candidateDates.map(date => (
              <div key={date} className="date-section">
                <h5>{date} <small className="optional-text">（任意）</small></h5>
                <div className="time-slots">
                  {timeSlots[date]?.map((slot, index) => (
                    <div key={index} className="time-slot">
                      <div className="time-slot-info">
                        <span className="time-range">{slot.timeRange}</span>
                        <span className={`in-person-status ${slot.inPersonAvailable ? 'available' : 'not-available'}`}>
                          {slot.inPersonAvailable ? '対面可' : 'オンラインのみ'}
                        </span>
                      </div>
                      <button onClick={() => removeTimeSlot(date, index)} className="remove-btn">
                        削除
                      </button>
                    </div>
                  ))}
                  
                  {/* インライン時間入力フォーム */}
                  {showTimeInputFor === date ? (
                    <div className="time-input-form">
                      <div className="time-inputs">
                        <div className="time-field">
                          <input
                            type="text"
                            placeholder="0900"
                            value={startTime}
                            onChange={(e) => handleTimeInput(e.target.value, setStartTime)}
                            maxLength="4"
                            className={
                              startTime.length === 4 && !isValidTime(startTime) ? 'invalid' :
                              startTime.length !== 4 && startTime.length > 0 ? 'partial' : ''
                            }
                          />
                          <small className="char-count">
                            {startTime.length}/4
                            {startTime.length === 4 && (
                              <span className={isValidTime(startTime) ? 'valid' : 'invalid-time'}>
                                {isValidTime(startTime) ? ` ✓ (${formatTimeDisplay(startTime)})` : ' ✗'}
                              </span>
                            )}
                          </small>
                        </div>
                        <span>-</span>
                        <div className="time-field">
                          <input
                            type="text"
                            placeholder="1800"
                            value={endTime}
                            onChange={(e) => handleTimeInput(e.target.value, setEndTime, 24)}
                            maxLength="4"
                            className={
                              endTime.length === 4 && !isValidEndTime(endTime) ? 'invalid' :
                              endTime.length !== 4 && endTime.length > 0 ? 'partial' : ''
                            }
                          />
                          <small className="char-count">
                            {endTime.length}/4
                            {endTime.length === 4 && (
                              <span className={isValidEndTime(endTime) ? 'valid' : 'invalid-time'}>
                                {isValidEndTime(endTime) ? ` ✓ (${formatTimeDisplay(endTime)})` : ' ✗'}
                              </span>
                            )}
                          </small>
                        </div>
                      </div>
                      
                      <div className="time-slot-options">
                        <label htmlFor={`in-person-${date}`} className="checkbox-label">
                          <input
                            id={`in-person-${date}`}
                            type="checkbox"
                            checked={timeSlotInPersonAvailable}
                            onChange={(e) => setTimeSlotInPersonAvailable(e.target.checked)}
                          />
                          <span className="checkbox-text">この時間帯は対面参加可能</span>
                        </label>
                      </div>
                      
                      <div className="time-input-buttons">
                        <button onClick={() => confirmTimeSlot(date)} className="confirm-btn">
                          確定
                        </button>
                        <button onClick={cancelTimeSlot} className="cancel-btn">
                          キャンセル
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="add-time-actions">
                        <button
                          onClick={() => addTimeSlot(date)}
                          className="add-time-btn"
                        >
                          時間帯を追加
                        </button>
                        <button
                          onClick={() => addAllDaySlot(date)}
                          className="add-all-day-btn"
                        >
                          全日可 (09:00-21:00)
                        </button>
                        <small className="add-time-hint">繰り返し追加して複数の時間帯を設定できます</small>
                      </div>
                      {showAllDayFor === date && (
                        <div className="time-input-form all-day-confirm-form">
                          <label htmlFor={`all-day-in-person-${date}`} className="checkbox-label">
                            <input
                              id={`all-day-in-person-${date}`}
                              type="checkbox"
                              checked={allDayInPerson}
                              onChange={(e) => setAllDayInPerson(e.target.checked)}
                            />
                            <span className="checkbox-text">この時間帯は対面参加可能</span>
                          </label>
                          <div className="time-input-buttons">
                            <button onClick={() => confirmAllDaySlot(date)} className="confirm-btn">確定</button>
                            <button onClick={() => setShowAllDayFor(null)} className="cancel-btn">キャンセル</button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="form-group">
            <label htmlFor="memo">備考（任意）</label>
            <textarea
              id="memo"
              name="memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="特記事項があれば記入してください"
              rows="3"
            />
          </div>

          <div className="form-group">
            {user ? (
              <div className="logged-in-history-info">
                <p className="auto-save-info">
                  ログイン中のため、回答は自動的に履歴として保存されます
                  {Object.keys(timeSlots).length > 0 && (
                    <small>（既に回答済みの場合は履歴が更新されます）</small>
                  )}
                </p>
              </div>
            ) : (
              <label htmlFor="save-history">
                <input
                  id="save-history"
                  name="saveHistory"
                  type="checkbox"
                  checked={saveHistory}
                  onChange={(e) => setSaveHistory(e.target.checked)}
                />
                履歴として保存する（ログインが必要）
              </label>
            )}
            {saveHistory && !user && (
              <div className="warning">
                <p>履歴保存にはログインが必要です</p>
                <button 
                  className="login-link-btn"
                  onClick={() => {
                    // 現在の状態をセッションストレージに保存
                    const currentState = {
                      eventId,
                      participantName,
                      timeSlots,
                      memo,
                      saveHistory,
                      returnTo: 'client-join'
                    };
                    sessionStorage.setItem('preLoginState', JSON.stringify(currentState));
                    
                    // ログイン画面に遷移
                    window.location.href = '/host';
                  }}
                >
                  ログイン画面へ
                </button>
              </div>
            )}
          </div>

          <button
            onClick={handleToConfirm}
            disabled={loading || (event.responseDeadline && new Date() > event.responseDeadline.toDate?.())}
            className="submit-btn"
          >
            {loading ? '処理中...' :
             (event.responseDeadline && new Date() > event.responseDeadline.toDate?.()) ?
             '期限切れ' : '確認画面へ'}
          </button>

          {isConfirming && (
            <div className="modal-overlay" onClick={!submitSuccess ? () => setIsConfirming(false) : undefined}>
              <div className="modal-box confirm-modal-box" onClick={e => e.stopPropagation()}>
                {submitSuccess ? (
                  <div className="confirm-success">
                    <p className="confirm-success-message">{submitSuccess}</p>
                    <small className="confirm-success-hint">3秒後に回答履歴画面へ移動します…</small>
                  </div>
                ) : (
                  <>
                    <h3 className="modal-title">入力内容の確認</h3>
                    <p className="modal-message">以下の内容で送信します。よろしいですか？</p>

                    <div className="confirm-modal-content">
                      <div className="confirm-item">
                        <strong>お名前</strong>
                        <span>{participantName}</span>
                      </div>

                      <div className="confirm-item">
                        <strong>参加可能時間帯</strong>
                        {Object.entries(timeSlots).some(([_, slots]) => slots.length > 0) ? (
                          <div className="confirm-slots-list">
                            {Object.entries(timeSlots)
                              .filter(([_, slots]) => slots.length > 0)
                              .map(([date, slots]) => (
                                <div key={date} className="confirm-date-group">
                                  <span className="confirm-date">{date}</span>
                                  <div className="confirm-slots">
                                    {slots.map((slot, idx) => (
                                      <span key={idx} className="confirm-slot-badge">
                                        {slot.timeRange} {slot.inPersonAvailable ? '(対面可)' : '(オンライン)'}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                          </div>
                        ) : (
                          <span className="no-slots-warning">選択された時間帯はありません</span>
                        )}
                      </div>

                      {memo && (
                        <div className="confirm-item">
                          <strong>備考</strong>
                          <div className="confirm-memo-text">{memo}</div>
                        </div>
                      )}
                    </div>

                    <div className="modal-actions">
                      <button
                        onClick={() => setIsConfirming(false)}
                        className="modal-btn modal-btn-cancel"
                        disabled={loading}
                      >
                        修正する
                      </button>
                      <button
                        onClick={submitResponse}
                        disabled={loading}
                        className="modal-btn modal-btn-primary"
                      >
                        {loading ? '送信中...' : 'この内容で送信する'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
          </div>
        )}
        </div>
      ) : (
        // 回答履歴モード
        <div className="history-mode">
          {!user ? (
            <div className="login-required">
              <p>回答履歴を見るにはログインが必要です</p>
              <button 
                className="login-link-btn"
                onClick={() => {
                  window.location.href = '/host';
                }}
              >
                ログイン画面へ
              </button>
            </div>
          ) : loading ? (
            <div className="loading">履歴を読み込み中...</div>
          ) : responseHistory.length === 0 ? (
            <div className="no-history">
              <p>まだ回答履歴がありません</p>
              <button 
                className="switch-mode-btn"
                onClick={() => setCurrentMode('join')}
              >
                新規参加する
              </button>
            </div>
          ) : (
            <div className="history-list">
              <div className="history-header-section">
                <h3>あなたの回答履歴</h3>
                <button 
                  className="refresh-btn"
                  onClick={loadResponseHistory}
                  disabled={loading}
                >
                  {loading ? '更新中...' : '更新'}
                </button>
              </div>
              {responseHistory.map((response) => (
                <div key={response.id} className={`history-item${response.isDeleted ? ' history-item-deleted' : ''}`}>
                  <div className="event-card-summary">
                    <div className="event-card-main">
                      <h4>{response.eventTitle}</h4>
                      <p className="event-meta-row">
                        <span>回答日時: {response.submittedAt?.toDate?.()?.toLocaleString?.() || '日時不明'}</span>
                      </p>
                    </div>
                    <div className="event-card-actions">
                      {response.isDeleted && (
                        <button
                          className="history-delete-btn"
                          onClick={() => setConfirmModal({
                            isOpen: true,
                            onConfirm: () => { closeConfirmModal(); deleteHistoryItem(response.id); },
                          })}
                        >
                          削除
                        </button>
                      )}
                      <button
                        className="event-expand-btn"
                        onClick={() => toggleExpandResponse(response.id)}
                      >
                        {expandedResponses.has(response.id) ? '閉じる' : '詳細を見る'}
                      </button>
                    </div>
                  </div>

                  {expandedResponses.has(response.id) && (
                    <div className="event-card-detail">
                      {response.eventDescription && (
                        <p className="event-description">{response.eventDescription}</p>
                      )}
                      <div className="response-details">
                        <p><strong>参加者名:</strong> {response.participantName}</p>
                        {Object.keys(response.timeSlots).length > 0 && (
                          <div className="time-slots-summary">
                            <p><strong>選択した時間帯:</strong></p>
                            <ul>
                              {Object.entries(response.timeSlots).map(([date, slots]) => (
                                <li key={date}>
                                  <strong>{date}</strong>
                                  <ul>
                                    {slots.map((slot, index) => (
                                      <li key={index}>
                                        {slot.timeRange}
                                        {slot.inPersonAvailable && ' (対面可能)'}
                                      </li>
                                    ))}
                                  </ul>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {response.memo && (
                          <div className="memo">
                            <p><strong>メモ:</strong></p>
                            <p>{response.memo}</p>
                          </div>
                        )}
                      </div>
                      <div className="history-actions">
                        <button
                          className="view-event-btn"
                          onClick={() => {
                            setEventId(response.eventId);
                            setCurrentMode('join');
                            handleEventIdInput(response.eventId);
                          }}
                        >
                          このイベントを表示
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <ToastContainer toasts={toasts} />
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title="削除しますか？"
        message="この履歴を削除します。この操作は取り消せません。"
        confirmLabel="削除する"
        cancelLabel="やめておく"
        onConfirm={confirmModal.onConfirm}
        onCancel={closeConfirmModal}
      />
    </div>
  );
};

export default ClientParticipation;
