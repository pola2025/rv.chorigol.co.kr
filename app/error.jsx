"use client";
// 에러 화면 — 레거시 App.jsx 의 ErrorBoundary(54-86행) 이식.
//
// App.jsx 는 전체를 클래스형 ErrorBoundary 로 감싸고 있었다. Next App Router 는 그 자리를
// **error.jsx 규약**으로 대체한다(같은 일을 프레임워크가 한다) → 클래스 컴포넌트는 안 옮긴다.
// 문구·버튼은 레거시 그대로 두되, 새로고침은 Next 의 reset() 을 먼저 쓴다
// (렌더만 다시 하면 되는 경우가 대부분이라 전체 리로드보다 가볍다. 실패하면 리로드로 폴백).
export default function Error({ error, reset }) {
  return (
    <div style={{ padding: "20px" }}>
      <h1>초호펜션 관리 시스템</h1>
      <div style={{ color: "red", marginTop: "20px" }}>
        <h3>오류가 발생했습니다</h3>
        <p>{error?.message || "알 수 없는 오류"}</p>
        <button
          onClick={() => {
            try {
              reset();
            } catch {
              window.location.reload();
            }
          }}
        >
          페이지 새로고침
        </button>
      </div>
    </div>
  );
}
