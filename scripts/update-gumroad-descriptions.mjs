#!/usr/bin/env node
/**
 * Gumroad 상품 설명 업데이트 (언어별 HTML)
 * - 상세한 HTML 설명
 * - 샘플 PDF 링크 포함 (GitHub Pages: https://tedpark.github.io/sample/...)
 */

const TOKEN = process.env.GUMROAD_ACCESS_TOKEN;
if (!TOKEN) {
  console.error('❌ GUMROAD_ACCESS_TOKEN 환경변수 없음');
  process.exit(1);
}

const SAMPLE_BASE = 'https://tedpark.github.io/sample';

const PRODUCTS = [
  {
    productId: 'djTHAqjPOYmbOFX_9S0Xaw==',
    name: 'Tauri2 KO',
    updates: {
      name: 'Vibe Coding Tauri 2 (한국어)',
      description: `<h2>AI와 함께 Tauri 2 앱 5개를 만드는 실전 가이드</h2>

<p>이 책은 Vibe Coding 방식으로 AI를 적극 활용하여 Rust + TypeScript 기반의 실제 데스크탑 앱을 빠르게 구축하는 방법을 단계별로 안내합니다.</p>

<h3>📚 이 책으로 배우는 것</h3>
<ul>
  <li>Tauri 2 아키텍처와 Rust 백엔드 + TypeScript 프론트엔드 연동</li>
  <li>AI(Cursor/Claude) 활용 코드 작성 및 디버깅</li>
  <li>실전 앱 5개 완성: Todo, 마크다운 에디터, 파일 관리자, 실시간 채팅, 시스템 모니터</li>
  <li>macOS / Windows / Linux 크로스 플랫폼 빌드 및 배포</li>
  <li>자동 업데이트, 시스템 트레이, 파일 I/O, 네이티브 알림 등 고급 기능</li>
</ul>

<h3>🎯 대상 독자</h3>
<ul>
  <li>Electron에서 더 가벼운 대안을 찾는 웹 개발자</li>
  <li>Rust를 처음 접하는 TypeScript/JavaScript 개발자</li>
  <li>AI 코딩 도구로 생산성을 높이고 싶은 개발자</li>
</ul>

<h3>📄 무료 샘플</h3>
<p><a href="${SAMPLE_BASE}/tauri2-ko-sample.pdf">📥 무료 샘플 PDF 다운로드</a> — 목차 및 1~2장 포함</p>

<h3>📋 구성</h3>
<p>한국어 · PDF · 약 250페이지 · 코드 예제 포함</p>`,
    },
  },
  {
    productId: 'TVcfR6XC2lS6nfN28LGSAg==',
    name: 'Tauri2 EN',
    updates: {
      name: 'Vibe Coding Tauri 2 (English)',
      description: `<h2>Build 5 Real Desktop Apps with Tauri 2 using AI</h2>

<p>A hands-on guide to building production-grade desktop applications with Rust + TypeScript using the Vibe Coding approach — letting AI tools do the heavy lifting while you stay in control.</p>

<h3>📚 What You'll Learn</h3>
<ul>
  <li>Tauri 2 architecture: Rust backend + TypeScript frontend integration</li>
  <li>AI-assisted coding with Cursor/Claude for rapid prototyping</li>
  <li>5 complete real-world apps: Todo, Markdown Editor, File Manager, Real-time Chat, System Monitor</li>
  <li>Cross-platform builds for macOS, Windows, and Linux</li>
  <li>Advanced features: auto-update, system tray, file I/O, native notifications</li>
</ul>

<h3>🎯 Who This Is For</h3>
<ul>
  <li>Web developers looking for a lighter Electron alternative</li>
  <li>TypeScript/JavaScript developers new to Rust</li>
  <li>Developers who want to ship desktop apps fast with AI tools</li>
</ul>

<h3>📄 Free Sample</h3>
<p><a href="${SAMPLE_BASE}/tauri2-en-sample.pdf">📥 Download Free Sample PDF</a> — includes table of contents and chapters 1–2</p>

<h3>📋 Details</h3>
<p>English · PDF · ~250 pages · Full code examples included</p>`,
    },
  },
  {
    productId: 'ICFiOtKXhmQrSwqYtJcsUw==',
    name: 'Tauri2 JA',
    updates: {
      name: 'Vibe Coding Tauri 2 (日本語)',
      description: `<h2>AIと一緒にTauri 2でデスクトップアプリを5本作る実践ガイド</h2>

<p>Vibe Codingのアプローチで、AIツールを最大限に活用しながらRust + TypeScriptベースの実践的なデスクトップアプリを素早く構築する方法をステップバイステップで解説します。</p>

<h3>📚 学べること</h3>
<ul>
  <li>Tauri 2のアーキテクチャ：RustバックエンドとTypeScriptフロントエンドの連携</li>
  <li>Cursor/ClaudeなどのAIツールを活用したコーディングとデバッグ</li>
  <li>実践アプリ5本を完成：Todo、マークダウンエディター、ファイルマネージャー、リアルタイムチャット、システムモニター</li>
  <li>macOS・Windows・Linuxのクロスプラットフォームビルドと配布</li>
  <li>自動アップデート、システムトレイ、ファイルI/O、ネイティブ通知などの高度な機能</li>
</ul>

<h3>🎯 対象読者</h3>
<ul>
  <li>Electronの軽量な代替を探しているWebデベロッパー</li>
  <li>RustをはじめてさわるTypeScript/JavaScriptデベロッパー</li>
  <li>AIコーディングツールで生産性を高めたいデベロッパー</li>
</ul>

<h3>📄 無料サンプル</h3>
<p><a href="${SAMPLE_BASE}/tauri2-ja-sample.pdf">📥 無料サンプルPDFをダウンロード</a> — 目次と第1〜2章を含む</p>

<h3>📋 詳細</h3>
<p>日本語 · PDF · 約250ページ · コードサンプル完全収録</p>`,
    },
  },
  {
    productId: 'snUyudrXoHmaTNrwHcCYhg==',
    name: 'Quant KO',
    updates: {
      name: 'Stock Trading AI 실전 구현 (한국어)',
      description: `<h2>HMM · 칼만 필터 · SAC 강화학습으로 만드는 실전 퀀트 트레이딩 시스템</h2>

<p>단순한 이론 소개가 아닌, 실제로 작동하는 AI 퀀트 트레이딩 시스템을 처음부터 끝까지 구축하는 완전 실습 가이드입니다. Python 코드 위주로 구성되어 있습니다.</p>

<h3>📚 이 책으로 배우는 것</h3>
<ul>
  <li>Hidden Markov Model(HMM)로 시장 레짐(Bull/Bear/Sideways) 탐지</li>
  <li>칼만 필터로 노이즈 제거 및 실시간 상태 추정</li>
  <li>Soft Actor-Critic(SAC) 강화학습 에이전트로 주문 집행 최적화</li>
  <li>Kelly Criterion을 활용한 포지션 사이징</li>
  <li>페어 트레이딩 및 통계적 차익거래 전략 구현</li>
  <li>Optuna로 하이퍼파라미터 최적화</li>
  <li>IBKR API 연동으로 실시간 매매 자동화</li>
  <li>MLflow로 모델 버전 관리 및 배포</li>
</ul>

<h3>🎯 대상 독자</h3>
<ul>
  <li>Python 기반 퀀트 전략을 실전에 적용하고 싶은 개발자/투자자</li>
  <li>머신러닝을 트레이딩에 접목하고 싶은 데이터 사이언티스트</li>
  <li>알고리즘 트레이딩 시스템을 처음 구축하는 분</li>
</ul>

<h3>📄 무료 샘플</h3>
<p><a href="${SAMPLE_BASE}/quant-ko-sample.pdf">📥 무료 샘플 PDF 다운로드</a> — 목차 및 1~2장 포함</p>

<h3>📋 구성</h3>
<p>한국어 · PDF · 약 350페이지 · 핵심 Python 소스코드 포함</p>`,
    },
  },
  {
    productId: '2qczS_DfK0_pxAoGC439kg==',
    name: 'Quant EN',
    updates: {
      name: 'Stock Trading AI (English)',
      description: `<h2>Build a Quant Trading System with HMM, Kalman Filter &amp; SAC Reinforcement Learning</h2>

<p>A complete, code-first guide to building a production-ready AI-powered quantitative trading system from scratch using Python. No hand-waving — every system is implemented and explained.</p>

<h3>📚 What You'll Learn</h3>
<ul>
  <li>Hidden Markov Models (HMM) for market regime detection (Bull/Bear/Sideways)</li>
  <li>Kalman filter for noise reduction and real-time state estimation</li>
  <li>Soft Actor-Critic (SAC) reinforcement learning agent for order execution</li>
  <li>Kelly Criterion for position sizing and risk management</li>
  <li>Pairs trading and statistical arbitrage strategy implementation</li>
  <li>Hyperparameter optimization with Optuna</li>
  <li>IBKR API integration for live automated trading</li>
  <li>MLflow for model versioning and deployment</li>
</ul>

<h3>🎯 Who This Is For</h3>
<ul>
  <li>Python developers and traders who want to apply ML to real markets</li>
  <li>Data scientists who want to bridge ML and quantitative finance</li>
  <li>Anyone building their first algorithmic trading system</li>
</ul>

<h3>📄 Free Sample</h3>
<p><a href="${SAMPLE_BASE}/quant-en-sample.pdf">📥 Download Free Sample PDF</a> — includes table of contents and chapters 1–2</p>

<h3>📋 Details</h3>
<p>English · PDF · ~350 pages · Core Python source code included</p>`,
    },
  },
  {
    productId: 'C6rqVzKe4oV_fKepAQfNOw==',
    name: 'Quant JA',
    updates: {
      name: 'Stock Trading AI 実践実装 (日本語)',
      description: `<h2>HMM・カルマンフィルター・SAC強化学習で作るクオンツトレーディングシステム</h2>

<p>理論の紹介に留まらず、実際に動くAIクオンツトレーディングシステムをゼロから構築する完全実践ガイドです。Pythonコードを中心に、すべてのシステムを実装しながら解説します。</p>

<h3>📚 学べること</h3>
<ul>
  <li>Hidden Markov Model（HMM）による市場レジーム（Bull/Bear/Sideways）の検出</li>
  <li>カルマンフィルターによるノイズ除去とリアルタイム状態推定</li>
  <li>Soft Actor-Critic（SAC）強化学習エージェントによる注文執行最適化</li>
  <li>Kelly基準を活用したポジションサイジング</li>
  <li>ペアトレードと統計的裁定取引戦略の実装</li>
  <li>Optunaによるハイパーパラメータ最適化</li>
  <li>IBKR APIとの連携によるリアルタイム自動売買</li>
  <li>MLflowによるモデルバージョン管理とデプロイ</li>
</ul>

<h3>🎯 対象読者</h3>
<ul>
  <li>Pythonベースのクオンツ戦略を実践に応用したい開発者・投資家</li>
  <li>機械学習をトレーディングに活かしたいデータサイエンティスト</li>
  <li>アルゴリズムトレーディングシステムをはじめて構築する方</li>
</ul>

<h3>📄 無料サンプル</h3>
<p><a href="${SAMPLE_BASE}/quant-ja-sample.pdf">📥 無料サンプルPDFをダウンロード</a> — 目次と第1〜2章を含む</p>

<h3>📋 詳細</h3>
<p>日本語 · PDF · 約350ページ · Python主要ソースコード収録</p>`,
    },
  },
];

async function updateProduct(productId, updates) {
  const pairs = [`access_token=${encodeURIComponent(TOKEN)}`];
  for (const [k, v] of Object.entries(updates)) {
    pairs.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  }

  const res = await fetch(`https://api.gumroad.com/v2/products/${encodeURIComponent(productId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: pairs.join('&'),
  });
  const d = await res.json();
  if (!d.success) throw new Error('update failed: ' + JSON.stringify(d));
  return d.product;
}

async function main() {
  console.log('📝 Gumroad 상품 설명 업데이트...\n');

  for (const item of PRODUCTS) {
    console.log(`📘 ${item.name}`);
    try {
      const p = await updateProduct(item.productId, item.updates);
      console.log(`   이름: ${p.name}`);
      console.log(`   설명 길이: ${(p.description || '').length}자`);
      console.log(`   ✅ 완료\n`);
    } catch (err) {
      console.error(`   ❌ 실패: ${err.message}\n`);
    }
  }

  console.log('✅ 모든 상품 설명 업데이트 완료');
}

main();
