import React, { useState, useEffect } from 'react';
import { auth } from './services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import AuthComponent from './components/AuthComponent';
import HostDashboard from './components/HostDashboard';
import ClientParticipation from './components/ClientParticipation';
import EventResults from './components/EventResults';
import UsageGuide from './components/UsageGuide';
import UserProfile from './components/UserProfile';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('home');
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [isSharedLinkAccess, setIsSharedLinkAccess] = useState(false);

  // URLパスからルートを取得する関数
  const getCurrentRoute = () => {
    const path = window.location.pathname;
    const urlParams = new URLSearchParams(window.location.search);
    const eventIdFromUrl = urlParams.get('eventId');
    
    // URLパラメータにeventIdがある場合は共有リンクアクセスとして処理
    if (eventIdFromUrl && path === '/') {
      setSelectedEventId(eventIdFromUrl);
      setIsSharedLinkAccess(true);
      return 'client-join';
    }
    
    if (path === '/') return 'home';
    if (path === '/host') return 'host';
    if (path === '/host/new') return 'host-new';
    if (path === '/event/join') return 'client-join';
    if (path === '/event/history') return 'client-history';
    if (path === '/event/edit') return 'client-edit';
    if (path === '/results') return 'results';
    if (path === '/usage') return 'usage';
    if (path === '/auth') return 'auth';
    return 'home';
  };  // ルートを変更する関数
  const navigateTo = (route, eventId = null) => {
    let path = '/';
    switch (route) {
      case 'home':
        path = '/';
        break;
      case 'host':
        path = '/host';
        break;
      case 'host-new':
        path = '/host/new';
        break;
      case 'client-join':
        path = '/event/join';
        break;
      case 'client-history':
        path = '/event/history';
        break;
      case 'client-edit':
        path = '/event/edit';
        break;
      case 'results':
        path = '/results';
        break;
      case 'usage':
        path = '/usage';
        break;
      case 'auth':
        path = '/auth';
        break;
      default:
        path = '/';
    }
    
    window.history.pushState({}, '', path);
    setCurrentView(route);
    if (eventId) setSelectedEventId(eventId);
    
    // イベントIDが指定されている場合、参加画面では自動的に「新規参加」タブを表示させるためのヒント
    if (eventId && (route === 'client-join' || route === 'client-edit')) {
      // 必要に応じて追加の処理をここに記述可能
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      
      // ログイン後にセッションストレージをチェック
      if (user) {
        const savedState = sessionStorage.getItem('preLoginState');
        if (savedState) {
          try {
            const state = JSON.parse(savedState);
            if (state.returnTo === 'client-join') {
              // 回答画面に戻る
              setTimeout(() => {
                navigateTo('client-join');
              }, 100);
            }
          } catch (error) {
            console.error('保存された状態の解析に失敗:', error);
          }
        }
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 初期ルートとブラウザ戻る/進むボタンの処理
  useEffect(() => {
    const handlePopState = () => {
      const route = getCurrentRoute();
      setCurrentView(route);
    };

    // 初期ルートを設定（URLパラメータも考慮）
    const initialRoute = getCurrentRoute();
    setCurrentView(initialRoute);
    
    // URLパラメータからイベントIDを取得
    const urlParams = new URLSearchParams(window.location.search);
    const eventIdFromUrl = urlParams.get('eventId');
    if (eventIdFromUrl) {
      setSelectedEventId(eventIdFromUrl);
    }

    // ブラウザの戻る/進むボタンのイベントリスナーを追加
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // URLパラメータからイベントIDを取得して自動遷移
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('eventId');
    
    if (eventId) {
      setSelectedEventId(eventId);
      // /event/edit に eventId がある場合は、回答入力画面（client-edit）へ遷移
      navigateTo('client-edit', eventId);
      // URLからパラメータを削除してクリーンに保つ
      window.history.replaceState({}, document.title, '/event/edit');
    }
  }, []);

  if (loading) {
    return (
      <div className="loading">
        <p>読み込み中...</p>
      </div>
    );
  }

  const handleViewResults = (eventId) => {
    setSelectedEventId(eventId);
    navigateTo('results', eventId);
  };

  const renderContent = () => {
    switch (currentView) {
      case 'host':
        return user ? (
          <HostDashboard 
            user={user} 
            onBack={() => navigateTo('home')} 
            onViewResults={handleViewResults}
            onCreateNew={() => navigateTo('host-new')}
          />
        ) : (
          <AuthComponent 
            onSuccess={() => navigateTo('host')} 
            purpose="host"
          />
        );
      case 'host-new':
        return user ? (
          <HostDashboard 
            user={user} 
            onBack={() => navigateTo('host')} 
            onViewResults={handleViewResults}
            showCreateForm={true}
          />
        ) : (
          <AuthComponent 
            onSuccess={() => navigateTo('host-new')} 
            purpose="host"
          />
        );
      case 'client-join':
        return (
          <ClientParticipation 
            user={user} 
            onBack={() => {
              setIsSharedLinkAccess(false);
              navigateTo('home');
            }}
            mode="join"
            isSharedLinkAccess={isSharedLinkAccess}
            sharedEventId={selectedEventId}
          />
        );
      case 'client-history':
        return user ? (
          <ClientParticipation 
            user={user} 
            onBack={() => navigateTo('home')}
            mode="history"
          />
        ) : (
          <AuthComponent 
            onSuccess={() => navigateTo('client-history')} 
            purpose="client-history"
          />
        );
      case 'client-edit':
        return (
          <ClientParticipation 
            user={user} 
            onBack={() => navigateTo('client-join')}
            initialEventId={selectedEventId}
            mode="edit"
          />
        );
      case 'results':
        return (
          <EventResults 
            eventId={selectedEventId}
            onBack={() => navigateTo('host')}
          />
        );
      case 'usage':
        return (
          <UsageGuide 
            onNavigateToHost={() => navigateTo('host')}
            onNavigateToJoin={() => navigateTo('client-join')}
          />
        );
      case 'auth':
        return (
          <AuthComponent 
            onSuccess={() => navigateTo('home')} 
            purpose="general"
            onNavigate={(target) => navigateTo(target)}
          />
        );
      default:
        return (
          <div className="home">
            <h1>日程調整ツール</h1>
            
            {isSharedLinkAccess && selectedEventId && (
              <div className="shared-link-banner">
                <h2>イベントへの招待</h2>
                <p>イベントの共有リンクからアクセスされました</p>
                <div className="banner-actions">
                  <button 
                    className="nav-btn client-btn primary"
                    onClick={() => navigateTo('client-join')}
                  >
                    イベントに参加する
                    <small>（すぐに回答できます）</small>
                  </button>
                  <button 
                    className="nav-btn secondary"
                    onClick={() => {
                      setIsSharedLinkAccess(false);
                      setSelectedEventId(null);
                      // URLからeventIdパラメータを削除
                      window.history.replaceState({}, '', '/');
                    }}
                  >
                    ホーム画面に戻る
                  </button>
                </div>
              </div>
            )}
            
            <div className="nav-buttons">
              <button 
                className="nav-btn host-btn"
                onClick={() => navigateTo('host')}
              >
                ホストとして開始
                <small>（ログイン必要）</small>
              </button>
              <button 
                className="nav-btn client-btn"
                onClick={() => navigateTo('client-join')}
              >
                新規参加
                <small>（ログイン不要）</small>
              </button>
              <button 
                className="nav-btn client-btn"
                onClick={() => navigateTo('client-history')}
              >
                回答履歴を見る
                <small>（ログイン必要）</small>
              </button>
              <button 
                className="nav-btn usage-btn"
                onClick={() => navigateTo('usage')}
              >
                使い方を見る
                <small>（機能の説明）</small>
              </button>
              {!user && (
                <button 
                  className="nav-btn login-btn"
                  onClick={() => navigateTo('auth')}
                >
                  ログイン
                  <small>（Google または メール）</small>
                </button>
              )}
            </div>
            {user && (
              <div className="user-info">
                <p>ログイン中: {user.displayName || user.email}</p>
                <div className="user-actions">
                  <button 
                    onClick={() => setShowUserProfile(true)}
                    className="profile-btn"
                  >
                    プロフィール編集
                  </button>
                  <button onClick={() => auth.signOut()}>ログアウト</button>
                </div>
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <div className="App">
      {renderContent()}
      {showUserProfile && user && (
        <UserProfile
          user={user}
          onClose={() => setShowUserProfile(false)}
          onUpdate={() => {
            // ユーザー情報を再取得
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}

export default App;
