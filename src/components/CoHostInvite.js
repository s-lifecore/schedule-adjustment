import React, { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../services/firebase';
import AuthComponent from './AuthComponent';
import { useToast, ToastContainer } from './Toast';

const CoHostInvite = ({ user, eventId, onBack, onDone }) => {
  const [event, setEvent] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(false);
  const [joined, setJoined] = useState(false);
  const { toast, toasts } = useToast();

  const loadEvent = useCallback(async () => {
    if (!eventId) {
      setNotFound(true);
      return;
    }
    try {
      const eventSnapshot = await getDoc(doc(db, 'events', eventId));
      if (!eventSnapshot.exists()) {
        setNotFound(true);
        return;
      }
      setEvent({ id: eventSnapshot.id, ...eventSnapshot.data() });
    } catch (error) {
      console.error('イベント取得エラー:', error);
      setNotFound(true);
    }
  }, [eventId]);

  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

  const joinAsCoHost = async () => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'events', eventId), {
        coHostIds: arrayUnion(user.uid),
        [`coHostNames.${user.uid}`]: user.displayName || user.email
      });
      setJoined(true);
      toast.success('共同ホストとして参加しました');
    } catch (error) {
      console.error('共同ホスト参加エラー:', error);
      toast.error('共同ホストへの参加に失敗しました');
    }
    setLoading(false);
  };

  if (notFound) {
    return (
      <div className="client-participation">
        <div className="header">
          <button onClick={onBack} className="back-btn">← 戻る</button>
          <h2>共同ホストへの招待</h2>
        </div>
        <p>イベントが見つかりませんでした。招待リンクが正しいかご確認ください。</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="client-participation">
        <div className="header">
          <button onClick={onBack} className="back-btn">← 戻る</button>
          <h2>共同ホストへの招待</h2>
        </div>
        <p className="loading">読み込み中...</p>
      </div>
    );
  }

  const isHost = event.hostId === user?.uid;
  const isCoHost = !!user && (event.coHostIds || []).includes(user.uid);

  return (
    <div className="client-participation">
      <div className="header">
        <button onClick={onBack} className="back-btn">← 戻る</button>
        <h2>共同ホストへの招待</h2>
      </div>

      <div className="event-info">
        <h3>{event.title}</h3>
        <p>ホスト: {event.hostName}</p>
      </div>

      {!user ? (
        <>
          <p>共同ホストとして参加するには、Googleアカウントでログインしてください。</p>
          <AuthComponent onSuccess={() => {}} purpose="host" />
        </>
      ) : isHost ? (
        <>
          <p>あなたはこのイベントの作成者です。</p>
          <button className="submit-btn" onClick={onDone}>ホストダッシュボードへ</button>
        </>
      ) : isCoHost || joined ? (
        <>
          <p>すでに共同ホストとして参加しています。結果閲覧や日程編集ができます。</p>
          <button className="submit-btn" onClick={onDone}>ホストダッシュボードへ</button>
        </>
      ) : (
        <>
          <p>
            このイベントの共同ホストとして参加しますか？<br />
            共同ホストになると、結果閲覧・日程編集・回答削除ができるようになります
            （イベントの削除、共同ホストの管理は作成者のみ可能です）。
          </p>
          <button className="submit-btn" onClick={joinAsCoHost} disabled={loading}>
            {loading ? '処理中...' : '共同ホストとして参加する'}
          </button>
        </>
      )}
      <ToastContainer toasts={toasts} />
    </div>
  );
};

export default CoHostInvite;
