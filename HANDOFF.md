# Kakeibo（家計簿アプリ）引き継ぎメモ

## 背景・目的

個人用の家計簿アプリ。React + TypeScript（Vite）構成で、GitHub Actionsで自動的にGitHub Pagesへデプロイされる本格的なSPA（単一HTMLファイルの他アプリとは違い、複数ファイルに分かれたビルド前提の構成）。

## 画面構成（5タブ、下部ナビゲーション）

- **ホーム(Home)**: 記録の入力フォーム＋今月の記録一覧。日付・種別（支出/収入）・科目・分類（小分類）・金額・資産（現金/銀行/クレジットカード等）・内容・メモを入力して保存。今月の収入・支出・収支をサマリー表示。一覧の行をタップすると編集モードになり、フォームに内容が入って上書き保存または削除ができる。
  - **レシートOCR機能**: カメラ/画像を選ぶと`tesseract.js`（英語モード固定）で画像内の文字を読み取り、`parseAmountFromText()`（`src/utils.ts`）で数値らしき文字列から最大値を金額候補として自動入力し、1行目のテキストを内容欄に仮入力する。読み取り精度は保証されないため人間による確認前提。
  - カレンダー画面から日付を選んで遷移してきた場合は、その日付が自動的にフォームにセットされる（`presetDate`の仕組み、`App.tsx`）。
- **カレンダー(Calendar)**: 月表示のカレンダー。各日に収入(緑)/支出(赤)の合計金額を表示。日付をタップするとホーム画面に遷移し、その日付で新規入力ができる。
- **履歴(History)**: 年・月を選んで、その月の全記録を表形式で一覧表示。行タップで編集（ホーム画面へ）、✕ボタンで削除。
- **統計(Stats)**: 月次/年次を切り替え可能。
  - 月次: その月の収入・支出・収支サマリー＋科目別の内訳ドーナツグラフ（自前SVG実装、ライブラリ不使用）。
  - 年次: 上記に加えて月別の収入/支出推移を棒グラフで表示。
- **データ(Data)**: 
  - 科目・小分類のカスタム管理（追加・削除）。初期値は`src/constants.ts`の`DEFAULT_CATEGORY_MAP`（食費、日用品、交通費、光熱費、家賃、通信費、趣味、健康、教育、交際費、保険、雑費、給与、副収入、貯蓄の15科目、各に小分類あり）。
  - **データインポート**: 「らくな家計簿」というExcelファイル（.xlsx/.xls/.csv）、またはこのアプリ自身がエクスポートしたCSVを取り込める（ヘッダー名のエイリアス対応あり、`src/pages/Data.tsx`の`aliases`参照）。
  - **データエクスポート**: 全記録をCSV形式でダウンロード。
  - **全データ削除**: 確認ダイアログ付きで全記録を削除。
  - 画面下部にビルド時のgitハッシュ（`__APP_VERSION__`、`vite.config.ts`で注入）をアプリバージョンとして表示。

## データ構造（`src/types.ts`）

```
KakeiboEntry = {
  id, date, asset, category, subcategory,
  description, amount, type, memo, currency, source
}
```
- `type`は`'支出'`または`'収入'`の文字列（enumではなく素の文字列）。
- `source`は`'manual'`（手入力）または`'import'`（インポート由来）。
- `CategoryMap = Record<string, string[]>`（科目名→小分類名の配列）。

## データの保存範囲・保存方式（最重要・必ず確認すること）

**家計簿の実データ（`entries`＝収支記録、`categoryMap`＝科目設定）はSupabaseのPostgreSQLデータベースに保存されている。** localStorageには一切保存しない（`src/App.tsx`に`saveEntries`/`saveCategoryMap`の呼び出しは無い）。

