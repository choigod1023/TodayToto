# SportsToto Service Overview

## 목차

1. 소개
2. 주요 기능
3. 아키텍처 / 폴더 가이드
4. 실행 방법
5. 환경 변수
6. API 개요와 샘플
7. 분석/예측 로직 (Gemini 가드레일)
8. 적중 판정/표시
9. 예측 방식 발전 히스토리

---

## 1. 소개

스포츠 경기 데이터를 수집해 인기 경기 리스트와 상세 정보를 제공하고, Gemini를 활용해 승/무/패·언더/오버·핸디캡 분석과 추천 픽(primaryPick)을 산출하는 서비스입니다. 적중 여부를 서버에서 판정해 프론트에 표시하며, 무승부/대체 마켓을 고려한 보수적 프롬프트 가드레일을 적용합니다.

## 2. 주요 기능

- 인기 경기 + 추천픽: `GET /games/popular-with-pick?date=YYYY-MM-DD&tomorrowFlag=true|false`
- 경기 상세: `GET /games/:gameId?sportsType=&scoreHome=&scoreAway=&gameStatus=&result=`
- Gemini 분석: `POST /games/:gameId/analysis` (동일한 쿼리 파라미터로 스코어/상태 전달 가능)
- 프론트 페이지
  - `/games`: 인기 경기 목록, 추천 픽/적중 여부(배경색), 스코어/상태 표시
  - `/games/[gameId]`: 상세 전력/배당/순위·스탯/선수 스탯 + Gemini 요약, 적중 하이라이트

## 3. 아키텍처 / 폴더 가이드

- 백엔드 (NestJS, Mongoose) `backend/src`
  - `games/*`: popular-with-pick, 경기 상세, 외부 API fetch, 스코어 합산
  - `analysis/*`: Gemini 호출, 프롬프트, 적중 판정
  - `config/*`: 환경 설정
- 프론트 (Next.js App Router) `backend/frontend/src`
  - `app/games/page.tsx`: 인기 경기 목록
  - `app/games/[gameId]/page.tsx`: 경기 상세
  - `components/games/*`: UI 컴포넌트 모듈화
  - `lib/*`: 적중/상태 유틸(`gameHitUtils`), 플레이어 스탯 유틸(`playerStats`), API 호출 유틸(`gameApi`)

## 4. 실행 방법

```bash
# 백엔드
cd backend
npm install
npm run start:dev

# 프론트
cd backend/frontend
npm install
npm run dev
```

기본 포트: 백엔드 3001, 프론트 3000 (Next dev).

## 5. 환경 변수

- `GEMINI_API_KEY` (필수): Gemini 호출 키
- `SPORTS_API_BASE` (기본 `https://sports-api.named.net/v1.0`)
- `CHALLENGER_API_BASE`
- `MONGODB_URI`
- `GEMINI_MODEL` (옵션, 기본 `gemini-1.5-pro`)

## 6. API 개요와 샘플

- 인기 경기 + 추천픽
  - `GET /games/popular-with-pick?date=2025-12-09&tomorrowFlag=false`
  - 응답 예: `games[].primaryPick`, `games[].hitStatus`, `score`, `gameStatus`, `result`
- 경기 상세
  - `GET /games/:gameId?sportsType=soccer&scoreHome=1&scoreAway=2&gameStatus=FINAL`
  - 응답: 기본 정보, odds, record(맞대결/최근전적), rank/season/player 스탯, score/status/result
- 분석 요청
  - `POST /games/:gameId/analysis?sportsType=soccer&scoreHome=1&scoreAway=2&gameStatus=FINAL`
  - body 예: `{ "markets": { "fullTime1x2": true, "overUnder": true, "handicap": true } }`
  - 결과: `result.primaryPick`, 서브 마켓 확률, `hitStatus`

## 7. 분석/예측 로직 (Gemini 프롬프트 가드레일)

- 무승부 보강: 접전/수비전/로테이션 시 DRAW 확률 유지, 승패 확신 낮으면 무승부 우선
- 리그/스포츠별 총점 기준: 농구(페이스/평균 득점), 배구(세트 득점 분포), 축구(평균 득점/실점)로 오버/언더 확신 제한, 기준선 편차 크면 보수 조정
- 최근 폼·부상·피로: 최근 3~5경기, 핵심 부상/결장, 연전/원정 피로 반영
- 기상/원정 이동: 더위·습도·추위·고도, 이동거리/표면 불리 시 확률 하향 및 대체 마켓 전환
- 대체 마켓 전환: 승/패 확신 낮거나 배당 과소 시 무승부/언더/핸디로 피벗, 근거 요약

## 8. 적중 판정/표시

- 백엔드 `AnalysisService`가 primaryPick 기준 `hit/miss/neutral` 계산
- 스코어/상태 쿼리로 전달 시 재계산 가능
- 프론트 카드 배경: hit=초록, miss=빨강, neutral=슬레이트
- 상세 페이지도 동일 하이라이트 적용

## 9. 예측 방식 발전 히스토리

1. 기본 추천: 승/무/패, 언더/오버, 핸디캡 확률 + primaryPick
2. 적중 판정: 스코어/상태 기반 hit/miss/neutral 계산 후 응답/표시
3. 리스트 노출: popular-with-pick에서 추천 픽·적중·스코어/상태를 함께 반환
4. 프롬프트 강화: 무승부 보강, 리그별 총점 기준, 폼/부상/피로, 기상/원정, 대체 마켓 전환 조건을 체크리스트화해 과확신 억제
5. UI 하이라이트: 카드 배경 색상으로 적중 시각화, 상태 한글화, 스코어 전달·연동
