import { CATEGORIES, CATEGORY_LABELS, DEFAULT_MACRO_EVENTS } from '../../shared/symbols.mjs';

export { CATEGORIES, CATEGORY_LABELS, DEFAULT_MACRO_EVENTS };

const KEY_SCRAP = 'hana_fo_scrap_v1';
const KEY_CLICKS = 'hana_fo_clicks_v1';
const KEY_BOARD = 'hana_fo_board_v1';

export const Storage = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  },
  set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* storage 꽉 찼거나 비활성 — 무시 */ }
  }
};

export const STATE = {
  market: null,          // data/market.json 내용
  news: [],              // data/news.json → items
  insights: [],          // data/insights.json → items
  edition: (new Date().getHours() >= 15) ? 'EVENING' : 'MORNING',
  isEditing: false,
  category: 'indices',
  symbolIdx: 0,
  rangeKey: '1M',         // '1M' | '1Y' — series 두 구간만 사전 계산되어 있음
  newsFilter: 'ALL',
  newsCount: 12,
  scrapMap: Storage.get(KEY_SCRAP, {}),
  clickMap: Storage.get(KEY_CLICKS, {}),
  lastSyncOk: null
};

export function saveScrap() { Storage.set(KEY_SCRAP, STATE.scrapMap); }
export function saveClicks() { Storage.set(KEY_CLICKS, STATE.clickMap); }

export function getBoardPosts() {
  const seeded = Storage.get(KEY_BOARD, null);
  if (seeded) return seeded;
  const initial = [{
    id: 1, category: '본사공지', title: 'WM RESEARCH DESK v2 오픈 안내',
    author: 'F/O 본사 솔루션팀', date: new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
    content: '시세·뉴스 수집을 서버(GitHub Actions)로 이관하여 더 이상 공개 프록시에 의존하지 않습니다. 상단 동기화 배지에서 최신 반영 시각을 확인하실 수 있습니다.'
  }];
  Storage.set(KEY_BOARD, initial);
  return initial;
}
export function setBoardPosts(posts) { Storage.set(KEY_BOARD, posts); }

/** data/*.json 로딩 — 실패 시에도 앱이 죽지 않도록 각각 독립적으로 처리 */
async function loadJson(path) {
  try {
    const res = await fetch(`${path}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`[state] ${path} 로딩 실패:`, err.message);
    return null;
  }
}

export async function loadAllData() {
  const [market, news, insights] = await Promise.all([
    loadJson('./data/market.json'),
    loadJson('./data/news.json'),
    loadJson('./data/insights.json')
  ]);

  if (market) { STATE.market = market; STATE.lastSyncOk = true; }
  else { STATE.lastSyncOk = false; }

  if (news) STATE.news = news.items || [];
  if (insights) STATE.insights = (insights.items || []).map((r, i) => ({ ...r, id: i }));

  return STATE.lastSyncOk;
}

/** market.json의 generatedAt 이 얼마나 오래됐는지로 신선도 뱃지 상태를 결정 */
export function freshness() {
  if (!STATE.market?.generatedAt) return 'down';
  const ageMin = (Date.now() - new Date(STATE.market.generatedAt).getTime()) / 60000;
  if (ageMin <= 20) return 'live';
  if (ageMin <= 90) return 'stale';
  return 'down';
}

export function findQuote(symbol) {
  if (!STATE.market) return null;
  const pools = [STATE.market.coreSix, ...Object.values(STATE.market.categories || {})];
  for (const pool of pools) {
    const hit = (pool || []).find((q) => q.symbol === symbol);
    if (hit) return hit;
  }
  return null;
}
