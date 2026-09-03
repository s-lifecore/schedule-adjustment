import React from 'react';
import '../App.css';

const UsageGuide = ({ onNavigateToHost, onNavigateToJoin }) => {
  return (
    <div className="container">
      <div className="header">
        <button
          className="back-button"
          onClick={() => window.history.back()}
        >
          ← 戻る
        </button>
        <h1>使い方</h1>
        <p>予定の作成から回答、結果の見方までをご案内します。</p>
      </div>

      <div className="usage-content">
        <section className="usage-section">
          <h2>アプリの特徴</h2>
          <div className="feature-list">
            <div className="feature-item">
              <h3>ログインで履歴が保存されます</h3>
              <p>
                Googleアカウントでログインすることで、過去の回答履歴が自動的に保存されます。
                次回同じ参加者として回答する際は、前回の内容が自動で入力されるため、
                手間を省くことができます。
              </p>
            </div>

            <div className="feature-item">
              <h3>ログインを強く推奨します</h3>
              <p>
                ログインしていない場合、ブラウザを閉じると回答履歴が失われてしまいます。
                継続的にアプリを利用される場合は、必ずGoogleアカウントでログインしてください。
              </p>
            </div>

            <div className="feature-item">
              <h3>共有リンクを貼るだけで簡単参加</h3>
              <p>
                予定の作成者から送られてくる共有リンクをクリックするだけで、
                すぐに日程調整に参加できます。面倒な登録や設定は一切不要です。
              </p>
            </div>
          </div>
        </section>

        <section className="usage-section">
          <h2>基本的な使い方</h2>

          <div className="usage-steps">
            <div className="step">
              <h3>1. 予定を作成する場合</h3>
              <ul>
                <li>「予定を作成する」をクリック</li>
                <li>タイトル、候補日、説明を入力</li>
                <li>作成後に表示される共有リンクを参加者に送信</li>
                <li>回答状況をリアルタイムで確認</li>
              </ul>
              <button
                className="guide-button primary-button"
                onClick={onNavigateToHost}
              >
                予定を作成する
              </button>
            </div>

            <div className="step">
              <h3>2. 参加する場合</h3>
              <ul>
                <li>送られてきた共有リンクをクリック</li>
                <li>参加者名を入力（ログイン済みの場合は自動入力）</li>
                <li>各候補日について参加可能な時間帯を追加（複数可）</li>
                <li>必要に応じて備考を追加</li>
                <li>内容を確認して送信</li>
              </ul>
              <button
                className="guide-button secondary-button"
                onClick={onNavigateToJoin}
              >
                予定に参加する
              </button>
            </div>
          </div>
        </section>

        <section className="usage-section">
          <h2>便利な機能</h2>
          <div className="tips-list">
            <div className="tip-item">
              <h4>結果の自動集計</h4>
              <p>参加者の回答は自動的に集計され、全員が参加できる時間帯がひと目でわかります。</p>
            </div>

            <div className="tip-item">
              <h4>回答の修正が可能</h4>
              <p>一度回答した後でも、同じリンクから何度でも修正できます。</p>
            </div>

            <div className="tip-item">
              <h4>モバイル対応</h4>
              <p>スマートフォンやタブレットからでも快適に利用できます。</p>
            </div>

            <div className="tip-item">
              <h4>リアルタイム更新</h4>
              <p>他の参加者の回答が結果画面にすぐ反映されます。</p>
            </div>
          </div>
        </section>

        <section className="usage-section login-recommendation">
          <h2>より便利に使うために</h2>
          <div className="recommendation-box">
            <h3>Googleアカウントでのログインをお勧めします</h3>
            <ul>
              <li>回答履歴が自動保存される</li>
              <li>次回から参加者名が自動入力される</li>
              <li>過去の回答が自動で復元される</li>
              <li>複数のデバイスで同じ履歴を共有できる</li>
            </ul>
          </div>
        </section>

        <section className="usage-section">
          <h2>更新情報</h2>
          <div className="changelog-list">
            <div className="changelog-entry">
              <h4 className="changelog-date">2026-09-04</h4>
              <ul>
                <li>共同ホスト機能を追加しました。招待リンクを共有すると、他の人と一緒にイベントを管理できます（日程編集・結果閲覧・回答削除が可能。イベントの削除や共同ホストの管理は作成者のみ行えます）</li>
                <li>どのページからでも移動できるメニューをヘッダーに追加しました（スマートフォンではメニューボタンから開閉できます）</li>
                <li>ヘッダーのユーザー名表示を「プロフィール編集（ユーザー名）」にまとめ、見やすくしました</li>
                <li>ホストダッシュボードのイベント一覧をカード形式（3列）に変更し、見やすく整理しました</li>
                <li>イベントの「詳細を見る」をポップアップ表示に変更しました</li>
                <li>ページの表示速度を全体的に改善しました</li>
                <li>回答期限が近づくと、入力中の画面にも自動で反映されるようにしました（期限切れ後の送信ミスを防止）</li>
                <li>自分が作成したイベントの回答画面から、ワンクリックでホスト画面に移動できるボタンを追加しました</li>
                <li>「本サイトについて」の説明を、イベント内容に関わらず常に表示するようにしました</li>
                <li>イベント説明・イベント情報の表示を、線で囲んだシンプルなカードデザインに統一しました</li>
                <li>「任意の時間を追加」ボタンで、自由に時間を指定できることが分かりやすくなりました</li>
              </ul>
            </div>

            <div className="changelog-entry">
              <h4 className="changelog-date">2026-08-13</h4>
              <ul>
                <li>時間帯のクイック入力ボタン（午前・午後・夜間など）を拡充しました</li>
                <li>一度送信した回答を、後から編集できるようにしました</li>
              </ul>
            </div>

            <div className="changelog-entry">
              <h4 className="changelog-date">2026-08-10</h4>
              <ul>
                <li>回答履歴・確認画面での候補日が、日付順に並んで表示されるよう修正しました</li>
              </ul>
            </div>

            <div className="changelog-entry">
              <h4 className="changelog-date">2026-08-06</h4>
              <ul>
                <li>サイト管理者へのお問い合わせフォームを追加しました</li>
              </ul>
            </div>

            <div className="changelog-entry">
              <h4 className="changelog-date">2026-08-05</h4>
              <ul>
                <li>同じ名前の回答者が複数いる場合に、一部参加可の表示名が正しく出ないバグを修正しました</li>
                <li>スマートフォン・タブレットでも快適に使えるレスポンシブデザインに対応しました</li>
                <li>通知・確認画面など、入力から送信までの流れを全面的に改善しました</li>
              </ul>
            </div>

            <div className="changelog-entry">
              <h4 className="changelog-date">2026-07-17</h4>
              <ul>
                <li>和紙・和文セリフ基調の落ち着いたデザインに全面刷新しました</li>
              </ul>
            </div>

            <div className="changelog-entry">
              <h4 className="changelog-date">2026-07-14</h4>
              <ul>
                <li>回答を送信する前に、内容を確認できる確認画面を追加しました</li>
                <li>共有リンクでのアクセスや、複数行の説明文の表示を改善しました</li>
              </ul>
            </div>

            <div className="changelog-entry">
              <h4 className="changelog-date">2025年8月以前</h4>
              <ul>
                <li>参加者名の自動入力、ホストによる日程追加、アンケート機能など基本機能を整備しました</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default UsageGuide;
