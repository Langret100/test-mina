# FCM 웹 푸시 알림 시스템

## 개요

앱이 완전히 꺼진 상태에서도 새 메시지가 오면 카톡처럼 시스템 알림이 울리고,
앱 아이콘 위에 빨간 배지(미확인 메시지 수)가 표시됩니다.

- **Android**: Chrome/Edge 등 모든 최신 브라우저 PWA 지원
- **iOS**: iOS 16.4 이상 + Safari로 홈화면 추가(PWA 설치) 필요

---

## 전체 흐름

```
[메시지 발신]
사용자 A가 메시지 전송
    │
    ├─ Firebase DB messages/global 저장 (실시간-챗)
    ├─ Apps Script 시트 백업 (postToSheet)
    └─ Apps Script FCM 발송 요청 (postToSheet mode=fcm_push)
            │
            │   Apps Script가 처리:
            │   1) Firebase DB /fcm_tokens 에서 해당 방 구독 토큰 수집
            │      (단, 현재 그 방 열고 있는 유저 = /fcm_active_room 제외)
            │   2) FCM HTTP v1 API로 각 토큰에 푸시 발송
            │
            ▼
    [수신자 기기 - 앱 꺼져 있어도]
    sw.js의 push 이벤트 수신
        │
        ├─ showNotification() → 시스템 알림 표시 + 소리
        ├─ setAppBadge(count) → 앱 아이콘 배지 업데이트
        └─ 알림 클릭 → 앱 열기 + 해당 방으로 이동
```

---

## 파일 구성

| 파일 | 역할 |
|------|------|
| `js/fcm-push.js` | FCM 토큰 발급, Firebase DB 저장, 방문 방 구독 관리 |
| `sw.js` | 푸시 수신, 알림 표시, 배지, 알림 클릭 처리 |
| `js/social-messenger.js` | 메시지 전송 시 Apps Script에 FCM 요청 (`__sendFcmPushNotify`) |
| `js/social-chat-firebase.js` | 소통 모드 메시지 전송 시 동일하게 FCM 요청 |
| `FIREBASE_RULES.json` | `fcm_tokens`, `fcm_active_room` 경로 권한 포함 |
| `FCM_PUSH_HANDLER.gs` | Apps Script FCM 발송 코드 |
| `.github/workflows/pages.yml` | `__FCM_VAPID_KEY__` 치환 포함 |

---

## Firebase DB 경로

| 경로 | 내용 | 보관 |
|------|------|------|
| `/fcm_tokens/{userId}` | FCM 토큰 + 구독 방 목록 | 30일 미접속 시 profile-manager가 삭제 |
| `/fcm_active_room/{userId}` | 현재 열고 있는 방 ID + 타임스탬프 | 30초 유효 (이후 무시) |

---

## 알림 제외 조건

다음 경우에는 FCM 푸시를 보내지 않습니다:

1. **발신자 본인** — 자기 메시지에 알림 없음
2. **해당 방을 방문한 적 없는 유저** — `ghostRoomVisited_v1` 기준
3. **현재 그 방을 열고 있는 유저** — `/fcm_active_room/{userId}`의 `room_id`가 일치하고 30초 이내인 경우

---

## 활성화 방법

### 1단계 — Firebase 설정

1. Firebase 콘솔 → 프로젝트 설정 → **클라우드 메시징**
2. 웹 푸시 인증서 → **키 쌍 생성** → VAPID 공개 키 복사
3. 서비스 계정 탭 → **새 비공개 키 생성** → JSON 다운로드
   - `client_email` → `FCM_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → `FCM_PRIVATE_KEY`

### 2단계 — GitHub Secrets 추가

저장소 Settings → Secrets and variables → Actions → New repository secret

| Secret 이름 | 값 |
|-------------|-----|
| `FCM_VAPID_KEY` | VAPID 공개 키 |

(기존 `FIREBASE_API_KEY`는 그대로 유지)

### 3단계 — Apps Script 설정

1. `FCM_PUSH_HANDLER.gs` 내용을 기존 Apps Script 프로젝트에 새 파일로 추가
2. 상단 변수 채우기:
   ```javascript
   var FCM_PROJECT_ID            = "web-ghost-c447b";        // 그대로
   var FCM_SERVICE_ACCOUNT_EMAIL = "xxx@xxx.iam.gserviceaccount.com"; // ← 교체
   var FCM_PRIVATE_KEY           = "-----BEGIN PRIVATE KEY-----\n..."; // ← 교체
   ```
3. 기존 라우터(`doPost`)에 분기 추가:
   ```javascript
   // doPost 함수 안 mode 분기에 추가
   else if (mode === "fcm_push") return handleFcmPush_(e);
   ```
4. **배포 → 배포 관리 → ✏️ → 새 버전 → 배포**

### 4단계 — Firebase Rules 교체

Firebase 콘솔 → Realtime Database → Rules → 동봉된 `FIREBASE_RULES.json` 내용으로 교체

### 5단계 — GitHub Push

GitHub에 push → Actions가 VAPID 키 치환 후 Pages 배포

---

## 제거 방법

FCM 알림을 완전히 제거하려면:

### js/fcm-push.js
- `index.html`에서 `<script src="js/fcm-push.js">` 제거
- `index.html`에서 `firebase-messaging-compat.js` 스크립트 제거
- `js/fcm-push.js` 파일 삭제

### sw.js
- `push` 이벤트 리스너 블록 제거 (`/* ════ FCM 푸시 메시지 수신 ════ */`)
- `notificationclick` 이벤트 리스너 제거

### js/social-messenger.js
- `__sendFcmPushNotify` 함수 본체 삭제
- `__patchSwitchRoomForFcm` 함수 삭제
- `sw.js에서 FCM 수신 시` 주석 블록 삭제
- 텍스트/이미지 전송 후 `__sendFcmPushNotify(...)` 호출 3곳 삭제

### js/social-chat-firebase.js
- 소통 모드 FCM 호출 제거 (추후 추가 시)

### Firebase DB
- `/fcm_tokens` 경로 데이터 삭제
- `/fcm_active_room` 경로 데이터 삭제

### Firebase Rules
- `fcm_tokens`, `fcm_active_room` 경로 규칙 제거

### GitHub Secrets
- `FCM_VAPID_KEY` 삭제
- `.github/workflows/pages.yml`에서 VAPID 키 치환 줄 제거

### Apps Script
- `FCM_PUSH_HANDLER.gs` 파일 삭제
- 라우터에서 `fcm_push` 분기 제거 후 재배포

---

## 주의사항

- **iOS 제약**: iOS 16.4 미만은 PWA 푸시 미지원
- **VAPID 키**: 공개 키만 클라이언트에 노출됨 (안전)
- **서비스 계정 비공개 키**: Apps Script에만 있고 클라이언트에 노출되지 않음 (안전)
- **토큰 갱신**: FCM 토큰은 브라우저가 갱신할 수 있음. 로그인 시마다 DB에 최신 토큰 저장
- **fcm_active_room 유효 시간**: 30초. 그 이상 지나면 "방을 보고 있지 않음"으로 간주하여 알림 발송
