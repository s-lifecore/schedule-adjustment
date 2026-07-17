import React, { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../services/firebase';

const AuthComponent = ({ onSuccess, purpose, onNavigate }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const signInWithGoogle = async () => {
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      onSuccess();
    } catch (error) {
      setError('Googleログインに失敗しました: ' + error.message);
    }
    setLoading(false);
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    // 新規登録時のパスワード確認
    if (!isLogin && password !== confirmPassword) {
      setError('パスワードが一致しません');
      setLoading(false);
      return;
    }
    
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      onSuccess();
    } catch (error) {
      setError(
        isLogin 
          ? 'ログインに失敗しました: ' + error.message
          : 'アカウント作成に失敗しました: ' + error.message
      );
    }
    setLoading(false);
  };

  const getPurposeTitle = () => {
    switch (purpose) {
      case 'host':
        return 'ホストログイン';
      case 'client-history':
        return '回答履歴を見る';
      case 'general':
        return 'ログイン';
      default:
        return '参加者ログイン';
    }
  };

  const getPurposeMessage = () => {
    switch (purpose) {
      case 'host':
        return 'イベントを作成・管理するにはログインが必要です';
      case 'client-history':
        return '過去の回答履歴を確認するにはログインが必要です';
      case 'general':
        return 'アカウントにログインしてすべての機能をご利用ください';
      default:
        return 'ログインして機能をご利用ください';
    }
  };

  return (
    <div className="auth-container">
      <h2>{getPurposeTitle()}</h2>
      <p className="auth-message">{getPurposeMessage()}</p>

      <div className="card">
        <button
          onClick={signInWithGoogle}
          disabled={loading}
          className="google-signin-btn"
        >
          {loading ? '処理中...' : 'Googleでログイン'}
        </button>

        <div className="divider">
          <span>または</span>
        </div>

        <form onSubmit={handleEmailAuth}>
          <div className="form-group">
            <label htmlFor="email" className="sr-only">メールアドレス</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="メールアドレス"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password" className="sr-only">パスワード</label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="パスワード"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {!isLogin && (
            <div className="form-group">
              <label htmlFor="confirm-password" className="sr-only">パスワード確認</label>
              <input
                id="confirm-password"
                name="confirmPassword"
                type="password"
                placeholder="パスワード確認"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              {confirmPassword && password !== confirmPassword && (
                <div className="password-mismatch">パスワードが一致しません</div>
              )}
            </div>
          )}
          <button
            type="submit"
            disabled={loading || (!isLogin && password !== confirmPassword)}
          >
            {loading ? '処理中...' : (isLogin ? 'ログイン' : 'アカウント作成')}
          </button>
        </form>

        <p>
          {isLogin ? 'アカウントをお持ちでない方は' : 'すでにアカウントをお持ちの方は'}
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setPassword('');
              setConfirmPassword('');
              setError('');
            }}
            className="link-btn"
          >
            {isLogin ? 'アカウント作成' : 'ログイン'}
          </button>
        </p>

        {error && <p className="error">{error}</p>}
      </div>

      {purpose === 'general' && onNavigate && (
        <div className="auth-options">
          <h3>ログイン後の選択肢</h3>
          <div className="auth-nav-buttons">
            <button 
              type="button"
              onClick={() => onNavigate('host')}
              className="auth-nav-btn"
            >
              ホスト機能
              <small>イベント作成・管理</small>
            </button>
            <button 
              type="button"
              onClick={() => onNavigate('client-history')}
              className="auth-nav-btn"
            >
              回答履歴
              <small>過去の参加履歴を確認</small>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuthComponent;
