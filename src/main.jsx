import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/theme.css';  // 테마 CSS 추가
import './index.css';
import ErrorHandler from './utils/errorHandler';

// 전역 에러 핸들러 설정
ErrorHandler.setupGlobalErrorHandlers();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);