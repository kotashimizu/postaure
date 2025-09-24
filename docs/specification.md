# Postaure v1.0.0 仕様書
作成日: 2025-03-08
版数: 1.0
対象: `docs/requirements.md` で定義されたリリース範囲

---

## 1. システム概要
- アプリ種別: Web/PWA (Single Page Application)
- 技術スタック: React 19, TypeScript 5.8, Vite 7
- 主要外部ライブラリ: `@mediapipe/tasks-vision`, `jspdf`, `html-to-image`, `file-saver`
- 実行環境: Chrome / Edge / Safari / Firefox 最新版
- 外部依存: jsDelivr CDN (MediaPipe WASM), Google Cloud Storage (モデル), 任意 AI API

## 2. アーキテクチャ
### 2.1 レイヤ構成
- **UI 層**: `src/components` の React コンポーネント。
- **ロジック層**: `src/services` のサービスクラス、`src/hooks` のカスタムフック。
- **ユーティリティ層**: `src/utils` の互換性チェック・性能計測・テストツール。
- **静的資産**: `public/` (アイコン、manifest、Service Worker)。

### 2.2 データフロー
1. `App.tsx` がアプリ状態を管理し、互換性→撮影→解析→レポートの画面を切り替える。
2. `CaptureScreen` で取得した `ImageData` を `AnalysisScreen` に渡す。
3. `MediaPipeService` でランドマーク検出後、`EnhancedPostureAnalysisService`/`AdvancedKendallAnalysisService` が姿勢指標を計算。
4. `ReportScreen` が解析結果を受け取り可視化・エクスポート・共有・AI 連携を提供。
5. `useDeviceAdaptation` と `compatibilityChecker` が UI 設定と機能制御を行う。
6. Service Worker がキャッシュ/オフライン制御を担当。

## 3. フォルダ構成 (抜粋)
```
src/
├── App.tsx
├── components/
│   ├── CaptureScreen.tsx
│   ├── AnalysisScreen.tsx
│   ├── ReportScreen.tsx
│   ├── CompatibilityCheck.tsx
│   ├── LandmarkVisualizer.tsx
│   ├── PerformancePanel.tsx
│   ├── TestRunner.tsx
│   └── SettingsPanel.tsx
├── hooks/
│   ├── useCamera.ts
│   ├── useDeviceAdaptation.ts
│   ├── useErrorHandler.ts
│   └── useAnnouncer.ts
├── services/
│   ├── MediaPipeService.ts
│   ├── EnhancedPostureAnalysisService.ts
│   ├── AdvancedKendallAnalysisService.ts
│   ├── ReportGenerationService.ts
│   ├── SharingService.ts
│   ├── OfflineService.ts
│   ├── AIReportService.ts
│   └── APIConfigService.ts
├── utils/
│   ├── compatibilityChecker.ts
│   ├── deviceDetection.ts
│   ├── performanceMonitor.ts
│   └── testRunner.ts
└── types/
    └── index.ts
```

## 4. 画面遷移
| 状態 | 画面 | 遷移条件 |
|------|------|----------|
| compatibility | `CompatibilityCheck` | 初回起動・互換性未通過 |
| capture | `CaptureScreen` | 互換性通過または DEV モード |
| analysis | `AnalysisScreen` | 画像 2 枚取得完了 |
| report | `ReportScreen` | 解析成功 |
| error | エラーパネル | 例外発生/互換性 NG |

開発時は `SettingsButton` から `PerformancePanel` と `TestRunner` を開ける。

## 5. 機能仕様
### 5.1 互換性チェック
- コンポーネント: `CompatibilityCheck.tsx`
- 使用ユーティリティ: `compatibilityChecker`, `deviceDetection`
- 出力: `CompatibilityResult` (score, level, issues, recommendations) と `DeviceInfo`
- UI: スコアバッジ、問題一覧、詳細表示トグル、再評価ボタン。
- 失敗時: エラーパネルと再試行ボタン。

### 5.2 デバイス適応
- フック: `useDeviceAdaptation`
- 処理: 初期化時にデバイス情報と互換性結果を取得し、`DeviceAdaptationConfig` を生成。
- 設定内容: UI スケール、タッチターゲット、画像品質、処理タイムアウト、機能有効化 (Offline/Camera/A11y 等)。
- `App` では `data-device-type` 属性でレイアウト切り替え。

### 5.3 撮影・アップロード
- コンポーネント: `CaptureScreen`
- 撮影: `useCamera` が getUserMedia でストリーム取得 → canvas へ描画 → JPEG Blob (画質 0.8) を生成。
- アップロード: `ImageUpload` が画像を読み込み、寸法を取得。
- 状態制御: `currentView`, `captureMode`, `isAligned` (将来 TODO: 実測アライメント)。
- UI: カメラ/アップロード切替タブ、撮影ボタン、位置調整スキップ、前額面やり直し。
- アクセシビリティ: `useKeyboardNavigation` で Space 撮影、Tab フォーカス制御。`useAnnouncer` でライブリージョン通知。

### 5.4 姿勢解析
- コンポーネント: `AnalysisScreen`
- ステップ: MediaPipe 初期化 → 前額面検出 → 矢状面検出 → Kendall 指標算出 → 解析結果渡し。
- 進捗表示: 10/25/40/55/70/85/95/100% の段階更新。
- エラー時: `onAnalysisError` で App の error 状態へ。

### 5.5 レポート表示
- コンポーネント: `ReportScreen`
- 要素: `LandmarkVisualizer` 2 枚、詳細 Kendall カード、代償連鎖、リスク、機能制限、エクスポート、共有、AI、免責。
- モーダル: `APIConfigModal` (エンドポイント管理)、`AIReportModal` (AI レポート閲覧)。
- 状態: エクスポート/共有/AI 処理中フラグをボタン表示に反映。

