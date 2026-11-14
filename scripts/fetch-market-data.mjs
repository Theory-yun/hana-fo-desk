/**
 * scripts/fetch-market-data.mjs
 * ------------------------------------------------------------------
 * 역할 : data/market.json, data/news.json 을 "서버사이드"에서 직접 생성한다.
 *
 * 왜 이 구조가 기존 버전의 근본 문제를 해결하는가
 * ------------------------------------------------------------------
 * 기존 버전은 브라우저가 매번 corsproxy.io / allorigins.win / codetabs.com 같은
 * 공개 CORS 프록시를 거쳐 Yahoo·Naver·RSS를 직접 호출했습니다.
 *   - 공개 프록시는 레이트리밋/다운타임이 잦고, corsproxy.io는 현재 운영 도메인
 *     기준 유료 API 키 없이는 사실상 차단됨 → "실시간 갱신 안 됨"의 근본 원인.
 * 이 스크립트는 GitHub Actions(서버) 안에서 실행되므로애초에 CORS가 적용되지
 * 않고, 프록시도 필요 없습니다. 결과(JSON)만 레포에 커밋 → GitHub Pages가
 * 정적 파일로 서빙 → 브라우저는 "같은 출처(same-origin)"의 JSON 파일만
 * fetch 하면 됩니다. 실패 지점이 '브라우저 × 사용자 수' 가 아니라
 * '스크립트 1회 실행'으로 줄어들고, 실패해도 마지막 성공 데이터가 그대로
 * 레포에 남아 있어 화면이 깨지지 않습니다.
 * ------------------------------------------------------------------
 * 실행: node scripts/fetch-market-data.mjs   (Node 18+ 전역 fetch 사용)
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CORE_SIX, CATEGORIES, NEWS_CATEGORY_RULES, DIRECT_RSS_FEEDS } from '../shared/symbols.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = `${__dirname}/../data`;
const UA = 'Mozilla/5.0 (compatible; HanaFODeskBot/1.0; +https://github.com/)';
const TIMEOUT_MS = 8000;

/** 타임아웃 포함 fetch. 실패해도 예외를 던지지 않고 null을 반환한다(부분 실패 허용). */
async function safeFetch(url, { type = 'json', headers = {} } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
    return type === 'json' ? await res.json() : await res.text();
  } catch (err) {
    console.warn(`[WARN] fetch 실패: ${url} — ${err.message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/* ------------------------------------------------------------------ */
/* 1. 국내 지수 (네이버 모바일 공식 API)                               */
/* ------------------------------------------------------------------ */
async function fetchNaverDomestic(naverCode) {
  const url = `https://m.stock.naver.com/api/index/${encodeURIComponent(naverCode)}/basic`;
  const data = await safeFetch(url, { headers: { Referer: 'https://m.stock.naver.com/' } });
  if (!data || !data.closePrice) return null;
  const price = parseFloat(String(data.closePrice).replace(/,/g, ''));
  const diff = parseFloat(String(data.compareToPreviousClosePrice || '0').replace(/,/g, ''));
  const pct = parseFloat(String(data.fluctuationsRatio || '0').replace(/,/g, ''));
  const isDown = data.compareToPreviousPrice?.code === '5' || data.compareToPreviousPrice?.name === 'FALLING';
  const sign = isDown ? -1 : 1;
  return { price, diff: sign * Math.abs(diff), pct: sign * Math.abs(pct) };
}

/* ------------------------------------------------------------------ */
/* 2. 글로벌 지수/원자재/외환/채권/크립토 (Yahoo Finance chart API)     */
/* ------------------------------------------------------------------ */
async function fetchYahooSeries(symbol, range, interval) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
  const json = await safeFetch(url);
  const result = json?.chart?.result?.[0];
  if (!result?.meta) return null;

  const closes = result.indicators?.quote?.[0]?.close || [];
  const times = result.timestamp || [];
  const series = [];
  for (let i = 0; i < closes.length; i++) {
    if (closes[i] != null) series.push({ t: times[i], v: closes[i] });
  }

  const cur = result.meta.regularMarketPrice ?? series.at(-1)?.v ?? null;
  const prev = result.meta.chartPreviousClose ?? result.meta.previousClose ?? series.at(-2)?.v ?? cur;
  const diff = cur != null && prev != null ? cur - prev : null;
  const pct = diff != null && prev ? (diff / prev) * 100 : null;

  return { price: cur, diff, pct, series, asOf: result.meta.regularMarketTime || null };
}

async function fetchQuote(item) {
  // 차트 토글(1개월/1년)이 실제로 동작하도록 두 구간을 모두 미리 구워 둔다.
  const [m1, y1] = await Promise.all([
    fetchYahooSeries(item.symbol, '1mo', '1d'),
    fetchYahooSeries(item.symbol, '1y', '1wk')
  ]);

  // 국내 지수는 네이버 공식 API를 1순위로 사용 (더 정확한 KRX 종가/부호)
  if (item.source === 'naver-domestic' || item.naverCode) {
    const nv = await fetchNaverDomestic(item.naverCode);
    if (nv) {
      return {
        symbol: item.symbol, name: item.name,
        price: nv.price, diff: nv.diff, pct: nv.pct,
        series: m1?.series || [], series1y: y1?.series || [],
        asOf: Date.now() / 1000
      };
    }
  }

  if (!m1 || m1.price == null) return null;
  return {
    symbol: item.symbol, name: item.name,
    price: m1.price, diff: m1.diff, pct: m1.pct,
    series: m1.series, series1y: y1?.series || [],
    asOf: m1.asOf
  };
}

