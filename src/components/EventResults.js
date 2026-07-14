import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

const EventResults = ({ eventId, onBack }) => {
  const [event, setEvent] = useState(null);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [overlapResults, setOverlapResults] = useState([]);

  useEffect(() => {
    if (!eventId) {
      setLoading(false);
      return;
    }

    // calculateOverlapsをuseEffect内に移動
    const calculateOverlaps = (responsesData, eventData) => {
      const dateTimeMap = {};
      
      // 各回答の時間帯を分析
      responsesData.forEach(response => {
        // timeSlots が存在し、配列であることを確認
        if (!response.timeSlots || !Array.isArray(response.timeSlots)) {
          return;
        }
        
        response.timeSlots.forEach(slot => {
          const { date, times } = slot;
          if (!date || !times || !Array.isArray(times)) {
            return;
          }
          
          if (!dateTimeMap[date]) {
            dateTimeMap[date] = {};
          }
          
          times.forEach(timeRange => {
            if (!timeRange || typeof timeRange !== 'string') {
              return;
            }
            
            const [start, end] = timeRange.split('-');
            if (!start || !end) {
              return;
            }
            
            const startTime = parseInt(start);
            const endTime = parseInt(end);
            
            if (isNaN(startTime) || isNaN(endTime)) {
              return;
            }
            
            // 30分単位で時間スロットを作成
            for (let time = startTime; time < endTime; time += 30) {
              const timeStr = `${Math.floor(time / 100)}:${(time % 100).toString().padStart(2, '0')}`;
              
              if (!dateTimeMap[date][timeStr]) {
                dateTimeMap[date][timeStr] = [];
              }
              
              dateTimeMap[date][timeStr].push({
                name: response.name,
                inPersonAvailable: response.inPersonAvailable || false
              });
            }
          });
        });
      });
      
      // 重複する時間帯を抽出
      const overlaps = [];
      Object.entries(dateTimeMap).forEach(([date, timeSlots]) => {
        Object.entries(timeSlots).forEach(([time, participants]) => {
          if (participants.length > 1) {
            overlaps.push({
              date,
              time,
              participants: participants.map(p => p.name),
              inPersonCount: participants.filter(p => p.inPersonAvailable).length,
              totalCount: participants.length
            });
          }
        });
      });
      
      // 日付と時間でソート
      overlaps.sort((a, b) => {
        if (a.date !== b.date) {
          return a.date.localeCompare(b.date);
        }
        return a.time.localeCompare(b.time);
      });

      setOverlapResults(overlaps);
    };

    const loadEventAndResponses = async () => {
      setLoading(true);
      try {
        // イベント情報を取得
        const eventDoc = await getDoc(doc(db, 'events', eventId));
        if (!eventDoc.exists()) {
          console.error('イベントが見つかりません');
          setLoading(false);
          return;
        }
        
        const eventData = { id: eventDoc.id, ...eventDoc.data() };
        setEvent(eventData);

        // 回答を取得
        const responsesRef = collection(db, 'events', eventId, 'responses');
        const snapshot = await getDocs(responsesRef);
        
        const responsesData = await Promise.all(
          snapshot.docs.map(async (doc) => {
            const responseData = { id: doc.id, ...doc.data() };
            
            // 各回答の時間スロットを取得
            const timeSlotsRef = collection(db, 'events', eventId, 'responses', doc.id, 'timeSlots');
            const timeSlotsSnapshot = await getDocs(timeSlotsRef);
            
            // timeSlots を確実に配列として設定
            responseData.timeSlots = timeSlotsSnapshot.docs.map(timeSlotDoc => ({
              id: timeSlotDoc.id,
              ...timeSlotDoc.data()
            })) || [];
            
            // timeSlots が空の場合、responseData から直接取得を試みる
            if (responseData.timeSlots.length === 0 && responseData.times) {
              responseData.timeSlots = responseData.times || [];
            }
            
            return responseData;
          })
        );
        
        // 時間順にソート（新しい回答が上に来るように）
        responsesData.sort((a, b) => {
          const aTime = a.submittedAt?.toDate?.() || new Date(0);
          const bTime = b.submittedAt?.toDate?.() || new Date(0);
          return bTime - aTime; // 降順（新しい回答が上）
        });
        
        // デバッグ情報を出力
        console.log('取得した回答データ:', responsesData);
        responsesData.forEach((response, index) => {
          console.log(`回答${index + 1}:`, {
            name: response.name,
            timeSlots: response.timeSlots,
            times: response.times
          });
        });
        
        setResponses(responsesData);
        calculateOverlaps(responsesData, eventData);
      } catch (error) {
        console.error('イベント・回答取得エラー:', error);
      }
      setLoading(false);
    };

    loadEventAndResponses();
  }, [eventId]);

  // 回答削除機能
  const deleteResponse = async (responseId, participantName) => {
    if (!window.confirm(`${participantName}さんの回答を削除しますか？\n\nこの操作は取り消せません。`)) {
      return;
    }

    setLoading(true);
    try {
      // 回答ドキュメントを削除
      await deleteDoc(doc(db, 'events', eventId, 'responses', responseId));
      
      // ページを再読み込みして最新データを取得
      window.location.reload();
      
    } catch (error) {
      console.error('回答削除エラー:', error);
      alert('回答の削除に失敗しました');
      setLoading(false);
    }
  };

  const copyEventLink = () => {
    if (!event) return;
    const url = `${window.location.origin}?eventId=${event.id}`;
    navigator.clipboard.writeText(url).then(() => {
      alert('共有リンクをコピーしました！');
    }).catch(() => {
      alert('コピーに失敗しました');
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

  return (
    <div className="event-results">
      <div className="header">
        <button onClick={onBack} className="back-btn">← 戻る</button>
        <h2>{event.title} - 結果</h2>
      </div>

      <div className="event-info">
        <p><strong>候補日:</strong> {event.candidateDates.join(', ')}</p>
        <p><strong>回答数:</strong> {responses.length}件</p>
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

      {overlapResults.length > 0 && (
        <div className="overlap-section">
          <h3>🎯 参加可能な時間帯（重複あり）</h3>
          <div className="overlap-grid">
            {overlapResults.map((overlap, index) => (
              <div key={index} className="overlap-item">
                <div className="overlap-header">
                  <strong>{overlap.date}</strong>
                  <span className="time-slot">{overlap.time}</span>
                  <span className="participant-count">{overlap.count}人</span>
                </div>
                <div className="participants">
                  {overlap.participants.join(', ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="responses-section">
        <h3>📝 全回答一覧 <small>（新しい回答順）</small></h3>
        {responses.length === 0 ? (
          <p>まだ回答がありません</p>
        ) : (
          <div className="responses-list">
            {responses.map(response => (
              <div key={response.id} className="response-card">
                <div className="response-header">
                  <h4>{response.name}</h4>
                  <button 
                    className="delete-response-btn"
                    onClick={() => deleteResponse(response.id, response.name)}
                    disabled={loading}
                  >
                    削除
                  </button>
                </div>
                <div className="response-times">
                  {(response.timeSlots || []).map((slot, index) => (
                    <div key={index} className="time-slot-response">
                      <strong>{slot.date || '日付不明'}:</strong>
                      <span>{slot.timeSlots?.map(ts => ts.timeRange).join(', ') || slot.times?.join(', ') || '時間未設定'}</span>
                    </div>
                  ))}
                </div>
                {response.memo && (
                  <div className="response-memo">
                    <strong>備考:</strong> {response.memo}
                  </div>
                )}
                <div className="response-meta">
                  回答日時: {response.submittedAt?.toDate?.()?.toLocaleDateString?.('ja-JP', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) || '不明'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default EventResults;