### 5.6 エクスポート機能
- サービス: `ReportGenerationService`
  - PDF: `jsPDF` で A4 組版、画像を Base64 変換、主要セクションを描画。
  - PNG: `html-to-image.toPng` でレポート DOM をキャプチャ。
  - JSON: 解析オブジェクトを `Blob` に変換し `saveAs` で保存。
- エラー時: `alert` で通知。

### 5.7 共有機能
- サービス: `SharingService`
  - Web Share API (タイトル/テキスト/URL/ファイル) を優先使用。不可の場合はクリップボードへコピーし通知、ファイルはダウンロード。
  - 共有テキストには主要所見とハッシュタグを含める。
  - SNS ボタンは `shareToSocialMedia` で個別 URL を開く。

### 5.8 AI レポート
- サービス: `AIReportService` + `APIConfigService`
  - `APIConfigService` が localStorage 保存 (`postaure_api_config`)。
  - `generateAIReport` が有効エンドポイントを選択し `callAnalysisAPI` を実行。
  - 返却データを `AIGeneratedReport` に整形しキャッシュ (`postaure_ai_reports`)。
- UI: API 未設定時は設定モーダルを促し、成功時はモーダルで結果表示。

### 5.9 オフライン機能
- Service Worker: `public/sw.js`
  - インストール時に `STATIC_ASSETS` と MediaPipe WASM をキャッシュ。
  - キャッシュ戦略: Static=Cache First、MediaPipe=Cache First+Network fallback、API=Network First、その他=Stale While Revalidate。
  - `/api/analysis` 失敗時はオフラインメッセージ JSON を返却。
- `OfflineService`: SW 登録、接続イベント監視、背景同期/Push 準備、オフライン解析保管 (最大 50 件)。

### 5.10 エラーハンドリング
- `ErrorBoundary` がレンダリング例外を捕捉し再起動ボタン等を表示。
- `useErrorHandler` がエラーログを保管し `ErrorMessage` でトースト表示。
- `App` の error 状態で再試行/互換性チェック/開発ツールボタンを提供。

## 6. UI 仕様 (要点)
- `CompatibilityCheck`: ステータスカラー (full=#27ae60, partial=#f1c40f, unsupported=#e74c3c)、スコア円グラフ風表示。
- `CaptureScreen`: プレビュー、ガイドラインリスト、撮影ボタンの色で整列状態を表現。
- `AnalysisScreen`: プログレスバー + ステップテキスト + 画像サムネイル。
- `ReportScreen`: グリッドレイアウト (レスポンシブ)、AI セクションは API 状態に応じてボタン活性制御。

## 7. データモデル
- `ImageData`: `{ blob, width, height, timestamp, viewType }`
- `MediaPipeDetectionResult`: `{ landmarks, confidence, imageWidth, imageHeight }`
- `EnhancedPostureAnalysisResult`: frontal/sagittal 情報 + Kendall 分類 + advancedKendallAnalysis + timestamp。
- `AIGeneratedReport`: executiveSummary, clinicalFindings, riskAssessment, treatmentPlan など詳細情報。
- `DeviceAdaptationConfig`: UI/性能/機能制御の設定。
- `CompatibilityResult`: isSupported, level, score, issues[], recommendations[]。

## 8. ストレージ仕様
- localStorage: `compatibility_passed`, `postaure_api_config`, `postaure_ai_reports`
- Cache Storage: `postaure-static-v1.2.0`, `postaure-dynamic-v1.2.0`, `postaure-analysis-v1.2.0`
- IndexedDB: 未使用

## 9. 非機能対応
- パフォーマンス: `performanceMonitor` + `PerformancePanel` で FPS/CPU 的指標を可視化。撮影画像は JPEG 圧縮。
- セキュリティ: HTTPS 前提、画像は外部送信せずローカル処理。AI API 利用時はユーザー操作で送信。
- アクセシビリティ: `useAnnouncer` の ARIA ライブ、フォーカス管理、十分なコントラスト (App.css 調整)。

## 10. テスト計画
- 自動: 現時点なし。`npm run lint`、`npm run build` を CI で実行。
- 手動:
  1. 互換性チェック (対応/非対応ケース)
  2. カメラ撮影 + 解析 + レポート + エクスポート
  3. オフライン再読み込みで offline.html/フォールバック確認
  4. AI レポート成功/失敗ケース
  5. アクセシビリティ (スクリーンリーダー/キーボード)

## 11. ビルド・デプロイ
- インストール: `npm install`
- 開発: `npm run dev`
- 本番ビルド: `npm run build`
- プレビュー: `npm run preview`
- デプロイ: 静的ホスティング (Vercel/Netlify/Cloudflare Pages 等)
- Service Worker 更新: キャッシュ名を更新 → ビルド → デプロイ

## 12. 運用・監視
- コンソールログでカメラ初期化・MediaPipe・SW 状態を記録。
- 重大エラーは `console.error` で通知し、UI で案内。
- 将来的に Web アナリティクスや障害監視ツール導入を検討。

## 13. アクセシビリティ詳細
- `aria-live`: polite (`announcer-polite`), assertive (`announcer-assertive`)
- キーボード操作: CaptureScreen の Space 撮影、モーダル ESC 閉じ、フォーカスループ。
- コントラスト: 最低 4.5:1 を CSS で確保。

## 14. リリース後タスク
- 撮影時アライメントチェックの実装
- Service Worker プリキャッシュ自動生成 (Vite PWA 等)
- i18n 対応
- E2E テスト導入 (Playwright 等)

---

本仕様書は要件定義書に基づき、Postaure v1.0.0 の実装・テスト・運用の指針とする。