/* ------------------------------------------------------------------ */
/* 3. RSS / Google News 파싱 (정규식 기반 — 외부 XML 라이브러리 불필요)  */
/* ------------------------------------------------------------------ */
function decodeEntities(str) {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ').trim();
}

function classifyTags(title, primaryCat) {
  const set = new Set();
  if (primaryCat) set.add(primaryCat);
  for (const rule of NEWS_CATEGORY_RULES) {
    if (rule.keywords.some((kw) => title.includes(kw))) set.add(rule.cat);
  }
  return set.size ? [...set].slice(0, 3) : [primaryCat || '매크로'];
}

function parseRssItems(xml, defaultCat, defaultPress) {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  const items = [];
  for (const block of blocks) {
    const grab = (tag) => {
      const m = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return m ? decodeEntities(m[1]) : '';
    };
    let title = grab('title');
    const link = grab('link') || grab('guid');
    const pubDate = grab('pubDate');
    let press = grab('source') || defaultPress || '';

    if (!defaultPress && title.includes(' - ')) {
      const idx = title.lastIndexOf(' - ');
      const candidate = title.slice(idx + 3).trim();
      if (candidate.length <= 18) { press = candidate; title = title.slice(0, idx).trim(); }
    }
    if (!press) press = '경제뉴스';

    const ts = Date.parse(pubDate);
    if (!title || !link || Number.isNaN(ts)) continue;
    if (Date.now() - ts > 30 * 86400000) continue; // 30일 초과 기사는 제외

    items.push({
      title, press, url: link,
      timestamp: ts,
      date: new Date(ts).toISOString(),
      tags: classifyTags(title, defaultCat)
    });
  }
  return items;
}

async function fetchDirectRss(feed) {
  const xml = await safeFetch(feed.url, { type: 'text' });
  if (!xml) return [];
  return parseRssItems(xml, feed.cat, feed.press);
}

async function fetchGoogleNews(query, cat) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;
  const xml = await safeFetch(url, { type: 'text' });
  if (!xml) return [];
  return parseRssItems(xml, cat, '');
}

/* ------------------------------------------------------------------ */
/* 4. 메인 실행                                                        */
/* ------------------------------------------------------------------ */
async function main() {
  console.log('▶ 시세 수집 시작', new Date().toISOString());

  // --- 4-1. 카테고리별 시세 (순차 처리 + 짧은 대기: 외부 API 과도호출 방지) ---
  const categories = {};
  for (const [catKey, list] of Object.entries(CATEGORIES)) {
    categories[catKey] = [];
    for (const item of list) {
      const q = await fetchQuote(item);
      categories[catKey].push({ ...item, ...(q || { price: null, diff: null, pct: null, series: [] }) });
      await sleep(250);
    }
    console.log(`  - ${catKey}: ${categories[catKey].length}건 수집`);
  }

  // --- 4-2. 대시보드 6대 핵심 지표 (카테고리 수집 결과에서 재사용, 없으면 개별 수집) ---
  const flatQuotes = Object.values(categories).flat();
  const coreSix = [];
  for (const core of CORE_SIX) {
    const found = flatQuotes.find((q) => q.symbol === core.symbol);
    const quote = found || (await fetchQuote(core));
    coreSix.push({ ...core, ...(quote || { price: null, diff: null, pct: null }) });
  }

  const market = {
    generatedAt: new Date().toISOString(),
    coreSix,
    categories
  };

  // --- 4-3. 뉴스 (직접 RSS + Google News 카테고리 검색) ---
  let news = [];
  for (const feed of DIRECT_RSS_FEEDS) {
    news.push(...(await fetchDirectRss(feed)));
    await sleep(200);
  }
  for (const rule of NEWS_CATEGORY_RULES) {
    news.push(...(await fetchGoogleNews(rule.query, rule.cat)));
    await sleep(200);
  }

  // 중복 제거 (URL 또는 제목 기준) + 최신순 정렬 + 상한 150건
  const seen = new Set();
  news = news
    .filter((n) => {
      const key = n.url || n.title;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 150);

  const newsOut = { generatedAt: new Date().toISOString(), items: news };

  // --- 4-4. 파일 기록 ---
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(`${OUT_DIR}/market.json`, JSON.stringify(market, null, 2));
  await writeFile(`${OUT_DIR}/news.json`, JSON.stringify(newsOut, null, 2));

  console.log(`▶ 완료 — 시세 ${flatQuotes.length}건, 뉴스 ${news.length}건`);
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exitCode = 1;
});
