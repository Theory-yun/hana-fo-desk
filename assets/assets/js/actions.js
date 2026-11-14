import { STATE, saveScrap, saveClicks, getBoardPosts, setBoardPosts, findQuote } from './state.js';
import * as R from './render.js';

const $ = (id) => document.getElementById(id);

export function toggleScrap(title) {
  const fromPool = STATE.news.find((n) => n.title === title) || Object.values(STATE.scrapMap).find((n) => n.title === title);
  if (!fromPool) return;
  if (STATE.scrapMap[title]) delete STATE.scrapMap[title];
  else STATE.scrapMap[title] = fromPool;
  saveScrap();
  R.renderNewsroom();
  R.renderTop5();
}

export function recordClick(title) {
  STATE.clickMap[title] = (STATE.clickMap[title] || 0) + 1;
  saveClicks();
  R.renderTop5();
}

export function switchEdition(key) {
  STATE.edition = key;
  R.renderEdition();
}

export function toggleEditBriefing() {
  STATE.isEditing = !STATE.isEditing;
  const btn = $('btn-edit-briefing');
  document.querySelectorAll('.editable').forEach((el) => {
    el.contentEditable = STATE.isEditing ? 'true' : 'false';
  });
  if (btn) btn.textContent = STATE.isEditing ? '편집 완료' : '문구 편집';
}

export function copyKakaoBriefing() {
  const q = (s) => findQuote(s) || {};
  const core = (STATE.market?.coreSix || []);
  const lines = core.map((c) => {
    const sign = c.pct >= 0 ? '+' : '';
    return `${c.pct >= 0 ? '📈' : '📉'} ${c.name}: ${c.price?.toLocaleString('en-US', { maximumFractionDigits: 2 })} (${sign}${c.pct?.toFixed(2)}%)`;
  }).join('\n');
  const top5 = R.getTop5News().map((n, i) => `${i + 1}. ${n.title} (${n.press})\n   ${n.url}`).join('\n');
  const briefing = $('briefing-text')?.textContent.trim() || '';
  const asOf = STATE.market?.generatedAt ? new Date(STATE.market.generatedAt).toLocaleString('ko-KR') : '동기화 대기중';

  const msg = `[HANA Family Office 마켓 브리핑]\n기준: ${asOf}\n\n■ 주요 지표\n${lines}\n\n■ 브리핑 요약\n${briefing}\n\n■ 주요 뉴스\n${top5}`;
  navigator.clipboard.writeText(msg).then(() => alert('손님 전달용 브리핑이 클립보드에 복사되었습니다.'));
}

export function printReport() {
  document.querySelectorAll('.tab-section').forEach((s) => s.classList.remove('print-target'));
  $('tab-dashboard')?.classList.add('print-target');
  window.print();
}

/* ---------------------------------------------------------------------
   탭2 — 지표
--------------------------------------------------------------------- */
export function selectCategory(key) {
  STATE.category = key;
  STATE.symbolIdx = 0;
  document.querySelectorAll('.sub-tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.cat === key));
  R.renderInstrumentList();
  renderSelectedChart();
}

export function selectInstrument(idx) {
  STATE.symbolIdx = idx;
  R.renderInstrumentList();
  renderSelectedChart();
}

export function renderSelectedChart() {
  const list = STATE.market?.categories?.[STATE.category] || [];
  const item = list[STATE.symbolIdx];
  if (!item) return;
  R.renderChartHeader(item);
  const series = STATE.rangeKey === '1Y' ? (item.series1y || []) : (item.series || []);
  R.drawChart(series);
}

export function changeRange(key) {
  STATE.rangeKey = key;
  document.querySelectorAll('.range-btn').forEach((b) => b.classList.toggle('active', b.dataset.range === key));
  renderSelectedChart();
}

/* ---------------------------------------------------------------------
   뉴스룸
--------------------------------------------------------------------- */
export function filterNews(key) {
  STATE.newsFilter = key;
  STATE.newsCount = 12;
  document.querySelectorAll('.news-filter-btn').forEach((b) => b.classList.toggle('active', b.dataset.filter === key));
  R.renderNewsroom();
}
export function loadMoreNews() {
  STATE.newsCount += 12;
  R.renderNewsroom();
}
export function searchNews(keyword) {
  if (!keyword.trim()) return;
  STATE.newsFilter = 'ALL';
  STATE.newsCount = 12;
  document.querySelectorAll('.news-filter-btn').forEach((b) => b.classList.toggle('active', b.dataset.filter === 'ALL'));
  const kw = keyword.trim();
  STATE.news.sort((a, b) => (b.title.includes(kw) ? 1 : 0) - (a.title.includes(kw) ? 1 : 0) || b.timestamp - a.timestamp);
  R.renderNewsroom();
}

/* ---------------------------------------------------------------------
   F/O Insight
--------------------------------------------------------------------- */
export function filterInsights(cat) {
  STATE.insightFilter = cat;
  document.querySelectorAll('.insight-filter-btn').forEach((b) => b.classList.toggle('active', b.dataset.cat === cat));
  R.renderInsights();
}

/* ---------------------------------------------------------------------
   게시판
--------------------------------------------------------------------- */
export function savePost() {
  const category = $('post-category').value;
  const author = $('post-author').value.trim() || 'F/O 본사';
  const title = $('post-title').value.trim();
  const content = $('post-content').value.trim();
  if (!title || !content) return alert('제목과 내용을 입력해 주세요.');
  const posts = getBoardPosts();
  posts.unshift({ id: Date.now(), category, title, author, date: new Date().toISOString().slice(0, 10).replace(/-/g, '.'), content });
  setBoardPosts(posts);
  $('post-title').value = '';
  $('post-content').value = '';
  $('board-write-form').classList.remove('open');
  R.renderBoard(posts);
}

export function viewPost(id) {
  const post = getBoardPosts().find((p) => p.id === id);
  const box = $('board-detail');
  if (!post || !box) return;
  box.style.display = 'block';
  box.innerHTML = `
    <div class="panel panel-pad">
      <div class="row-between" style="margin-bottom:8px;">
        <span class="tag tag-macro">${post.category}</span>
        <span style="font-size:12px; color:var(--ink-faint);">${post.author} · ${post.date}</span>
      </div>
      <h3 class="serif" style="margin-bottom:10px;">${post.title}</h3>
      <p style="white-space:pre-wrap; line-height:1.6; margin-bottom:14px;">${post.content}</p>
      <button type="button" class="btn-secondary" data-action="delete-post" data-id="${post.id}">삭제</button>
    </div>`;
}

export function deletePost(id) {
  const posts = getBoardPosts().filter((p) => p.id !== id);
  setBoardPosts(posts);
  $('board-detail').style.display = 'none';
  R.renderBoard(posts);
}

