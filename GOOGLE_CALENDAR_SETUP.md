# Google Calendar 연동 설정 가이드 (읽기 전용)

이 앱은 지정된 Google 캘린더에서 `"장소-목적"` 형식으로 제목이 붙은 일정을 읽어와,
방 예약 화면에 표시하고 예약 가능 여부 판단에 반영합니다. 구현은
[backend/app/google_calendar.py](backend/app/google_calendar.py)에 있습니다.

## 1. Google Cloud 프로젝트 준비

1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트 생성 (또는 기존 프로젝트 사용).
2. **API 및 서비스 → 라이브러리**에서 **Google Calendar API** 검색 → **사용 설정(Enable)**.
   - 활성화하지 않으면 다음과 같은 403 오류가 발생합니다:
     `Google Calendar API has not been used in project ... or it is disabled.`
   - 활성화 후 반영까지 몇 분 걸릴 수 있습니다.

## 2. 서비스 계정 생성 및 키 발급

1. **IAM 및 관리자 → 서비스 계정 → 서비스 계정 만들기**.
2. 생성된 계정 → **키(Keys) 탭 → 키 추가 → JSON** → 다운로드.
3. JSON 안의 `client_email` 값(예: `xxx@yyy.iam.gserviceaccount.com`)을 기록해둔다 — 캘린더 공유 시 필요.

⚠️ **보안 주의사항**
- 이 JSON 파일(특히 `private_key`)은 **절대 채팅, 커밋, 공개 저장소에 붙여넣지 말 것**. 유출되면 즉시 GCP 콘솔에서 해당 키를 삭제하고 새로 발급.
- 서버에는 `backend/secrets/google-service-account.json` 경로에 업로드한다 (`.gitignore`에 `/backend/secrets/`가 이미 등록되어 git에는 올라가지 않음).

## 3. 캘린더 공유 설정

대상 계정은 **개인 Gmail 계정**을 권장합니다 (Google Workspace 계정은 조직 정책으로 외부 공유가
"한가함/바쁨"으로 강제 제한되는 경우가 있어 이 방식이 막힐 수 있습니다).

1. 대상 Gmail 계정으로 Google Calendar 접속 → 캘린더 우측 **⋮ → 설정 및 공유**.
2. **공유 대상 → 사용자 및 그룹 추가** → 서비스 계정 `client_email` 입력.
3. 권한 드롭다운에서 **"세부정보 보기"(reader)**를 선택 시도.
   - ⚠️ Google UI가 서비스 계정 주소에 대해 **"한가함/바쁨 정보만 보기"만 선택 가능**하게 막는 경우가 흔합니다.
     이 경우 아래 4단계(API로 직접 설정)를 사용합니다.

### 3-1. UI가 막혀 있을 때: API로 직접 권한 부여

1. [Calendar API Acl: insert 문서](https://developers.google.com/calendar/api/v3/reference/acl/insert) 페이지의 **"Try this method"** 사용.
2. `calendarId`: 캘린더 소유자 이메일 (예: `hr.manager.milal@gmail.com`).
3. Request body:
   ```json
   {
     "role": "reader",
     "scope": {
       "type": "user",
       "value": "서비스계정-client_email"
     }
   }
   ```
4. **Authorize**를 캘린더 소유자 계정으로 로그인해서 승인 (`https://www.googleapis.com/auth/calendar` 스코프).
5. 성공하면 [Acl: list](https://developers.google.com/calendar/api/v3/reference/acl/list)로 재조회해서 실제 `"role": "reader"`가 저장됐는지 확인 (UI 표시와 무관하게 이 값이 기준).

### 3-2. (참고) Google Workspace 계정에서 완전히 막힐 때

조직 정책으로 외부 공유 자체가 free/busy로 고정되어 API로도 우회 불가능한 경우, **도메인 전체 위임
(Domain-wide Delegation)**이 대안입니다. Workspace 관리자 콘솔(admin.google.com) 접근 권한이
필요하며, 서비스 계정이 조직 내 특정 사용자(예: `it-team@milalchurch.com`)를 impersonate하도록
설정합니다. 이 경우 외부 공유 제한 자체가 적용되지 않습니다. (현재 코드는 이 방식을 구현하지 않았음 —
필요 시 별도 작업.)

## 4. 개별 일정의 "비공개" 설정 주의

캘린더 공유 권한이 충분해도(reader 이상), **개별 일정이 "비공개(Private)"로 설정되어 있으면**
API 응답에 `summary`(제목) 자체가 빠지고 `visibility: "private"`만 내려옵니다. 이 경우:

- 일정 편집 → 공개범위를 **"기본값"** 또는 **"공개"**로 변경, 또는
- 캘린더 설정 → 이벤트 설정에서 새 일정의 기본 공개범위를 비공개가 아닌 값으로 변경.

## 5. 서버 환경 변수 설정

`.env`:
```
GOOGLE_SERVICE_ACCOUNT_FILE=/app/backend/secrets/google-service-account.json
GOOGLE_CALENDAR_ID=<캘린더 소유자 이메일>
```

`docker-compose.yml`에는 이미 다음이 설정되어 있습니다:
```yaml
environment:
  GOOGLE_SERVICE_ACCOUNT_FILE: ${GOOGLE_SERVICE_ACCOUNT_FILE:-/app/backend/secrets/google-service-account.json}
  GOOGLE_CALENDAR_ID: ${GOOGLE_CALENDAR_ID:-hr.manager.milal@gmail.com}
volumes:
  - ./backend/secrets:/app/backend/secrets:ro
```

키 파일은 `backend/secrets/google-service-account.json`에 두면 컨테이너 재시작 시 자동 마운트됩니다.

## 6. 일정 제목 형식 규칙

이 앱은 `"장소-목적"` 형식(첫 `-` 기준으로 분리)의 제목만 인식합니다. 예: `새가족실-순모임`.

- `-`가 없는 제목 → 무시됨.
- 파싱된 "장소"가 시스템에 등록된 방 이름과 정확히 일치하지 않으면 → 무시됨 (공백/오탈자 주의).

## 7. 동작 확인

컨테이너 로그에서 아래 태그로 진단할 수 있습니다:

```
docker compose logs -f app
```

- `[google_calendar] service initialized ok ...` — 키 파일 로딩 성공.
- `[google_calendar] querying calendar_id=...` — 조회 요청 범위/유효 방 목록.
- `[google_calendar] RAW item: {...}` — Google이 반환한 원본 이벤트.
- `[google_calendar] SKIP (...)` — 제외된 이유 (취소됨 / 형식 불일치 / 방 이름 불일치 / 비공개 / 시간 누락).
- `[google_calendar] MATCH ...` — 정상 매칭.
- `[external-events] returning N item(s) to client` — 최종 프런트로 전달되는 건수.

## 8. 자주 겪는 오류 정리

| 증상 | 원인 | 해결 |
|---|---|---|
| `Google Calendar API has not been used in project ...` (403) | Calendar API 미활성화 | 1단계에서 API 활성화 |
| UI에서 "한가함/바쁨"만 선택 가능 | 서비스 계정 주소에 대한 UI 제한 | 3-1단계 (API로 `acl.insert`) |
| `visibility: private`, `summary` 없음 | 개별 일정이 비공개 | 4단계 (일정 공개범위 변경) |
| 방을 공유해도 여전히 free/busy만 | Workspace 조직 정책 | 3-2단계 (도메인 위임) 또는 개인 Gmail 계정 사용 |
| 이벤트가 시스템에 전혀 안 보임 | 제목 형식/방 이름 불일치 | 6단계, 로그의 SKIP 사유 확인 |
