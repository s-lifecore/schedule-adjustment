import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import '../App.css';

const CATEGORIES = [
  { value: 'feature', label: '機能改善・要望' },
  { value: 'bug', label: 'バグ報告' },
  { value: 'other', label: 'その他' },
];

const ContactForm = ({ onBack, user }) => {
  const [form, setForm] = useState({
    name: user?.displayName || '',
    email: user?.email || '',
    category: 'feature',
    subject: '',
    message: '',
  });
  const [status, setStatus] = useState('idle'); // idle | submitting | success | error
  const [errorMsg, setErrorMsg] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const sendDiscordNotification = async (data) => {
    const webhookUrl = process.env.REACT_APP_DISCORD_WEBHOOK_URL;
    if (!webhookUrl) return;

    const categoryLabel = CATEGORIES.find((c) => c.value === data.category)?.label || data.category;

    const payload = {
      username: '時間調整 お問い合わせ',
      embeds: [
        {
          title: `📬 新しいお問い合わせ：${data.subject}`,
          color: 0x2b3a67,
          fields: [
            { name: 'カテゴリ', value: categoryLabel, inline: true },
            { name: 'お名前', value: data.name || '（未入力）', inline: true },
            { name: 'メール', value: data.email || '（未入力）', inline: false },
            { name: 'メッセージ', value: data.message },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
    };

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.message.trim()) return;

    setStatus('submitting');
    setErrorMsg('');

    try {
      await addDoc(collection(db, 'contacts'), {
        name: form.name.trim(),
        email: form.email.trim(),
        category: form.category,
        subject: form.subject.trim(),
        message: form.message.trim(),
        uid: user?.uid || null,
        createdAt: serverTimestamp(),
      });

      await sendDiscordNotification(form);

      setStatus('success');
    } catch (err) {
      console.error('送信エラー:', err);
      setErrorMsg('送信に失敗しました。時間をおいて再度お試しください。');
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className="container">
        <div className="header">
          <button className="back-button" onClick={onBack}>← 戻る</button>
          <h1>お問い合わせ</h1>
        </div>
        <div className="contact-success">
          <div className="contact-success-icon">✓</div>
          <h2>送信しました</h2>
          <p>お問い合わせを受け付けました。ありがとうございます。</p>
          <button className="submit-btn" style={{ marginTop: '20px' }} onClick={onBack}>
            ホームに戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <button className="back-button" onClick={onBack}>← 戻る</button>
        <h1>お問い合わせ</h1>
        <p>機能の要望・バグ報告・ご意見などをお送りください。</p>
      </div>

      <form className="create-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="cf-category">カテゴリ</label>
          <select id="cf-category" name="category" value={form.category} onChange={handleChange}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="cf-name">お名前</label>
          <input
            id="cf-name"
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="山田 太郎"
            maxLength={50}
          />
        </div>

        <div className="form-group">
          <label htmlFor="cf-email">メールアドレス <span className="contact-required">*</span></label>
          <input
            id="cf-email"
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="example@email.com"
            required
          />
          <span className="help-text">返信が必要な場合にご入力ください</span>
        </div>

        <div className="form-group">
          <label htmlFor="cf-subject">件名 <span className="contact-required">*</span></label>
          <input
            id="cf-subject"
            type="text"
            name="subject"
            value={form.subject}
            onChange={handleChange}
            placeholder="例：カレンダー表示を改善してほしい"
            maxLength={100}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="cf-message">メッセージ <span className="contact-required">*</span></label>
          <textarea
            id="cf-message"
            name="message"
            value={form.message}
            onChange={handleChange}
            placeholder="詳細をご記入ください..."
            rows={6}
            maxLength={2000}
            required
          />
          <span className="help-text">{form.message.length} / 2000 文字</span>
        </div>

        {status === 'error' && (
          <div className="error" style={{ marginBottom: '14px' }}>{errorMsg}</div>
        )}

        <button
          type="submit"
          className="submit-btn"
          disabled={status === 'submitting' || !form.subject.trim() || !form.message.trim() || !form.email.trim()}
        >
          {status === 'submitting' ? '送信中…' : '送信する'}
        </button>
      </form>
    </div>
  );
};

export default ContactForm;
