/**
 * shared/symbols.mjs
 * ------------------------------------------------------------------
 * 브라우저(assets/js)와 Node 수집 스크립트(scripts/fetch-market-data.mjs)가
 * 함께 읽는 "단일 진실 공급원(single source of truth)".
 * 여기서 종목을 추가/삭제하면 수집 스크립트와 화면이 동시에 반영됩니다.
 *
 * ESM이라 Node(수집 스크립트)와 <script type="module"> 양쪽에서 그대로 import 가능.
 * ------------------------------------------------------------------ */

// 대시보드 상단 6대 핵심 지표 (Yahoo Finance 심볼 기준)
export const CORE_SIX = [
  { symbol: '^KS11', source: 'naver-domestic', naverCode: 'KOSPI', name: '코스피', isGlobal: false },
  { symbol: '^KQ11', source: 'naver-domestic', naverCode: 'KOSDAQ', name: '코스닥', isGlobal: false },
  { symbol: '^GSPC', source: 'yahoo', name: 'S&P 500', isGlobal: true },
  { symbol: '^IXIC', source: 'yahoo', name: '나스닥 종합', isGlobal: true },
  { symbol: '^SOX', source: 'yahoo', name: '필라델피아 반도체', isGlobal: true },
  { symbol: 'KRW=X', source: 'yahoo', name: '원/달러 환율', isGlobal: false }
];

// 탭2 "주요 지표" 6개 자산군 × 종목
export const CATEGORIES = {
  indices: [
    { symbol: '^KS11', name: 'KOSPI', sub: '한국 종합주가지수' },
    { symbol: '^KQ11', name: 'KOSDAQ', sub: '한국 코스닥지수' },
    { symbol: '^GSPC', name: 'S&P 500', sub: '미국 대형주 500 지수' },
    { symbol: '^IXIC', name: '나스닥 종합', sub: '미국 기술주 중심 지수' },
    { symbol: '^DJI', name: '다우존스 30', sub: '미국 우량 산업주 30' },
    { symbol: '^SOX', name: '필라델피아 반도체', sub: '글로벌 반도체 핵심 지수' },
    { symbol: '^RUT', name: '러셀 2000', sub: '미국 중소형주 대표 지수' },
    { symbol: '^N225', name: '닛케이 225', sub: '일본 도쿄증시 대표 지수' },
    { symbol: '^HSI', name: '홍콩 항셍지수', sub: '홍콩 증시 대표 지수' }
  ],
  commodities: [
    { symbol: 'GC=F', name: '국제 금(Gold)', sub: 'COMEX 금 선물 ($/oz)' },
    { symbol: 'SI=F', name: '국제 은(Silver)', sub: 'COMEX 은 선물 ($/oz)' },
    { symbol: 'CL=F', name: 'WTI 원유', sub: '서부텍사스산 원유 ($/배럴)' },
    { symbol: 'BZ=F', name: '브렌트유', sub: '북해산 브렌트 원유 ($/배럴)' },
    { symbol: 'HG=F', name: '구리(Copper)', sub: '글로벌 경기 선행 원자재' },
    { symbol: 'NG=F', name: '천연가스', sub: 'NYMEX 천연가스 선물' }
  ],
  forex: [
    { symbol: 'KRW=X', name: '달러/원', sub: '1미국 달러당 원화 환율' },
    { symbol: 'JPY=X', name: '달러/엔', sub: '1미국 달러당 일본 엔화' },
    { symbol: 'EURUSD=X', name: '유로/달러', sub: '1유로당 미국 달러' },
    { symbol: 'EURKRW=X', name: '유로/원', sub: '1유로당 원화 환율' },
    { symbol: 'CNYKRW=X', name: '위안/원', sub: '1중국 위안당 원화 환율' },
    { symbol: 'GBPUSD=X', name: '파운드/달러', sub: '1영국 파운드당 미국 달러' }
  ],
  crypto: [
    { symbol: 'BTC-USD', name: '비트코인', sub: '가상자산 대장주 ($)' },
    { symbol: 'ETH-USD', name: '이더리움', sub: '스마트 컨트랙트 대표 ($)' },
    { symbol: 'XRP-USD', name: '리플', sub: '글로벌 송금 네트워크 ($)' },
    { symbol: 'SOL-USD', name: '솔라나', sub: '고성능 레이어1 블록체인 ($)' }
  ],
  bonds: [
    { symbol: '^TNX', name: '미국채 10년물 금리', sub: '글로벌 장기 벤치마크 금리(%)', suffix: '%' },
    { symbol: '^TYX', name: '미국채 30년물 금리', sub: '미국 초장기 국채 수익률(%)', suffix: '%' },
    { symbol: '^FVX', name: '미국채 5년물 금리', sub: '미국 중기 국채 수익률(%)', suffix: '%' },
    { symbol: 'TLT', name: '미국 20년+ 장기국채(TLT)', sub: '장기채 가격 추종 대표 ETF ($)' },
    { symbol: 'LQD', name: '미국 투자등급 회사채(LQD)', sub: '우량 기업 회사채 벤치마크 ($)' },
    { symbol: 'HYG', name: '미국 하이일드 채권(HYG)', sub: '고수익 회사채 크레딧 지표 ($)' }
  ]
};

