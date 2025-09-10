# Postaure デプロイメントガイド

このガイドでは、Postaure アプリケーションを本番環境にデプロイする手順を説明します。

## 📋 デプロイメント前のチェックリスト

### ✅ 技術要件
- [ ] Node.js 18.0.0+ がインストール済み
- [ ] TypeScript エラーがすべて解決済み
- [ ] ESLint エラーがすべて解決済み
- [ ] プロダクションビルドが正常に完了
- [ ] 互換性テストがすべて成功
- [ ] パフォーマンステストが基準を満たしている

### ✅ 機能要件
- [ ] MediaPipe 姿勢検出が正常動作
- [ ] Kendall 分析が正確に実行
- [ ] レポート生成（PNG/PDF/JSON）が正常動作
- [ ] カメラ機能とファイルアップロードが正常動作
- [ ] オフライン機能が正常動作
- [ ] PWA として正しく動作

### ✅ セキュリティ要件
- [ ] 環境変数が適切に設定
- [ ] API キーがハードコードされていない
- [ ] HTTPS での配信が設定済み
- [ ] Content Security Policy (CSP) が設定済み
- [ ] プライバシーポリシーが整備済み

## 🚀 デプロイメント手順

### 1. ビルドの準備
```bash
# 依存関係のインストール
npm ci

# TypeScript エラーチェック
npm run build

# 本番ビルドの生成
npm run build
```

### 2. 静的サイトホスティング

#### Vercel デプロイ
```bash
# Vercel CLI のインストール
npm i -g vercel

# プロジェクトのデプロイ
vercel

# 本番デプロイ
vercel --prod
```

#### Netlify デプロイ
```bash
# Netlify CLI のインストール
npm i -g netlify-cli

# ビルドとデプロイ
netlify build
netlify deploy

# 本番デプロイ
netlify deploy --prod
```

#### GitHub Pages デプロイ
```bash
# gh-pages のインストール
npm i -D gh-pages

# デプロイ
npm run build
npx gh-pages -d dist
```

### 3. Docker デプロイ

#### Dockerfile の作成
```dockerfile
# ビルドステージ
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# 本番ステージ
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### nginx.conf の設定
```nginx
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    server {
        listen 80;
        server_name localhost;
        root /usr/share/nginx/html;
        index index.html;

        # Service Worker support
        location /sw.js {
            add_header Cache-Control "no-cache";
            add_header Service-Worker-Allowed "/";
        }

        # PWA manifest
        location /manifest.json {
            add_header Content-Type application/manifest+json;
        }

        # SPA routing
        location / {
            try_files $uri $uri/ /index.html;
        }

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Referrer-Policy "strict-origin-when-cross-origin";
    }
}
```

#### Docker ビルドとデプロイ
```bash
# Docker イメージのビルド
docker build -t postaure:latest .

# コンテナの実行
docker run -d -p 80:80 --name postaure postaure:latest
```

### 4. 環境変数の設定

本番環境では以下の環境変数を設定してください：

```bash
# 必須設定
NODE_ENV=production
VITE_APP_VERSION=1.0.0
VITE_APP_NAME=Postaure

# オプション設定（AIレポート機能を使用する場合）
VITE_OPENAI_API_KEY=your_openai_api_key
VITE_ANTHROPIC_API_KEY=your_anthropic_api_key

# 分析・プライバシー設定（オプション）
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_ERROR_REPORTING=false
```

## 🔧 パフォーマンス最適化

### 1. Bundle Size の最適化
```bash
# Bundle analyzer を使用してサイズをチェック
npm run build -- --analyze

