import React, { useState } from 'react';

const NAV_ITEMS = [
  { key: 'home', label: 'ホーム' },
  { key: 'host', label: '予定を作成する' },
  { key: 'client-join', label: '予定に参加する' },
  { key: 'client-history', label: '回答履歴' },
  { key: 'usage', label: '使い方' },
  { key: 'contact', label: 'お問い合わせ' },
];

const AppHeader = ({ user, currentView, onNavigate, onShowProfile, onLogout }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const go = (key) => {
    onNavigate(key);
    setMenuOpen(false);
  };

  return (
    <header className="app-head">
      <div className="app-head-inner">
        <div className="app-head-top">
          <div className="mark" onClick={() => go('home')}><span>時間</span>調整</div>
          <div className="sub">SCHEDULE COORDINATOR</div>
          <button
            type="button"
            className={`menu-toggle-btn${menuOpen ? ' open' : ''}`}
            aria-label={menuOpen ? 'メニューを閉じる' : 'メニューを開く'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(v => !v)}
          >
            <span className="menu-toggle-icon" />
          </button>
        </div>

        <nav className={`app-nav${menuOpen ? ' open' : ''}`}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.key}
              type="button"
              className={`app-nav-link${currentView === item.key ? ' active' : ''}`}
              onClick={() => go(item.key)}
            >
              {item.label}
            </button>
          ))}

          <div className="app-nav-auth">
            {user ? (
              <>
                <span className="app-nav-user">{user.displayName || user.email}</span>
                <button type="button" className="app-nav-link" onClick={() => { onShowProfile(); setMenuOpen(false); }}>
                  プロフィール編集
                </button>
                <button type="button" className="app-nav-link" onClick={() => { onLogout(); setMenuOpen(false); }}>
                  ログアウト
                </button>
              </>
            ) : (
              <button type="button" className="app-nav-link" onClick={() => go('auth')}>
                ログイン
              </button>
            )}
          </div>
        </nav>
      </div>
      {menuOpen && (
        <div className="app-nav-backdrop" onClick={() => setMenuOpen(false)} />
      )}
    </header>
  );
};

export default AppHeader;
