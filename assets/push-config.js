/**
 * 새 쿠폰 푸시 알림 설정 (파이어베이스 웹 앱 설정). 모두 공개용 값이라 여기 둬도 된다(비밀 키 아님).
 * 비어 있으면 알림 버튼이 보이지 않고, 홈 화면 설치(웹앱) 기능만 동작한다.
 * 채우는 곳: 파이어베이스 콘솔 → 프로젝트 설정 → 일반 → 내 앱(웹) 의 firebaseConfig,
 *            그리고 프로젝트 설정 → 클라우드 메시징 → 웹 푸시 인증서 의 키 쌍(vapidKey).
 * 서비스 워커(/sw.js)도 이 파일을 읽는다.
 */
self.ECM_PUSH = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  messagingSenderId: '',
  appId: '',
  vapidKey: '',
};
