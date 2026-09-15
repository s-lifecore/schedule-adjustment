import React, { useState, useEffect } from 'react';
import { auth } from './services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import AuthComponent from './components/AuthComponent';
import AppHeader from './components/AppHeader';
import HostDashboard from './components/HostDashboard';
import ClientParticipation from './components/ClientParticipation';
import EventResults from './components/EventResults';
import UsageGuide from './components/UsageGuide';
import UserProfile from './components/UserProfile';
import ContactForm from './components/ContactForm';
import CoHostInvite from './components/CoHostInvite';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
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
      if (urlParams.get('cohost') === '1') {
        return 'cohost-join';
      }
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
    if (path === '/contact') return 'contact';
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
      case 'contact':
        path = '/contact';
        break;
      case 'auth':
        path = '/auth';
        break;
      default:
        path = '/';
    }
    
    window.history.pushState({}, '', path);
    setCurrentView(route);
    // eventIdを渡さなかった場合は、前の画面で選択されていたイベントIDを持ち越さないようクリアする
    setSelectedEventId(eventId);
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
      setAuthChecked(true);
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

  // /event/edit?eventId=xxx の場合のみ client-edit へ遷移（/?eventId=xxx の共有リンクは除外）
  useEffect(() => {
    const path = window.location.pathname;
    if (path !== '/event/edit') return;

    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('eventId');

    if (eventId) {
      setSelectedEventId(eventId);
      navigateTo('client-edit', eventId);
      window.history.replaceState({}, document.title, '/event/edit');
    }
  }, []);

  const handleViewResults = (eventId) => {
    setSelectedEventId(eventId);
    navigateTo('results', eventId);
  };

  const renderContent = () => {
    switch (currentView) {
      case 'host':
        if (!authChecked) return <div className="loading"><p>読み込み中...</p></div>;
        return user ? (
          <HostDashboard
            user={user}
            onBack={() => navigateTo('home')}
            onViewResults={handleViewResults}
            onCreateNew={() => navigateTo('host-new')}
            onNavigateToJoin={(eventId) => navigateTo('client-join', eventId)}
          />
        ) : (
          <AuthComponent
            onSuccess={() => navigateTo('host')}
            purpose="host"
          />
        );
      case 'host-new':
        if (!authChecked) return <div className="loading"><p>読み込み中...</p></div>;
        return user ? (
          <HostDashboard
            user={user}
            onBack={() => navigateTo('host')}
            onViewResults={handleViewResults}
            showCreateForm={true}
            onNavigateToJoin={(eventId) => navigateTo('client-join', eventId)}
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
            initialEventId={!isSharedLinkAccess ? selectedEventId : null}
            onGoToHostView={(eventId) => navigateTo('results', eventId)}
          />
        );
      case 'cohost-join':
        return (
          <CoHostInvite
            user={user}
            eventId={selectedEventId}
            onBack={() => navigateTo('home')}
            onDone={() => navigateTo('host')}
          />
        );
      case 'client-history':
        if (!authChecked) return <div className="loading"><p>読み込み中...</p></div>;
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
      case 'contact':
        return (
          <ContactForm
            user={user}
            onBack={() => navigateTo('home')}
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
            <h1>都合のいい時間を、ひと目で。</h1>
            <p>予定を作って共有するか、参加者として回答してください。</p>

            {isSharedLinkAccess && selectedEventId && (
              <div className="shared-link-banner">
                <h2>予定への招待</h2>
                <p>共有リンクからアクセスしました。そのまま回答に進めます。</p>
                <div className="banner-actions">
                  <button
                    className="nav-btn client-btn primary"
                    onClick={() => navigateTo('client-join')}
                  >
                    予定に参加する
                    <small>すぐに回答できます</small>
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
                予定を作成する
                <small>日程の候補を決めて、参加者を募集します（ログイン必要）</small>
              </button>
              <button
                className="nav-btn client-btn"
                onClick={() => navigateTo('client-join')}
              >
                予定に参加する
                <small>共有された予定に回答します（ログイン不要）</small>
              </button>
              <button
                className="nav-btn client-btn"
                onClick={() => navigateTo('client-history')}
              >
                回答履歴を見る
                <small>過去に回答した予定を確認します（ログイン必要）</small>
              </button>
              <button
                className="nav-btn usage-btn"
                onClick={() => navigateTo('usage')}
              >
                使い方を見る
                <small>アプリの機能を説明します</small>
              </button>
              <button
                className="nav-btn contact-btn"
                onClick={() => navigateTo('contact')}
              >
                お問い合わせ
                <small>機能の要望・バグ報告・ご意見など</small>
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
          </div>
        );
    }
  };

  return (
    <>
      <AppHeader
        user={user}
        currentView={currentView}
        onNavigate={navigateTo}
        onShowProfile={() => setShowUserProfile(true)}
        onLogout={() => auth.signOut()}
      />
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
    </>
  );
}

export default App;
