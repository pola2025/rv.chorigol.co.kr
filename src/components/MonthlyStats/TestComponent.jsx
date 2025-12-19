import React, { useEffect } from 'react';

const TestComponent = () => {
  console.log('TestComponent 렌더링');
  
  useEffect(() => {
    console.log('TestComponent useEffect 실행');
  }, []);
  
  return (
    <div style={{ padding: 20, background: 'yellow', border: '2px solid red' }}>
      <h1>테스트 컴포넌트</h1>
      <p>이 컴포넌트가 보이면 렌더링이 정상적으로 작동합니다.</p>
    </div>
  );
};

export default TestComponent;