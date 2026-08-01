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

**家計簿の実データ（`entries`＝収支記録、`categoryMap`＝科目設定）はSupabaseなどのクラウドDBには一切保存されておらず、ログインしているブラウザの`localStorage`にのみ保存されている。**

- 保存キー（`src/storage.ts`）: `kakeibo-${uid}-entries`、`kakeibo-${uid}-category-map`（`uid`はSupabase AuthのユーザーID）。ユーザーごとにキーを分けているだけで、保存場所自体はローカルの`localStorage`。
- 保存タイミング: `App.tsx`内の`useEffect`で、`entries`または`categoryMap`が変化するたびに即座に`localStorage`へ書き込み（同期的、クラウドへのアップロードは一切行わない）。
- テーマ設定（`kakeibo-theme`）はユーザーIDに紐付かない共通キーで保存。

### 複数端末で使うとどうなるか（重要な制約）

- **同期されない。** 同じアカウントでログインしても、PCのブラウザとスマホのブラウザ、あるいは同じ端末でもブラウザを変える（Safari→Chrome）と、家計簿データは完全に別々になる。
- ブラウザのキャッシュ削除、シークレットモード、別端末での初回ログインなどでは「データが0件の状態」になる。復元手段はない（バックアップの仕組みが存在しない）。
- 実質的に「1ブラウザ＝1つの家計簿データ」という設計。複数端末で同じ家計簿を見たい場合は、都度Dataページの「CSVエクスポート/インポート」で手動で持ち運ぶしかない。
- ログアウトすると画面上の`entries`/`categoryMap`はクリアされる（`App.tsx`の`handleLogout`）が、`localStorage`自体は消えない。同じ端末・同じブラウザで再ログインすれば、`uid`が同じである限り同じキーからまた読み込まれる。

## 認証の仕組み

- Supabase Auth（メールアドレス＋パスワード）のみ。新規登録フォームはこのアプリには無く（`src/pages/Login.tsx`にはログインとパスワードリセットのみ）、アカウント作成は別途Supabase側かGuinness家ポータル経由と思われる（要確認）。
- ログイン・パスワードリセットのUIロジックは`src/pages/Login.tsx`。認証状態の監視（ログイン/ログアウトの検知、ユーザーIDの取得）は`src/App.tsx`の`supabase.auth.getSession()` / `onAuthStateChange`。
- **Supabaseはこのアプリでは認証（ユーザーの識別）専用に使われているだけで、家計簿データ本体のやり取りには一切使われていない。**
- 使用プロジェクト: プロジェクトB（`zkqvqztadbzqwdwqhyjw`）。ギネス家ポータル・HealthDashboardと共有のSupabaseプロジェクト（同じ認証基盤を複数アプリで使い回している）。ユーザーIDでデータキーを分けているため、他アプリのユーザーデータと混ざることはない設計。

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

1. **`src/supabase.ts`にSupabaseの接続キー（URLとanonキー）がフォールバック値としてハードコードされたまま残っている。**
   ```
   const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://...' // ハードコード
   const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || 'eyJ...' // ハードコード
   ```
   GitHub Actions側（`deploy.yml`）は既にSecretsから正しく環境変数を注入する仕組みになっているため、このハードコードされたフォールバック値は本来不要。しかも公開リポジトリ（`hei86gns/Kakeibo-app`）に既にコミット済みで、GitHub上で誰でも閲覧可能な状態。過去に「削除すべき」という指摘があったが、**まだ対応されていない**。
   - 実害の範囲: anonキーはSupabaseの設計上「公開されても安全」とされる類のキー（Row Level Securityで保護する前提）だが、URLとセットで公開されていることでプロジェクトの存在自体が第三者に分かる。実際の値そのものはこのメモには書かない。
   - 対応するなら: フォールバック値を削除し、環境変数が無い場合はエラーを出す（またはビルドを失敗させる）形にするのがモダンな対応。
2. **複数端末同期がない**（上記「データの保存範囲」参照）。tangochoやWorkout_Appのような「クラウド同期＋件数比較でのマージ」といった仕組みはこのアプリには存在しない。もし将来「スマホでも同じ家計簿を見たい」となった場合は、entriesをSupabaseの`user_data`テーブルなどに保存する設計変更が必要（tangochoの同期実装が参考になる）。
3. **バックアップ手段が手動のCSVエクスポートのみ**。自動バックアップやクラウド保存が無いため、ブラウザのデータ削除・端末の初期化・アプリのアンインストールなどでデータが消える可能性がある。
4. 新規アカウント作成のUIがこのアプリ内に見当たらない（ログイン画面はログイン＋パスワードリセットのみ）。アカウントの作り方は要確認。

## 保存場所・関連ファイル一覧

- フォルダ: `~/Desktop/Kakeibo_App/`
- エントリーポイント: `src/main.tsx` → `src/App.tsx`（ページ切り替え・認証状態・全体のstate管理を担う中心ファイル）
- 画面コンポーネント: `src/pages/Login.tsx`、`Home.tsx`、`Calendar.tsx`、`History.tsx`、`Stats.tsx`、`Data.tsx`
- データ保存: `src/storage.ts`（localStorage読み書き）
- Supabase接続: `src/supabase.ts`（認証専用）
- 型定義: `src/types.ts`
- 初期科目データ・定数: `src/constants.ts`
- ユーティリティ関数（Excel日付パース、金額抽出など）: `src/utils.ts`
- 自動デプロイ設定: `.github/workflows/deploy.yml`
- 環境変数サンプル: `.env.example`（実際の`.env`はgit管理外、`.gitignore`で除外済み）
- GitHubリポジトリ: `hei86gns/Kakeibo-app`（公開）

## 機能について質問したいとき

このメモと`src/`以下の各ファイルがあれば、別のフォルダ・別のチャットからでも「OCRの精度はどう担保してる？」「複数端末対応にするには何を変えればいい？」といった質問にその場で答えられる。会話ログそのものは引き継げないが、このメモが実質的に同じ役割を果たす。
