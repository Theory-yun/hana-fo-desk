import { STATE, loadAllData, getBoardPosts, CATEGORIES, CATEGORY_LABELS } from './state.js';
import * as R from './render.js';
import * as A from './actions.js';

const $ = (id) => document.getElementById(id);
const POLL_MS = 60_000; // data/*.json을 1분마다 재확인 (Action이 갱신했으면 자동 반영)

/* ---------------------------------------------------------------------
   정적 하위 UI(서브탭/필터 pill)를 카테고리 정의에서 자동 생성
--------------------------------------------------------------------- */
function buildSubTabs() {
  $('sub-tabs').innerHTML = Object.keys(CATEGORIES).map((key, i) => `
    <button type="button" class="pill sub-tab-btn ${i === 0 ? 'active' : ''}" data-cat="${key}">${CATEGORY_LABELS[key]}</button>
  `).join('');
}

function buildNewsFilters() {
  const cats = ['ALL', '매크로', 'TAX', '부동산', '외환', '대체투자', 'SCRAP'];
  const labels = { ALL: '전체보기', TAX: 'TAX·패밀리오피스', SCRAP: `스크랩북` };
  $('news-filters').innerHTML = cats.map((c) => `
    <button type="button" class="pill news-filter-btn ${c === 'ALL' ? 'active' : ''}" data-filter="${c}">${labels[c] || c}${c === 'SCRAP' ? ` (<span id="scrap-count">0</span>)` : ''}</button>
  `).join('');
}

function buildInsightFilters() {
  const cats = ['ALL', '국내 부자보고서', '글로벌 F/O 백서', '가업승계·세무·신탁'];
  $('insight-filters').innerHTML = cats.map((c) => `
    <button type="button" class="pill insight-filter-btn ${c === 'ALL' ? 'active' : ''}" data-cat="${c}">${c === 'ALL' ? `전체 (<span id="insight-total">0</span>)` : c}</button>
  `).join('');
}

/* ---------------------------------------------------------------------
   탭 전환
--------------------------------------------------------------------- */
function switchTab(tabId) {
  document.querySelectorAll('.tab-section').forEach((s) => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tabId));
  $(tabId)?.classList.add('active');
  sessionStorage.setItem('hana_fo_tab', tabId);

  if (tabId === 'tab-indicators') { R.renderInstrumentList(); A.renderSelectedChart(); }
  if (tabId === 'tab-newsroom') R.renderNewsroom();
  if (tabId === 'tab-insight') R.renderInsights();
  if (tabId === 'tab-board') R.renderBoard(getBoardPosts());
}

/* ---------------------------------------------------------------------
   전체 재렌더링 (최초 로딩 및 polling 갱신 시 공용)
--------------------------------------------------------------------- */
function renderAll() {
  R.renderSyncBadge();
  R.renderTicker();
  R.renderCoreSix();
  R.renderEdition();
  R.renderTop5();
  R.renderCalendar();
  R.renderInsights();
  const active = document.querySelector('.tab-section.active')?.id;
  if (active === 'tab-indicators') { R.renderInstrumentList(); A.renderSelectedChart(); }
  if (active === 'tab-newsroom') R.renderNewsroom();
}

/* ---------------------------------------------------------------------
   이벤트 위임 — onclick 속성 없이 한 곳에서 처리
--------------------------------------------------------------------- */
function wireEvents() {
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-action], .nav-btn, .sub-tab-btn, .news-filter-btn, .insight-filter-btn, .range-btn, .scrap-btn, tr[data-idx], tr[data-id]');
    if (!t) return;

    if (t.classList.contains('nav-btn')) return switchTab(t.dataset.tab);
    if (t.classList.contains('sub-tab-btn')) return A.selectCategory(t.dataset.cat);
    if (t.classList.contains('news-filter-btn')) return A.filterNews(t.dataset.filter);
    if (t.classList.contains('insight-filter-btn')) return A.filterInsights(t.dataset.cat);
    if (t.classList.contains('range-btn')) return A.changeRange(t.dataset.range);
    if (t.classList.contains('scrap-btn')) { e.preventDefault(); e.stopPropagation(); return A.toggleScrap(t.dataset.title); }
    if (t.matches('tr[data-idx]') && t.closest('#inst-body')) return A.selectInstrument(Number(t.dataset.idx));
    if (t.matches('tr[data-id]') && t.closest('#board-body')) return A.viewPost(Number(t.dataset.id));

    const act = t.dataset.action;
    if (act === 'refresh') return manualRefresh();
    if (act === 'edition-morning') return A.switchEdition('MORNING');
    if (act === 'edition-evening') return A.switchEdition('EVENING');
    if (act === 'toggle-edit') return A.toggleEditBriefing();
    if (act === 'copy-kakao') return A.copyKakaoBriefing();
    if (act === 'print-report') return A.printReport();
    if (act === 'load-more-news') return A.loadMoreNews();
    if (act === 'toggle-write') return $('board-write-form').classList.toggle('open');
    if (act === 'save-post') return A.savePost();
    if (act === 'cancel-write') return $('board-write-form').classList.remove('open');
    if (act === 'delete-post') return A.deletePost(Number(t.dataset.id));
  });

  // 뉴스 기사 클릭 → 클릭 기록(Top5 랭킹용)만 비동기로 남기고 새 탭 이동은 그대로 허용
  document.addEventListener('click', (e) => {
    const row = e.target.closest('.news-row');
    if (row && !e.target.closest('.scrap-btn')) A.recordClick(row.dataset.title);
  });

  $('news-search')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') A.searchNews(e.target.value);
  });
  $('btn-search-news')?.addEventListener('click', () => A.searchNews($('news-search').value));
}

async function manualRefresh() {
  const btn = $('btn-refresh');
  if (btn) { btn.disabled = true; btn.textContent = '동기화 확인중…'; }
  await loadAllData();
  renderAll();
  if (btn) { btn.disabled = false; btn.textContent = '동기화 새로고침'; }
}

/* ---------------------------------------------------------------------
   부트스트랩
--------------------------------------------------------------------- */
async function init() {
  $('footer-year').textContent = new Date().getFullYear();
  buildSubTabs();
  buildNewsFilters();
  buildInsightFilters();
  wireEvents();

  await loadAllData();
  renderAll();

  const lastTab = sessionStorage.getItem('hana_fo_tab');
  switchTab(lastTab || 'tab-dashboard');

  setInterval(async () => { await loadAllData(); renderAll(); }, POLL_MS);
}

init();