- テーブル定義: `supabase/schema.sql`（`public.kakeibo_entries`＝収支記録、`public.kakeibo_settings`＝ユーザーごとの科目設定）。初回セットアップ時にSupabaseのSQL Editorで一度だけ実行する。
- アクセス制御: Row Level Security（RLS）を有効化し、`auth.uid() = user_id`のポリシーで「自分の行しか見えない・書き込めない」を保証。同じSupabaseプロジェクトを使う他アプリ（tangocho等）とはテーブル自体が別なので混ざらない。
- 読み書きの実装: `src/db.ts`（`fetchEntries`/`insertEntry`/`updateEntry`/`deleteEntry`/`deleteAllEntries`/`fetchCategoryMap`/`saveCategoryMap`）。`App.tsx`はこれらを呼び、画面は即座に更新した上でクラウド書き込みを行う「楽観的更新」方式。書き込みが失敗した場合は画面上の変更を元に戻し、エラーメッセージを表示する。
- テーマ設定（`kakeibo-theme`）のみ、端末ごとの見た目の好みなのでこれまで通り`localStorage`に保存（クラウド同期しない）。
- `src/storage.ts`の`loadEntries`/`loadCategoryMap`（localStorage読み込み）は、後述の「ローカルデータのクラウド移行」機能のためだけに残してある。新規の保存には使われていない。

### 複数端末で使うとどうなるか

- **同期される。** 同じアカウントでログインすれば、PC・スマホ・タブレット、どのブラウザからでも同じデータが見える。旧方式（localStorage）で発生していた「ブラウザを変えるとデータが消えたように見える」問題は解消。
- 新規記録のID生成は`crypto.randomUUID()`に変更済み（旧`Date.now()`ベースの文字列IDだと複数端末からの同時書き込みで衝突しうるため）。
- **移行が必要な既存データ**: 旧localStorage方式で入力していたデータは自動では移らない。Dataページの「このブラウザのローカルデータを移行」ボタン（`handleMigrateLocal`、`App.tsx`）で、そのブラウザに残っているlocalStorageのデータを読み込み、クラウドにまだ無いIDのものだけをアップロードする（重複防止）。家族など複数人で使っている場合、各自が自分の使っている入口（Safari／Brave／ホーム画面アプリ等）でこのボタンを一度ずつ押す必要がある。
- 通信エラー時（オフライン等）は保存・編集・削除が失敗し、画面上も元の状態に戻ってエラーメッセージが出る。**完全オフライン対応はしていない**（ネット接続必須）。

## 認証の仕組み

- Supabase Auth（メールアドレス＋パスワード）。**新規登録フォームは意図的にこのアプリには無い**（`src/pages/Login.tsx`にはログインとパスワードリセットのみ）。家計簿という金銭データの性質上、招待制を維持する方針で、アカウント発行はSupabaseダッシュボードの Authentication → Users → Invite user から管理者が行う。
- ログイン・パスワードリセットのUIロジックは`src/pages/Login.tsx`。認証状態の監視（ログイン/ログアウトの検知、ユーザーIDの取得）は`src/App.tsx`の`supabase.auth.getSession()` / `onAuthStateChange`。
- **Supabaseは認証とデータ保存（PostgreSQL）の両方に使われている。** ユーザーの識別（`auth.uid()`）がそのままRLSポリシーの主キーになっており、認証とデータアクセス制御が一体になっている。
- 使用プロジェクト: プロジェクトB（`zkqvqztadbzqwdwqhyjw`）。ギネス家ポータル・HealthDashboard・tangochoと共有のSupabaseプロジェクト（同じ認証基盤を複数アプリで使い回している）。テーブル名を`kakeibo_`接頭辞で分けているため、他アプリのテーブルと混ざることはない。

## 技術構成

- **フレームワーク**: React 19 + TypeScript + Vite 8
- **主要ライブラリ**:
  - `@supabase/supabase-js`: 認証のみに使用
  - `tesseract.js`: レシートOCR
  - `xlsx`: Excel/CSVのインポート・パース
