// src/App.jsx - React Router 적용 버전

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from './config/firebase';
import { FirebaseProvider } from './providers/FirebaseProvider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import runDiagnostics from './utils/diagnostics';
import notificationScheduler from './services/notificationScheduler';
import './App.css';

// 레이아웃
import MainLayout from './layouts/MainLayout';

// 페이지 컴포넌트
import {
  CalendarPage,
  ReservationsPage,
  RoomsPage,
  PricingPage,
  OptionsPage,
  NotificationsPage,
  AnalyticsPage,
  SecurityPage
} from './pages';

// 로그인 화면
import LoginScreen from './components/LoginScreen';

// Query Client 생성
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

// 로딩 컴포넌트
const LoadingScreen = () => (
  <div className="loading-overlay">
    <div className="loading-modal">
      <div className="loading-spinner-circle"></div>
      <p>로딩중입니다</p>
    </div>
  </div>
);

// 에러 경계 컴포넌트
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px' }}>
          <h1>초호펜션 관리 시스템</h1>
          <div style={{ color: 'red', marginTop: '20px' }}>
            <h3>오류가 발생했습니다</h3>
            <p>{this.state.error?.message || '알 수 없는 오류'}</p>
            <button onClick={() => window.location.reload()}>
              페이지 새로고침
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// 인증된 사용자만 접근 가능한 라우트
function ProtectedRoute({ user, children }) {
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('Setting up auth listener...');

    // 개발 환경에서 진단 도구 활성화
    if (process.env.NODE_ENV === 'development') {
      window.runDiagnostics = runDiagnostics;
      console.log('💡 진단 도구가 활성화되었습니다.');
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        console.log('User:', currentUser?.email || 'No user');
        setUser(currentUser);
        setLoading(false);

        // 사용자가 로그인하면 알림 스케줄러 시작
        if (currentUser) {
          console.log('📅 알림 스케줄러 시작...');
          notificationScheduler.start().catch(err => {
            console.error('📅 알림 스케줄러 시작 실패:', err);
          });
        } else {
          // 로그아웃 시 스케줄러 중지
          notificationScheduler.stop();
        }
      },
      (error) => {
        console.error("Auth error:", error);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
      notificationScheduler.stop();
    };
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout Error:", error);
    }
  }, []);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <div className="app">
            {user ? (
              <FirebaseProvider>
                <Routes>
                  {/* 메인 레이아웃 적용 라우트 */}
                  <Route element={<MainLayout user={user} onLogout={handleLogout} />}>
                    <Route path="/calendar" element={<CalendarPage />} />
                    <Route path="/reservations" element={<ReservationsPage />} />
                    <Route path="/rooms" element={<RoomsPage />} />
                    <Route path="/pricing" element={<PricingPage />} />
                    <Route path="/options" element={<OptionsPage />} />
                    <Route path="/notifications" element={<NotificationsPage />} />
                    <Route path="/analytics" element={<AnalyticsPage />} />
                    <Route path="/security" element={<SecurityPage />} />
                  </Route>

                  {/* 기본 리다이렉트 */}
                  <Route path="/" element={<Navigate to="/calendar" replace />} />
                  <Route path="/login" element={<Navigate to="/calendar" replace />} />

                  {/* 404 처리 */}
                  <Route path="*" element={<Navigate to="/calendar" replace />} />
                </Routes>
              </FirebaseProvider>
            ) : (
              <Routes>
                <Route path="/login" element={<LoginScreen />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
            )}
          </div>
        </BrowserRouter>

        {/* 개발 모드에서만 React Query Devtools 표시 */}
        {process.env.NODE_ENV === 'development' && (
          <ReactQueryDevtools initialIsOpen={false} position="bottom-right" />
        )}
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
