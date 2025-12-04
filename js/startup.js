// startup.js - 앱 초기화 및 모듈 초기화 오케스트레이션

window.addEventListener("load", () => {
  // core 초기화 (캐릭터 인사, 수면 타이머 등)
  if (typeof init === "function") {
    init();
  }

  // 사용자 인터랙션 바인딩
  if (typeof initActions === "function") {
    initActions();
  }

  // 가르치기(학습) UI 바인딩
  if (typeof initTeachUI === "function") {
    initTeachUI();
  }

  // [옵션 기능] 수첩(메뉴) UI 초기화 시작
  // 이 코드는 js/notebook-menu.js 모듈이 있을 때만 의미가 있습니다.
  // 만약 js/notebook-menu.js를 삭제했다면,
  // 아래 블록 전체를 함께 삭제해도 됩니다.
  if (typeof initNotebookMenu === "function") {
    initNotebookMenu();
  }
  // [옵션 기능] 수첩(메뉴) UI 초기화 끝

  // 게시판 UI 초기화
  if (typeof initBoardUI === "function") {
    initBoardUI();
  }

  // 로그인 UI 초기화
  if (typeof initLoginUI === "function") {
    initLoginUI();
  }

  // 시계 위젯 초기화 (오른쪽 상단 큰 디지털 시계, HH:MM 형식)
  const clockWidgetEl = document.getElementById("clockWidget");
  if (clockWidgetEl) {
    function updateClockWidget() {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, "0");
      const minutes = now.getMinutes().toString().padStart(2, "0");

      // 예: 11:37
      clockWidgetEl.textContent = `${hours}:${minutes}`;
    }

    updateClockWidget();
    // 분 단위로만 바뀌므로 30초 간격으로 갱신
    setInterval(updateClockWidget, 30000);
  }

  // 배경 / 지도 / 배경 선택 패널 초기화
  if (typeof initBackgroundSystem === "function") {
    initBackgroundSystem();
  }
});