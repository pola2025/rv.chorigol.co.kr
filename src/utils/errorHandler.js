// src/utils/errorHandler.js - 전역 에러 핸들러
export class ErrorHandler {
  static handleFirebaseError(error) {
    console.error('Firebase Error:', error);
    
    switch (error.code) {
      case 'permission-denied':
        return '접근 권한이 없습니다. 관리자 계정으로 로그인해주세요.';
      
      case 'unavailable':
        return '서비스를 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해주세요.';
      
      case 'unauthenticated':
        return '인증이 필요합니다. 다시 로그인해주세요.';
      
      case 'network-request-failed':
        return '네트워크 연결을 확인해주세요.';
      
      case 'quota-exceeded':
        return '할당량이 초과되었습니다. 잠시 후 다시 시도해주세요.';
      
      default:
        return error.message || '알 수 없는 오류가 발생했습니다.';
    }
  }

  static handleAsyncError(error) {
    // Chrome extension 관련 에러 무시
    if (error.message && error.message.includes('listener indicated an asynchronous response')) {
      return; // Chrome extension 에러는 무시
    }
    
    console.error('Async Error:', error);
    return error.message;
  }

  static setupGlobalErrorHandlers() {
    // 전역 에러 핸들러
    window.addEventListener('error', (event) => {
      // Chrome extension 관련 에러 무시
      if (event.message && event.message.includes('listener indicated an asynchronous response')) {
        event.preventDefault();
        return;
      }
      
      console.error('Global error:', event.error);
    });

    // Promise rejection 핸들러
    window.addEventListener('unhandledrejection', (event) => {
      // Chrome extension 관련 에러 무시
      if (event.reason && event.reason.message && 
          event.reason.message.includes('listener indicated an asynchronous response')) {
        event.preventDefault();
        return;
      }
      
      console.error('Unhandled promise rejection:', event.reason);
    });
  }
}

export default ErrorHandler;
