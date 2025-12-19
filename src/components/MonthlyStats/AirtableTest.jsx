import React, { useState, useEffect } from 'react';
import airtableService from '../../services/airtableService';

const AirtableTest = () => {
  const [loading, setLoading] = useState(true);
  const [schema, setSchema] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    testAirtableConnection();
  }, []);

  const testAirtableConnection = async () => {
    console.log('[AirtableTest] 에어테이블 연결 테스트 시작');
    
    try {
      setLoading(true);
      setError(null);
      
      // 에어테이블 스키마 가져오기
      const statsSchema = await airtableService.getStatsSchema();
      console.log('[AirtableTest] 스키마 로드 성공:', statsSchema);
      
      setSchema(statsSchema);
    } catch (err) {
      console.error('[AirtableTest] 에러:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>에어테이블 연결 테스트 중...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: 20, background: '#fee', border: '1px solid #f00', borderRadius: 8 }}>
        <h3>에어테이블 연결 실패</h3>
        <p>{error}</p>
        <button onClick={testAirtableConnection}>다시 시도</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, background: '#efe', border: '1px solid #0a0', borderRadius: 8 }}>
      <h3>에어테이블 연결 성공!</h3>
      <p>스키마 필드 수: {schema?.length || 0}개</p>
      
      <div style={{ marginTop: 20 }}>
        <h4>필드 목록:</h4>
        <ul>
          {schema?.map((field, index) => (
            <li key={index}>
              <strong>{field.displayName}</strong> ({field.fieldName})
              - 카테고리: {field.category}
              - 타입: {field.type}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default AirtableTest;