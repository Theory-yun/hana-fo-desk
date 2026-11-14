import { STATE, CATEGORIES, CATEGORY_LABELS, DEFAULT_MACRO_EVENTS, findQuote, freshness } from './state.js';

const $ = (id) => document.getElementById(id);
const fmt = (n, dec = 2) => (n == null ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }));
const pct = (n) => (n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`);
const dirClass = (n) => (n == null ? 'flat' : n >= 0 ? 'up' : 'down');
const arrow = (n) => (n == null ? '' : n >= 0 ? '▲' : '▼');

export function renderSyncBadge() {
  const pill = $('sync-pill');
  const label = $('sync-label');
  if (!pill || !label) return;
  const state = freshness();
  pill.classList.remove('is-stale', 'is-down');
  if (state === 'live') {
    const t = new Date(STATE.market.generatedAt);
    label.textContent = `실시간 동기화 · ${t.toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })} 기준`;
  } else if (state === 'stale') {
    pill.classList.add('is-stale');
    const t = new Date(STATE.market.generatedAt);
    label.textContent = `동기화 지연 · 최종 ${t.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}`;
  } else {
    pill.classList.add('is-down');
    label.textContent = STATE.lastSyncOk === false ? 'data/market.json 로딩 실패' : '수집 이력 없음 — 최초 동기화 대기중';
  }
}

export function renderTicker() {
  const track = $('ticker-track');
  if (!track || !STATE.market) return;
  const list = STATE.market.coreSix || [];
  const build = (q) => `
    <span class="ticker-item">
      <span>${q.name}</span>
      <strong class="${dirClass(q.pct)}">${fmt(q.price)}</strong>
      <span class="${dirClass(q.pct)}">${arrow(q.pct)} ${pct(q.pct)}</span>
    </span>`;
  const once = list.map(build).join('');
  track.innerHTML = once + once; // 자연스러운 무한 루프를 위해 2배 복제
}

export function renderCoreSix() {
  const grid = $('core-grid');
  if (!grid || !STATE.market) return;
  grid.innerHTML = (STATE.market.coreSix || []).map((q) => `
    <div class="core-cell ${dirClass(q.pct) === 'up' ? 'is-up' : dirClass(q.pct) === 'down' ? 'is-down' : ''}">
      <div class="core-name">${q.name}</div>
      <div class="core-price tabular">${fmt(q.price)}</div>
      <div class="core-delta tabular ${dirClass(q.pct)}">${arrow(q.pct)} ${fmt(Math.abs(q.diff ?? 0))} (${pct(q.pct)})</div>
    </div>
  `).join('');
}

/* ---------------------------------------------------------------------
   에디션(모닝/이브닝) 이슈 — 실제 수집된 뉴스를 근거로 동적으로 구성한다.
   (예전 버전처럼 날짜별로 손으로 바꿔 끼우는 하드코딩 텍스트가 아님)
--------------------------------------------------------------------- */
function buildIssues() {
  const isMorning = STATE.edition === 'MORNING';
  const pool = isMorning
    ? STATE.news.filter((n) => n.tags.includes('매크로') || n.tags.includes('외환') || n.tags.includes('대체투자'))
    : STATE.news.filter((n) => n.tags.includes('매크로') || n.tags.includes('TAX') || n.tags.includes('부동산'));
  const top3 = (pool.length ? pool : STATE.news).slice(0, 3);
  if (!top3.length) {
    return [{ tagline: '수집 대기중', title: '아직 뉴스가 동기화되지 않았습니다', desc: 'GitHub Actions가 최초 실행되면 실제 기사 제목으로 자동 채워집니다.' }];
  }
  return top3.map((n) => ({
    tagline: `${n.tags.join(' · ')} · ${n.press}`,
    title: n.title,
    desc: `원문 출고: ${new Date(n.timestamp).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })} (${n.press})`
  }));
}

function buildBriefing() {
  const q = (sym) => findQuote(sym) || {};
  const ks = q('^KS11'), kq = q('^KQ11'), sp = q('^GSPC'), nd = q('^IXIC'), sox = q('^SOX'), fx = q('KRW=X');
  if (STATE.edition === 'MORNING') {
    return `[글로벌 모닝 종합] 간밤 미국 증시는 S&P 500 ${fmt(sp.price)}(${pct(sp.pct)}), 나스닥 ${fmt(nd.price)}(${pct(nd.pct)}), 필라델피아 반도체 ${fmt(sox.price)}(${pct(sox.pct)})로 마감했습니다. 원/달러 환율은 ${fmt(fx.price)}원(${pct(fx.pct)})을 기록했습니다. 직전 국내 증시는 코스피 ${fmt(ks.price)}(${pct(ks.pct)}), 코스닥 ${fmt(kq.price)}(${pct(kq.pct)})였던 만큼, 금일 장에서는 간밤 글로벌 변동성을 반영한 선별 대응을 제안합니다.`;
  }
  return `[대한민국 이브닝 종합] 국내 증시는 코스피 ${fmt(ks.price)}(${pct(ks.pct)}), 코스닥 ${fmt(kq.price)}(${pct(kq.pct)})로 마감했으며, 원/달러 환율은 ${fmt(fx.price)}원(${pct(fx.pct)})입니다. 연말 배당·자사주 소각 밸류업 테마와 손님별 가업승계·절세 플랜 점검을 함께 안내드리기를 권고드립니다.`;
}

export function renderEdition() {
  $('btn-ed-morning')?.classList.toggle('active', STATE.edition === 'MORNING');
  $('btn-ed-evening')?.classList.toggle('active', STATE.edition === 'EVENING');
  $('edition-heading').textContent = STATE.edition === 'MORNING'
    ? '간밤의 글로벌 핵심 이슈'
    : '당일 대한민국 핵심 이슈';

  const issues = buildIssues();
  $('issue-list').innerHTML = issues.map((iss, i) => `
    <div class="issue-row">
      <div class="issue-num serif">${i + 1}</div>
      <div class="issue-body">
        <div class="issue-tagline">${iss.tagline}</div>
        <div class="issue-title">${iss.title}</div>
        <div class="issue-desc">${iss.desc}</div>
      </div>
    </div>
  `).join('');

  const briefingBox = $('briefing-text');
  if (briefingBox && briefingBox.getAttribute('contenteditable') !== 'true') {
    briefingBox.textContent = buildBriefing();
  } else if (briefingBox && !briefingBox.textContent.trim()) {
    briefingBox.textContent = buildBriefing();
  }
}

export function getTop5News() {
  const scored = STATE.news.map((n) => {
    const clicks = STATE.clickMap[n.title] || 0;
    const ageHr = (Date.now() - n.timestamp) / 3600000;
    const recencyScore = Math.max(0, 48 - ageHr);
    return { ...n, score: clicks * 20 + recencyScore };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, 5);
}

export function renderTop5() {
  const box = $('top5-list');
  if (!box) return;
  const list = getTop5News();
  if (!list.length) {
    box.innerHTML = `<div style="padding:24px 20px; color:var(--ink-faint); font-size:13px;">뉴스 수집 대기중입니다. data/news.json 최초 동기화 후 자동으로 채워집니다.</div>`;
    return;
  }
  box.innerHTML = list.map((n, i) => newsRowHtml(n, i + 1, true)).join('');
}

function newsRowHtml(n, rank, showRank) {
  const tags = n.tags.map((t) => `<span class="tag ${tagClass(t)}">${t}</span>`).join('');
  const scrapped = !!STATE.scrapMap[n.title];
  const rel = relTime(n.timestamp);
  return `
    <a href="${n.url}" target="_blank" rel="noopener noreferrer" class="news-row" data-title="${escapeAttr(n.title)}">
      ${showRank ? `<span class="news-rank">${rank}</span>` : ''}
      <div class="news-main">
        <div class="news-tags">${tags}<span style="font-size:11px; font-weight:700; color: var(--pine);">${n.press}</span></div>
        <div class="news-title">${n.title}</div>
        <div class="news-meta">${rel} · 원문 출고 ${new Date(n.timestamp).toLocaleDateString('ko-KR')}</div>
      </div>
      <div class="news-actions no-print">
        <button type="button" class="btn-chip scrap-btn ${scrapped ? 'on' : ''}" data-title="${escapeAttr(n.title)}">${scrapped ? '★' : '☆'}</button>
      </div>
    </a>`;
}

function tagClass(t) {
  return { '매크로': 'tag-macro', TAX: 'tag-tax', '부동산': 'tag-estate', '외환': 'tag-forex', '대체투자': 'tag-alt' }[t] || 'tag-macro';
}
function relTime(ts) {
  const min = Math.floor((Date.now() - ts) / 60000);
  if (min < 60) return `${Math.max(1, min)}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  return `${Math.floor(hr / 24)}일 전`;
}
function escapeAttr(s) { return String(s).replace(/"/g, '&quot;'); }

export function renderCalendar() {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth(), today = now.getDate();
  $('cal-title').textContent = `${y}년 ${m + 1}월 매크로 캘린더`;

  const firstDow = new Date(y, m, 1).getDay();
  const lastDate = new Date(y, m + 1, 0).getDate();
  const prevLast = new Date(y, m, 0).getDate();
  let html = '';
  for (let i = firstDow - 1; i >= 0; i--) html += `<div class="cal-cell muted"><div class="cal-num">${prevLast - i}</div></div>`;
  for (let d = 1; d <= lastDate; d++) {
    const evs = DEFAULT_MACRO_EVENTS.filter((e) => e.day === d)
      .map((e) => `<span class="cal-tag ${e.type}" style="background:var(--pine-soft); color:var(--pine);">${e.tag}</span>`).join('');
    html += `<div class="cal-cell ${d === today ? 'today' : ''}"><div class="cal-num">${d}</div>${evs}</div>`;
  }
  const rem = (7 - ((firstDow + lastDate) % 7)) % 7;
  for (let n = 1; n <= rem; n++) html += `<div class="cal-cell muted"><div class="cal-num">${n}</div></div>`;
  $('cal-grid').innerHTML = html;

  $('event-list').innerHTML = DEFAULT_MACRO_EVENTS.map((ev) => `
    <div class="event-row">
      <span class="event-date">${String(m + 1).padStart(2, '0')}.${String(ev.day).padStart(2, '0')}</span>
      <span class="tag tag-macro">${ev.tag}</span>
      <span style="flex:1; font-weight:600;">${ev.title}</span>
    </div>`).join('');
}

/* ---------------------------------------------------------------------
   탭2 — 지표 리스트 + 차트
--------------------------------------------------------------------- */
export function renderInstrumentList() {
  const body = $('inst-body');
  if (!body || !STATE.market) return;
  const list = STATE.market.categories[STATE.category] || [];
  body.innerHTML = list.map((item, idx) => `
    <tr class="${idx === STATE.symbolIdx ? 'selected' : ''}" data-idx="${idx}">
      <td>${item.name}<br><span style="font-size:11px; color:var(--ink-faint);">${item.sub || ''}</span></td>
      <td class="num-cell tabular">${fmt(item.price, item.suffix ? 2 : (item.price > 1000 ? 2 : 4))}${item.suffix || ''}</td>
      <td class="num-cell tabular ${dirClass(item.pct)}">${arrow(item.pct)} ${pct(item.pct)}</td>
    </tr>
  `).join('');
}

export function drawChart(series) {
  const box = $('chart-box');
  if (!box) return;
  if (!series || series.length < 2) {
    box.innerHTML = `<div style="height:100%; display:flex; align-items:center; justify-content:center; color:var(--ink-faint); font-size:13px;">이 구간의 시계열 데이터가 아직 없습니다 (다음 동기화 때 채워집니다)</div>`;
    return;
  }
  const vals = series.map((p) => p.v);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const up = vals.at(-1) >= vals[0];
  const color = up ? 'var(--rise)' : 'var(--fall)';
  const W = 800, H = 200, padX = 10, padY = 16;
  const coords = series.map((p, i) => {
    const x = padX + (i / (series.length - 1)) * (W - padX * 2);
    const yv = padY + (1 - (p.v - min) / range) * (H - padY * 2);
    return `${x.toFixed(1)},${yv.toFixed(1)}`;
  }).join(' ');
  box.innerHTML = `
    <svg viewBox="0 0 ${W} ${H + 18}" style="width:100%; height:100%;">
      <line x1="${padX}" y1="${H - padY}" x2="${W - padX}" y2="${H - padY}" stroke="#DEE4DD"/>
      <polyline fill="none" stroke="${color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" points="${coords}"/>
      <text x="${padX}" y="${padY}" fill="#8B968F" font-size="11">최고 ${max.toLocaleString('en-US', { maximumFractionDigits: 2 })}</text>
      <text x="${padX}" y="${H - padY + 12}" fill="#8B968F" font-size="11">최저 ${min.toLocaleString('en-US', { maximumFractionDigits: 2 })}</text>
    </svg>`;
}

export function renderChartHeader(item) {
  $('chart-title').textContent = item.name;
  $('chart-sub').textContent = item.sub || '';
  $('chart-price').textContent = fmt(item.price, item.price > 1000 ? 2 : 4);
  const el = $('chart-chg');
  el.textContent = `${arrow(item.pct)} ${pct(item.pct)}`;
  el.className = `chart-chg ${dirClass(item.pct)}`;
}

/* ---------------------------------------------------------------------
   뉴스룸
--------------------------------------------------------------------- */
export function getFilteredNews() {
  if (STATE.newsFilter === 'SCRAP') return Object.values(STATE.scrapMap).sort((a, b) => b.timestamp - a.timestamp);
  if (STATE.newsFilter === 'ALL') return STATE.news;
  return STATE.news.filter((n) => n.tags.includes(STATE.newsFilter));
}

export function renderNewsroom() {
  const box = $('newsroom-list');
  if (!box) return;
  $('scrap-count').textContent = Object.keys(STATE.scrapMap).length;
  const all = getFilteredNews();
  const visible = all.slice(0, STATE.newsCount);
  if (!visible.length) {
    box.innerHTML = `<div style="padding:40px 20px; text-align:center; color:var(--ink-faint); font-size:13px;">표시할 기사가 없습니다.</div>`;
  } else {
    box.innerHTML = visible.map((n) => newsRowHtml(n, 0, false)).join('');
  }
  $('news-count-info').textContent = `표시 ${visible.length}건 / 보유 ${all.length}건`;
  $('btn-load-more').style.display = visible.length < all.length ? 'inline-block' : 'none';
}

/* ---------------------------------------------------------------------
   F/O Insight
--------------------------------------------------------------------- */
export function renderInsights() {
  const tbody = $('insight-body');
  if (!tbody) return;
  const list = STATE.insightFilter && STATE.insightFilter !== 'ALL'
    ? STATE.insights.filter((r) => r.category === STATE.insightFilter)
    : STATE.insights;
  $('insight-total').textContent = STATE.insights.length;
  tbody.innerHTML = list.map((r) => `
    <tr>
      <td><span class="star">${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)}</span></td>
      <td><span class="tag ${r.category.includes('국내') ? 'tag-macro' : r.category.includes('글로벌') ? 'tag-forex' : 'tag-tax'}">${r.category}</span></td>
      <td><div style="font-weight:700; margin-bottom:3px;">${r.title}</div><div style="font-size:12px; color:var(--ink-soft);">${r.desc}</div></td>
      <td><strong style="color:var(--pine);">${r.org}</strong><br><span style="font-size:11px; color:var(--ink-faint);">${r.date}</span></td>
      <td><a class="btn-dl" href="${r.url}" target="_blank" rel="noopener noreferrer">원문 열기</a></td>
    </tr>
  `).join('');
}

/* ---------------------------------------------------------------------
   게시판
--------------------------------------------------------------------- */
export function renderBoard(posts) {
  const tbody = $('board-body');
  if (!tbody) return;
  tbody.innerHTML = posts.map((p) => `
    <tr data-id="${p.id}" style="cursor:pointer;">
      <td><span class="tag tag-macro">${p.category}</span></td>
      <td style="font-weight:600;">${p.title}</td>
      <td>${p.author}</td>
      <td style="color:var(--ink-faint);">${p.date}</td>
    </tr>
  `).join('');
}
