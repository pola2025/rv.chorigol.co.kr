/** @type {import('next').NextConfig} */
const nextConfig = {
  // 마이그레이션 중 Vite 앱(src/)과 공존. Next는 app/ 만 사용.
  reactStrictMode: true,
  // 빌드 중 ESLint 비활성화: 프로젝트의 Vite용 eslint.config.mjs가 Next 서버 코드와
  // 충돌(process 전역 미인식, react-refresh 규칙). 컷오버 시 Next용 설정으로 교체 예정.
  eslint: { ignoreDuringBuilds: true },
  // D1 접근 토큰 등 서버 전용 env는 절대 클라이언트로 노출하지 않음 (NEXT_PUBLIC_ 미사용)
};

export default nextConfig;