# 大きなライブラリを動的インポートに変更
# MediaPipe、pdf-lib、html2canvas など
```

### 2. CDN の設定
静的アセット（画像、フォント、アイコンなど）をCDNで配信することを推奨：

```javascript
// vite.config.ts でCDN設定
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['@mediapipe/pose', '@mediapipe/camera_utils'],
      output: {
        globals: {
          '@mediapipe/pose': 'MediaPipePose',
          '@mediapipe/camera_utils': 'MediaPipeCamera'
        }
      }
    }
  }
});
```

### 3. Service Worker の最適化
```javascript
// キャッシュ戦略の調整
const CACHE_STRATEGY = {
  images: 'cache-first',
  api: 'network-first', 
  static: 'stale-while-revalidate'
};
```

## 🔍 監視とモニタリング

### 1. エラー監視
```javascript
// 本番環境でのエラー監視
if (import.meta.env.PROD && import.meta.env.VITE_ENABLE_ERROR_REPORTING) {
  // Sentry, LogRocket, などの設定
}
```

### 2. パフォーマンス監視
```javascript
// Web Vitals の監視
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

getCLS(console.log);
getFID(console.log);
getFCP(console.log);
getLCP(console.log);
getTTFB(console.log);
```

### 3. ユーザー分析（オプション）
```javascript
// プライバシーに配慮した分析
if (userConsent && import.meta.env.VITE_ENABLE_ANALYTICS) {
  // Google Analytics 4, Plausible, などの設定
}
```

## 🛡️ セキュリティ設定

### 1. Content Security Policy
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  media-src 'self' blob:;
  worker-src 'self';
  connect-src 'self' https://api.openai.com https://api.anthropic.com;
">
```

### 2. HTTPS の強制
```javascript
// HTTPS リダイレクト
if (location.protocol !== 'https:' && !location.hostname.includes('localhost')) {
  location.replace(`https:${location.href.substring(location.protocol.length)}`);
}
```

### 3. Permissions Policy
```html
<meta http-equiv="Permissions-Policy" content="
  camera=(self),
  microphone=(),
  geolocation=(),
  gyroscope=(),
  magnetometer=(),
  payment=()
">
```

## 📊 デプロイメント後の検証

### 1. 機能テスト
- [ ] 姿勢分析が正常動作
- [ ] レポート出力が正常動作
- [ ] PWA として正しくインストール可能
- [ ] オフライン機能が正常動作
- [ ] 各種ブラウザでの動作確認

### 2. パフォーマンステスト
- [ ] Lighthouse スコア 90+ (Performance)
- [ ] First Contentful Paint < 2秒
- [ ] Largest Contentful Paint < 4秒
- [ ] Time to Interactive < 5秒

### 3. アクセシビリティテスト
- [ ] Lighthouse スコア 100 (Accessibility)
- [ ] スクリーンリーダーでの動作確認
- [ ] キーボードナビゲーション確認

## 🔄 継続的デプロイメント (CI/CD)

### GitHub Actions の設定例
```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm test
    
    - name: Build
      run: npm run build
      env:
        VITE_APP_VERSION: ${{ github.sha }}
    
    - name: Deploy to Vercel
      uses: amondnet/vercel-action@v25
      with:
        vercel-token: ${{ secrets.VERCEL_TOKEN }}
        vercel-org-id: ${{ secrets.ORG_ID }}
        vercel-project-id: ${{ secrets.PROJECT_ID }}
        vercel-args: '--prod'
```

## 🎯 パフォーマンス目標値

### 本番環境での目標値
- **Bundle Size**: < 1MB (gzipped < 300KB)
- **First Load**: < 3秒 (3G接続)
- **Analysis Time**: < 5秒 per image pair
- **Memory Usage**: < 150MB typical
- **Lighthouse Score**: 
  - Performance: 90+
  - Accessibility: 100
  - Best Practices: 90+
  - SEO: 90+

## 📞 サポート

デプロイメント時の問題については：

1. GitHub Issues での報告
2. デプロイメントログの確認
3. ブラウザ Developer Tools での確認
4. パフォーマンス監視データの分析

---

**⚠️ 重要**: 本番環境では必ずHTTPS環境で配信し、適切なセキュリティヘッダーを設定してください。