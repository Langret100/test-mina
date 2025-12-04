// manual-panel.js
// [모듈] 플러스(+) 메뉴의 📖 사용 설명서 패널 전용 스크립트입니다.
// 이 파일을 삭제할 경우, index.html의 #manualPanel 블록과
// ghost.css의 .manual-panel 관련 스타일도 함께 제거하면 됩니다.

(function(){
  const PANEL_ID = "manualPanel";
  const DETAIL_ID = "manualDetail";

  // 기능별 설명 텍스트 정의
  const MANUAL_CONTENT = {
    chat: {
      title: "💬 기본 대화",
      lines: [
        "채팅창에 말을 걸면 감정과 함께 대답해요.",
        "예: '안녕', '도와줘', '오늘 어땠어?' 등 자연스러운 문장 지원.",
        "'~가 뭐야?'처럼 물어보면 간단한 설명을 찾아줘요.",
        "읽어주기(TTS)를 켜두면 말풍선 대사를 실제 음성으로 읽어줘요.",
        "보내기 버튼을 1.5초 길게 누르면 음성 인식으로 말한 내용을 글로 바꿔 입력할 수 있어요."
      ]
    },
    teach: {
      title: "🧠 가르치기",
      lines: [
        "특정 문장에 대한 대답을 직접 가르칠 수 있어요.",
        "예: '내일 시험이야'라고 말했을 때 어떤 대답을 할지 미리 지정 가능.",
        "각 학생의 별명, 호칭 등을 등록해두는 용도로도 활용돼요.",
        "가르친 내용은 저장돼서, 같은 문장을 다시 말하면 가르친 대로 대답해요."
      ]
    },
    char: {
      title: "🎭 캐릭터 변경",
      lines: [
        "플러스(+) 메뉴의 '캐릭터 변경'에서 원하는 캐릭터로 바꿀 수 있어요.",
        "선택한 캐릭터는 메인 화면과 미니 게임 속 캐릭터 모두에 적용돼요.",
        "캐릭터의 감정 표현(기쁨, 당황, 졸림 등)은 대화 상황과 게임 결과에 따라 달라져요."
      ]
    },
    games: {
      title: "🎮 미니 게임",
      lines: [
        "현재 구구단게임, 덧셈주사위, 꿈틀도형게임이 준비돼 있어요.",
        "각 게임 점수는 구글 스프레드시트에 기록되고, 랭킹에서도 확인할 수 있어요.",
        "게임을 잘하면 캐릭터 머리 위 왕관과 함께 1등 기록이 표시돼요.",
        "'게임 랭킹' 메뉴에서는 각 게임별 전체 랭킹과 자신의 기록을 볼 수 있어요."
      ]
    },
    note: {
      title: "📔 수첩 / 게시판",
      lines: [
        "고스트를 한 번 누르면 수첩 화면을 열 수 있어요.",
        "'게시판'에서는 학급 공지나 아이들이 남긴 글을 확인할 수 있어요.",
        "'오늘의 퀘스트' 메모지를 누르면 '퀘스트 탐사' 창이 열려요.",
        "퀘스트 탐사에서는 학습지, 퀴즈, 가상교실탐사, 책 읽기, 글쓰기 등 5가지 임무를 선택할 수 있어요.",
        "각 퀘스트 카드는 나중에 외부 학습 콘텐츠 링크로 연결할 수 있도록 설계돼 있어요."
      ]
    },
    etc: {
      title: "✨ 기타 기능",
      lines: [
        "배경 선택: 다양한 배경으로 분위기를 바꿔 보세요. 열차 배경은 별도 레이어로 자연스럽게 전환돼요.",
        "로그인: 첫 접속 시 자동으로 로그인 창이 뜨며, 기록이 사용자별로 저장돼요.",
        "읽어주기 설정: 플러스(+) 메뉴의 '읽어주기'에서 TTS 켜기/끄기와 목소리 선택이 가능해요.",
        "AR 카메라: 수첩 속 'AR 카메라' 메모지는 추후 WebAR/카메라 기능과 연결하기 위한 자리예요.",
        "기능들은 계속 확장될 예정이며, 필요 없는 모듈은 JS 파일 단위로 쉽게 제거할 수 있게 설계돼 있어요."
      ]
    }
  };

  function renderDetail(key){
    var detailEl = document.getElementById(DETAIL_ID);
    if (!detailEl) return;
    var data = MANUAL_CONTENT[key];
    if (!data){
      detailEl.textContent = "해당 기능에 대한 설명을 찾지 못했어요.";
      return;
    }

    var html = "<h3>" + data.title + "</h3>";
    html += data.lines.map(function(line){
      return "<p>" + line + "</p>";
    }).join("");
    detailEl.innerHTML = html;

    // 버튼 active 표시
    var panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    var items = panel.querySelectorAll(".manual-item");
    items.forEach(function(btn){
      if (btn.dataset.manualKey === key){
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }

  function openPanel(initialKey){
    var panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    panel.classList.remove("hidden");
    panel.classList.add("open");

    if (window.hideFullscreenButton) {
      try { window.hideFullscreenButton(); } catch (e) {}
    }

    if (initialKey){
      renderDetail(initialKey);
    } else {
      renderDetail("chat");
    }
  }

  function closePanel(){
    var panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    panel.classList.remove("open");
    // 시각적/접근성 혼란 줄이기 위해 hidden 유지
    panel.classList.add("hidden");
    if (window.showFullscreenButton) {
      try { window.showFullscreenButton(); } catch (e) {}
    }
  }

  function initManualPanel(){
    var panel = document.getElementById(PANEL_ID);
    if (!panel) return;

    var closeBtn = document.getElementById("manualCloseBtn");
    if (closeBtn){
      closeBtn.addEventListener("click", function(){
        closePanel();
      });
    }

    var backdrop = panel.querySelector(".manual-backdrop");
    if (backdrop){
      backdrop.addEventListener("click", function(){
        closePanel();
      });
    }

    var items = panel.querySelectorAll(".manual-item");
    items.forEach(function(btn){
      btn.addEventListener("click", function(){
        var key = btn.dataset.manualKey;
        renderDetail(key);
      });
    });
  }

  // 전역에서 사용하기 위한 헬퍼 노출
  window.openManualPanel = openPanel;
  window.closeManualPanel = closePanel;

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", initManualPanel);
  } else {
    initManualPanel();
  }
})();
