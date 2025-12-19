// src/App.jsx - Fixed version with React Query + React Router

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from './config/firebase';
import { FirebaseProvider } from './providers/FirebaseProvider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import runDiagnostics from './utils/diagnostics';
import './App.css';

// Dashboard를 정적으로 import
import Dashboard from './components/Dashboard';
import LoginScreen from './components/LoginScreen';

// Query Client 생성 (앱 전체에서 하나만 사용)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5분
      gcTime: 10 * 60 * 1000, // 10분 (구 cacheTime)
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
  <div className="loading-screen">
    <div className="loading-spinner"></div>
    <p>인증 상태를 확인하고 있습니다...</p>
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

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('Setting up auth listener...');
    
    // 개발 환경에서 진단 도구 활성화
    if (process.env.NODE_ENV === 'development') {
      window.runDiagnostics = runDiagnostics;
      console.log('💡 진단 도구가 활성화되었습니다.');
      console.log('💡 콘솔에서 runDiagnostics()를 실행하여 시스템을 진단할 수 있습니다.');
    }
    
    const unsubscribe = onAuthStateChanged(
      auth, 
      (currentUser) => {
        console.log('User:', currentUser?.email || 'No user');
        setUser(currentUser);
        setLoading(false);
      },
      (error) => {
        console.error("Auth error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout Error:", error);
    }
  }, []);

  // 메모이제이션으로 렌더링 최적화
  const content = useMemo(() => {
    if (loading) {
      return <LoadingScreen />;
    }

    if (user) {
      return (
        <BrowserRouter>
          <div className="app">
            <FirebaseProvider>
              <Dashboard user={user} onLogout={handleLogout} />
            </FirebaseProvider>
          </div>
        </BrowserRouter>
      );
    }

    // 로그인 화면
    return (
      <div className="app">
        <LoginScreen />
      </div>
    );
  }, [loading, user, handleLogout]);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {content}
        {/* 개발 모드에서만 React Query Devtools 표시 */}
        {process.env.NODE_ENV === 'development' && (
          <ReactQueryDevtools initialIsOpen={false} position="bottom-right" />
        )}
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
