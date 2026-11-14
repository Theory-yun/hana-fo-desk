# HANA Family Office · WM Research Desk (v2)

패밀리오피스 PB를 위한 데일리 마켓 브리핑 포털. **데이터 수집을 서버(GitHub Actions)로 옮긴 것**이 이번 재설계의 핵심입니다.

## 왜 다시 짰는가 — 구조가 바뀐 지점

| | v1 (기존) | v2 (이 저장소) |
|---|---|---|
| 시세/뉴스 수집 위치 | **브라우저**가 매 요청마다 corsproxy.io 등 공개 프록시를 거쳐 직접 호출 | **GitHub Actions**가 10분마다 서버에서 직접 수집 |
| CORS | 매번 프록시 가용성에 좌우됨 (corsproxy.io는 현재 운영 도메인에서 API 키 없이 사실상 차단) | 애초에 발생하지 않음 (서버→서버 호출) |
| 실패 시 동작 | 조용히 `null` 반환, 화면은 "동기화 완료" 배지를 띄운 채 구 데이터 유지 | 상단 배지가 `data/market.json`의 `generatedAt` 나이를 보고 live/지연/실패를 있는 그대로 표시 |
| 장애 영향 범위 | 접속자 수만큼 프록시에 부하, 실패도 접속자마다 다름 | 수집 1회 실패해도 마지막 성공 데이터가 레포에 그대로 남아 화면이 깨지지 않음 |

## 폴더 구조

```
.
├── .github/workflows/sync-data.yml   # 10분마다 자동 실행되는 수집 파이프라인
├── scripts/fetch-market-data.mjs     # 실제 수집 로직 (Node, 외부 의존성 0)
├── shared/symbols.mjs                # 종목/카테고리/뉴스 소스 정의 (서버·클라이언트 공용)
├── data/                             # 수집 결과(JSON) — Action이 주기적으로 덮어씀
│   ├── market.json
│   ├── news.json
│   └── insights.json                 # F/O 리포트 아카이브 (PB가 직접 편집)
├── index.html
└── assets/
    ├── css/style.css
    └── js/{state,render,actions,app}.js
```

## 배포 방법 (GitHub Pages)

1. 이 폴더 전체를 새 GitHub 저장소에 푸시합니다.
2. **Settings → Actions → General → Workflow permissions**에서
   `Read and write permissions`를 선택합니다. (Action이 `data/*.json`을 커밋하려면 필요합니다.)
3. **Actions** 탭 → `Sync Market Data` → `Run workflow`로 최초 1회 수동 실행합니다.
   (스케줄은 이후부터 10분 간격으로 자동 실행됩니다.)
4. **Settings → Pages**에서 Source를 `Deploy from a branch` → `main` / `/ (root)`로 지정합니다.
5. 몇 분 뒤 `https://<계정>.github.io/<저장소명>/`에서 접속해 상단 배지가
   `실시간 동기화 · HH:MM 기준`으로 바뀌는지 확인합니다.

## v1에서 의도적으로 뺀 기능과 그 이유

- **sedaily.com 정규식 스크래핑(등락종목수/수급)** — 언론사 홈페이지 레이아웃에 의존해 구조가
  바뀌면 조용히 깨지는 코드였습니다. 공식 API가 없는 한 신뢰성 있게 유지보수하기 어려워 제외했습니다.
  필요하시면 KRX 정보데이터시스템 공식 API로 교체하는 것을 권장합니다.
- **F/O Insight 탭의 "실시간 리포트 수집" 버튼** — 브라우저에서 즉석으로 Google News를 긁던
  기능이라 프록시 없이는 동작할 수 없었습니다. 대신 `data/insights.json`을 PB가 직접
  편집하는 큐레이션 목록으로 바꿨습니다(네트워크 호출 없음, 가장 안정적인 방식).
- **PDF 생성 라이브러리(html2pdf.js) 의존** — 브라우저 내장 인쇄(`window.print`) + 전용
  인쇄 스타일시트로 대체했습니다. CDN 장애에 영향받지 않고, "인쇄 → PDF로 저장"은
  모든 브라우저가 기본 지원합니다.

## 종목/뉴스 소스 추가하기

`shared/symbols.mjs` 한 파일만 수정하면 됩니다. 서버 수집 스크립트와 화면이 같은 파일을
import하므로 두 곳을 따로 고칠 필요가 없습니다.

## 로컬에서 수집 스크립트만 테스트하기

```bash
node scripts/fetch-market-data.mjs
# data/market.json, data/news.json 이 즉시 갱신됩니다.
```
