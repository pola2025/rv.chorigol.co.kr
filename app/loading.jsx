// 로딩 화면 — 레거시 App.jsx 의 LoadingScreen(44-51행) 이식.
//
// 레거시는 Firebase Auth 확인 중에 이걸 띄웠다. 신규 스택은 미들웨어가 서버에서 인증을 끝내므로
// 그 대기 자체가 없다 — 대신 Next 의 loading.jsx 규약(Suspense 폴백) 자리에 같은 모양을 둔다.
// CSS(.loading-overlay/.loading-modal/.loading-spinner-circle)는 App.css 에 그대로 있고
// 루트 레이아웃이 이미 로드한다.
export default function Loading() {
  return (
    <div className="loading-overlay">
      <div className="loading-modal">
        <div className="loading-spinner-circle"></div>
        <p>로딩중입니다</p>
      </div>
    </div>
  );
}