- **Lint**: oxlint
- **ビルド**: `npm run build`（`tsc -b && vite build`）。`vite.config.ts`で`base: '/Kakeibo-app/'`を指定（GitHub Pagesのサブパス配信に対応）。ビルド時にgitのショートハッシュを`__APP_VERSION__`として埋め込む。

## 自動デプロイの仕組み（`.github/workflows/deploy.yml`）

- `main`ブランチへのpush、または手動実行（`workflow_dispatch`）でトリガー。
- `npm ci` → `npm run build` → GitHub Pagesへ`actions/deploy-pages`でデプロイ。
- ビルド時の環境変数`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`は、GitHub ActionsのSecretsから注入される（`secrets.VITE_SUPABASE_URL`など）。
- リポジトリ: `hei86gns/Kakeibo-app`（GitHub上で公開リポジトリ）。

## 既知の注意点（やっていないこと・要検討事項）

1. **オフライン非対応。** ネット接続が無い状態では保存・編集・削除ができない（通信エラーで画面が元に戻り、エラーメッセージが出る）。オフラインキャッシュや後からの再送信は実装していない。
2. **Supabase無料プランは7日間アクセスが無いと自動で一時停止する。** 再開はSupabaseダッシュボードのボタン一つ・数分で完了するが、久しぶりにアプリを開くと「データの読み込みに失敗しました」のようなエラーになりうる。その場合はSupabaseダッシュボードでプロジェクトが一時停止していないか確認する。
3. **バックアップ手段が手動のCSVエクスポートのみ。** クラウドDBなので単純な「端末紛失で消える」リスクは無くなったが、誤って「すべてのデータを削除」した場合の復元手段は無い（確認ダイアログはある）。定期的なCSVエクスポートを推奨。
4. **新規アカウント作成のUIは意図的に無い。** 招待制の設計（上記「認証の仕組み」参照）。
5. **`supabase/schema.sql`は初回セットアップ時に手動でSupabaseのSQL Editorに貼り付けて実行する必要がある。** マイグレーションツール（Supabase CLI等）は導入していないため、テーブル定義を変更した場合は`schema.sql`を更新した上で、既存プロジェクトのSQL Editorでも該当するALTER文などを手動実行する必要がある。

## 保存場所・関連ファイル一覧

- フォルダ: `~/Desktop/Kakeibo_App/`
- エントリーポイント: `src/main.tsx` → `src/App.tsx`（ページ切り替え・認証状態・全体のstate管理を担う中心ファイル）
- 画面コンポーネント: `src/pages/Login.tsx`、`Home.tsx`、`Calendar.tsx`、`History.tsx`、`Stats.tsx`、`Data.tsx`
- データ保存（クラウドDB）: `src/db.ts`（Supabaseへの読み書き関数一式）
- データ保存（旧・移行専用）: `src/storage.ts`（localStorage読み書き。今は「ローカルデータのクラウド移行」機能でのみ使用）
- Supabase接続: `src/supabase.ts`（クライアント初期化。環境変数が無いとエラーを投げる）
- DBスキーマ: `supabase/schema.sql`（初回セットアップ時にSQL Editorで実行）
- 型定義: `src/types.ts`
- 初期科目データ・定数: `src/constants.ts`
- ユーティリティ関数（Excel日付パース、金額抽出など）: `src/utils.ts`
- 自動デプロイ設定: `.github/workflows/deploy.yml`
- 環境変数サンプル: `.env.example`（実際の`.env`はgit管理外、`.gitignore`で除外済み）
- GitHubリポジトリ: `hei86gns/Kakeibo-app`（公開）

## 機能について質問したいとき

このメモと`src/`以下の各ファイルがあれば、別のフォルダ・別のチャットからでも「OCRの精度はどう担保してる？」「複数端末対応にするには何を変えればいい？」といった質問にその場で答えられる。会話ログそのものは引き継げないが、このメモが実質的に同じ役割を果たす。
