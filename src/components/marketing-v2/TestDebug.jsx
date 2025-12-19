// TestDebug.jsx - 캐시 문제 검증용
import React from 'react';

const TestDebug = () => {
  const buildTime = '2025-01-08 16:45:00';
  const version = 'DEBUG-001';
  
  return (
    <div style={{
      border: '5px solid purple',
      padding: '20px',
      margin: '20px',
      background: 'yellow',
      color: 'black',
      fontSize: '20px',
      fontWeight: 'bold'
    }}>
      <h1>🔍 캐시 디버그 테스트</h1>
      <p>버전: {version}</p>
      <p>빌드 시간: {buildTime}</p>
      <p>파일: TestDebug.jsx (새 파일)</p>
      <p style={{ color: 'red' }}>이 메시지가 보이면 새 파일은 정상 반영됨</p>
    </div>
  );
};

export default TestDebug;