export const translations = {
  en: {
    // App-level
    appSubtitle: "Users do not need account login. Phone and email are required for every request.",

    // Sidebar / navigation
    navRoomReservation: "Room Reservation",
    sidebarRooms: "Portal",
    navTimeline: "Reservation Status",
    navRequest: "New Request",
    navAdmin: "Admin Review",
    navSettings: "Room Settings",
    navRefresh: "Refresh",

    // TopBar
    myAccount: "My Account",
    logout: "Logout",
    guest: "Guest",

    // Login modal
    loginTitle: "Milal Rooms",
    loginSubtitle: "Welcome to the room reservation system",
    loginNameLabel: "Name *",
    loginNamePlaceholder: "Enter your name",
    loginButton: "Quick Start",
    loginError: "Please enter your name.",

    // Auth / account creation flow
    authOr: "OR",
    authCreateAccount: "Create Account",
    authLoginWithPw: "Login with password",
    authFindMemberSubtitle: "Find your member record",
    authLoginWithPwSubtitle: "Login with your account",
    authEnterCodeSubtitle: "Enter verification code",
    authSetPasswordSubtitle: "Create your password",
    authSuccessSubtitle: "Account created!",
    authYourName: "Name",
    authPhone: "Phone",
    authEmail: "Email",
    authFindMember: "Find Member",
    authMemberNotFound: "Member not found. Check your name and contact info.",
    authContactRequired: "Please enter name and contact info.",
    authSendOtpTo: "Send verification code to",
    authSendCode: "Send Verification Code",
    authOtpFailed: "Failed to send code. Please try again.",
    authCode: "4-digit code",
    authCodeSentTo: "A code was sent to",
    authDevCode: "[Dev] Verification code",
    authVerify: "Verify",
    authResend: "Resend code",
    authOtpLength: "Please enter a 4-digit code.",
    authOtpInvalid: "Invalid or expired code.",
    authPassword: "Password",
    authConfirmPassword: "Confirm Password",
    authPwHint: "At least 6 characters",
    authPwTooShort: "Password must be at least 6 characters.",
    authPwMismatch: "Passwords do not match.",
    authCreateAccountBtn: "Create Account",
    authCreateFailed: "Failed to create account.",
    authSuccessTitle: "Account Created!",
    authSuccessDesc: "You can now log in with your name and password.",
    authGoToLogin: "Go to Login",
    authLogin: "Login",
    authLoginFailed: "Invalid name or password.",
    authBack: "Back",

    // Calendar modes
    day: "DAY",
    week: "WEEK",
    month: "MONTH",

    // ReservationTimeline filters
    filterFloor: "Floor",
    filterAllFloors: "All Floors",
    filterFloor1: "1st Floor",
    filterFloor2: "2nd Floor",
    filterRoom: "Room",
    filterAllRooms: "All Rooms",
    filterStatus: "Status",
    filterAllStatus: "All Status",

    // Detail list
    detailListTitle: "Detailed Reservation List",
    detailListShow: "Show list ▼",
    detailListHide: "Hide ▲",
    detailListItems: "items",

    // Table headers
    colId: "ID",
    colRoom: "Room",
    colTime: "Time",
    colRequester: "Requester",
    colPurpose: "Purpose",
    colStatus: "Status",
    colAdminNote: "Admin Note",

    // Reservation detail dialog
    reservationDetail: "Reservation Detail",
    fieldStart: "Start",
    fieldEnd: "End",
    fieldName: "Name",
    fieldPhone: "Phone",
    fieldEmail: "Email",
    fieldAttendees: "Attendees",
    fieldNotes: "Notes",
    fieldAdminComment: "Admin Comment",

    // Status labels
    statusPending: "Pending",
    statusApproved: "Approved",
    statusChanged: "Changed",
    statusRejected: "Rejected",

    // Calendar navigation
    prev: "Prev",
    today: "Today",
    next: "Next",

    // Floor label in floor plan tooltip
    floorLabel: "Floor",
    locationLabel: "Location",

    // NewReservationModal
    newReservationTitle: "New Reservation Request",
    fieldRoom: "Room",
    fieldStartTime: "Start Time",
    fieldEndTime: "End Time",
    endTimeDateLabel: "selected date",
    endTimeMinHint: "Min %s or later",
    endTimeSelectStart: "Please select start time first",
    cancel: "Cancel",
    submitRequest: "Submit Request",
    capacity: "capacity",
    floor1Label: "1F (Floor 1)",
    floor2Label: "2F (Floor 2)",

    // AdminReservationPanel
    adminReview: "Admin Review",
    adminApiKey: "Admin API Key",
    adminApiKeyPlaceholder: "Enter backend ADMIN_API_KEY",
    colWhen: "When",
    colChangeTo: "Change To",
    colActions: "Actions",
    actionApprove: "Approve",
    actionChange: "Change",
    actionReject: "Reject",
    changeRoom: "Change Room",
    changeStartTime: "New Start Time",
    changeEndTime: "New End Time",
    adminCommentLabel: "Admin Comment",
    noReservations: "No reservations.",

    // RoomSettingsPanel
    roomSettings: "Room Settings",
    roomName: "Room Name",
    roomCapacity: "Capacity",
    roomDescription: "Description",
    roomFloor: "Floor",
    roomActive: "Active",
    saveChanges: "Save",
    addRoom: "Add Room",
    roomNameLabel: "Name",
    loading: "Loading...",
    noChanges: "No changes",
    saved: "Saved",

    // WeekScheduleCalendar
    weekRange: "%s – %s",

    // General
    room: "Room",
    name: "Name",
    phone: "Phone",
    email: "Email",
    purpose: "Purpose",
    attendees: "Attendees",
    notes: "Notes",
    noReservationsVisible: "No reservations",
  },

  ko: {
    // App-level
    appSubtitle: "로그인 없이 사용 가능합니다. 예약 신청 시 전화번호와 이메일이 필요합니다.",

    // Sidebar / navigation
    navRoomReservation: "장소 예약",
    sidebarRooms: "포털",
    navTimeline: "예약 현황",
    navRequest: "새 예약 신청",
    navAdmin: "관리자 검토",
    navSettings: "장소 설정",
    navRefresh: "새로고침",

    // TopBar
    myAccount: "내 계정",
    logout: "로그아웃",
    guest: "게스트",

    // Login modal
    loginTitle: "밀알 룸즈",
    loginSubtitle: "장소 예약 시스템에 오신 것을 환영합니다",
    loginNameLabel: "이름 *",
    loginNamePlaceholder: "이름을 입력하세요",
    loginButton: "빠른 시작",
    loginError: "이름을 입력해주세요.",

    // Auth / account creation flow
    authOr: "또는",
    authCreateAccount: "계정 만들기",
    authLoginWithPw: "비밀번호로 로그인",
    authFindMemberSubtitle: "멤버 정보 찾기",
    authLoginWithPwSubtitle: "계정으로 로그인",
    authEnterCodeSubtitle: "인증 코드 입력",
    authSetPasswordSubtitle: "비밀번호 설정",
    authSuccessSubtitle: "계정이 생성되었습니다!",
    authYourName: "이름",
    authPhone: "전화번호",
    authEmail: "이메일",
    authFindMember: "멤버 찾기",
    authMemberNotFound: "멤버를 찾을 수 없습니다. 이름과 연락정보를 확인하세요.",
    authContactRequired: "이름과 연락정보를 입력해주세요.",
    authSendOtpTo: "인증 코드 전송 대상",
    authSendCode: "인증 코드 전송",
    authOtpFailed: "코드 전송에 실패했습니다. 다시 시도해주세요.",
    authCode: "4자리 코드",
    authCodeSentTo: "코드가 전송되었습니다:",
    authDevCode: "[개발] 인증 코드",
    authVerify: "확인",
    authResend: "코드 재전송",
    authOtpLength: "4자리 코드를 입력해주세요.",
    authOtpInvalid: "유효하지 않거나 만료된 코드입니다.",
    authPassword: "비밀번호",
    authConfirmPassword: "비밀번호 확인",
    authPwHint: "6자 이상 입력",
    authPwTooShort: "비밀번호는 6자 이상이어야 합니다.",
    authPwMismatch: "비밀번호가 일치하지 않습니다.",
    authCreateAccountBtn: "계정 생성",
    authCreateFailed: "계정 생성에 실패했습니다.",
    authSuccessTitle: "계정 생성 완료!",
    authSuccessDesc: "이제 이름과 비밀번호로 로그인할 수 있습니다.",
    authGoToLogin: "로그인으로 이동",
    authLogin: "로그인",
    authLoginFailed: "이름 또는 비밀번호가 잘못되었습니다.",
    authBack: "뒤로",

    // Calendar modes
    day: "일",
    week: "주",
    month: "월",

    // ReservationTimeline filters
    filterFloor: "층",
    filterAllFloors: "전체 층",
    filterFloor1: "1층",
    filterFloor2: "2층",
    filterRoom: "장소",
    filterAllRooms: "전체 장소",
    filterStatus: "상태",
    filterAllStatus: "전체 상태",

    // Detail list
    detailListTitle: "예약 상세 목록",
    detailListShow: "목록 보기 ▼",
    detailListHide: "숨기기 ▲",
    detailListItems: "건",

    // Table headers
    colId: "ID",
    colRoom: "장소",
    colTime: "시간",
    colRequester: "신청자",
    colPurpose: "목적",
    colStatus: "상태",
    colAdminNote: "관리자 메모",

    // Reservation detail dialog
    reservationDetail: "예약 상세",
    fieldStart: "시작",
    fieldEnd: "종료",
    fieldName: "이름",
    fieldPhone: "전화번호",
    fieldEmail: "이메일",
    fieldAttendees: "참석자",
    fieldNotes: "메모",
    fieldAdminComment: "관리자 코멘트",

    // Status labels
    statusPending: "대기중",
    statusApproved: "승인됨",
    statusChanged: "변경됨",
    statusRejected: "거부됨",

    // Calendar navigation
    prev: "이전",
    today: "오늘",
    next: "다음",

    // Floor label in floor plan tooltip
    floorLabel: "층",
    locationLabel: "위치",

    // NewReservationModal
    newReservationTitle: "새 예약 신청",
    fieldRoom: "장소",
    fieldStartTime: "시작 시간",
    fieldEndTime: "종료 시간",
    endTimeDateLabel: "선택한 날짜",
    endTimeMinHint: "최소 %s 이후",
    endTimeSelectStart: "시작 시간을 먼저 선택하세요",
    cancel: "취소",
    submitRequest: "신청하기",
    capacity: "수용",
    floor1Label: "1층",
    floor2Label: "2층",

    // AdminReservationPanel
    adminReview: "관리자 검토",
    adminApiKey: "관리자 API 키",
    adminApiKeyPlaceholder: "ADMIN_API_KEY 입력",
    colWhen: "일시",
    colChangeTo: "변경 내용",
    colActions: "작업",
    actionApprove: "승인",
    actionChange: "변경",
    actionReject: "거부",
    changeRoom: "장소 변경",
    changeStartTime: "새 시작 시간",
    changeEndTime: "새 종료 시간",
    adminCommentLabel: "관리자 코멘트",
    noReservations: "예약이 없습니다.",

    // RoomSettingsPanel
    roomSettings: "장소 설정",
    roomName: "장소 이름",
    roomCapacity: "수용 인원",
    roomDescription: "설명",
    roomFloor: "층",
    roomActive: "활성",
    saveChanges: "저장",
    addRoom: "장소 추가",
    roomNameLabel: "이름",
    loading: "로딩 중...",
    noChanges: "변경 없음",
    saved: "저장됨",

    // WeekScheduleCalendar
    weekRange: "%s – %s",

    // General
    room: "장소",
    name: "이름",
    phone: "전화번호",
    email: "이메일",
    purpose: "목적",
    attendees: "참석자 수",
    notes: "메모",
    noReservationsVisible: "예약 없음",
  },
};