export const CATEGORY_LABELS = {
  indices: '주요지수',
  commodities: '원자재',
  forex: '외환',
  crypto: '암호화폐',
  bonds: '채권'
};

// 뉴스 카테고리 분류 규칙 (수집 스크립트가 Google News RSS 쿼리로도 사용)
export const NEWS_CATEGORY_RULES = [
  { cat: '매크로', query: '뉴욕증시 OR 연준 금리 OR 코스피 기관 OR 한국은행', keywords: ['금리', '연준', 'FOMC', '파월', '국채', '물가', 'CPI', '통화정책', '한국은행', '코스피', '순매수', '증시', '뉴욕증시', '나스닥'] },
  { cat: 'TAX', query: '패밀리오피스 OR 가업상속공제 OR 상속세 OR 증여세 OR 유언대용신탁', keywords: ['세무', '세제', '상속', '증여', '가업승계', '가업상속', '패밀리오피스', '유언대용신탁', '신탁', '절세', '비상장', '배당'] },
  { cat: '부동산', query: '상업용 빌딩 OR 종합부동산세 OR 토지거래허가구역 OR 재건축', keywords: ['부동산', '빌딩', '종부세', '종합부동산세', '토지거래', '재건축', '아파트', '상업용', '오피스', '꼬마빌딩'] },
  { cat: '외환', query: '원달러 환율 OR 달러 인덱스 OR 엔달러 환율 OR 외환시장', keywords: ['환율', '원/달러', '원달러', '달러', '엔화', '유로', '위안', '외환', '환헤지', '네고'] },
  { cat: '대체투자', query: '국제유가 OR 국제 금값 OR 비트코인 ETF OR 사모펀드 PEF', keywords: ['금값', '금 시세', '원유', '유가', 'WTI', '브렌트유', '구리', '원자재', '비트코인', '가상자산', '사모펀드', 'PEF', '대체투자'] }
];

// 언론사 직접 RSS (CORS와 무관 — 수집 스크립트가 서버에서 읽음)
export const DIRECT_RSS_FEEDS = [
  { url: 'https://www.hankyung.com/feed/economy', press: '한국경제', cat: '매크로' },
  { url: 'https://www.hankyung.com/feed/realestate', press: '한국경제', cat: '부동산' },
  { url: 'https://www.mk.co.kr/rss/30100041/', press: '매일경제', cat: '매크로' },
  { url: 'https://www.yna.co.kr/rss/economy.xml', press: '연합뉴스', cat: '매크로' },
  { url: 'https://www.fnnews.com/rss/r20/fn_realnews_economy.xml', press: '파이낸셜뉴스', cat: '매크로' }
];

// 이달의 매크로 캘린더 — PB가 월초에 한 번 손으로 갱신하는 정적 데이터 (data/calendar.json로 분리 관리 권장)
export const DEFAULT_MACRO_EVENTS = [
  { day: 3, type: 'ev-macro', tag: '빅이벤트', title: '미국 중간선거 실시 및 미 ISM 제조업 지표 점검' },
  { day: 6, type: 'ev-macro', tag: '고용지표', title: '미국 10월 비농업 고용보고서 발표' },
  { day: 7, type: 'ev-macro', tag: '통화정책', title: '미 연준(Fed) FOMC 기준금리 결정 회의' },
  { day: 13, type: 'ev-macro', tag: '물가지표', title: '미국 소비자물가지수(CPI) 발표' },
  { day: 19, type: 'ev-fo', tag: 'F/O전략', title: '패밀리오피스 글로벌 자산배분 리밸런싱 데이' },
  { day: 25, type: 'ev-tax', tag: '절세체크', title: '연말 대주주 양도세 및 배당 플랜 사전 점검' },
  { day: 27, type: 'ev-macro', tag: '통화정책', title: '한국은행 금융통화위원회 기준금리 결정' }
];
