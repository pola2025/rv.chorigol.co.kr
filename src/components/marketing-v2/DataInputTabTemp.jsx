// src/components/marketing-v2/DataInputTabTemp.jsx
// 임시 데이터 입력 탭 - 오류 방지용
import React, { useState } from 'react';
import './DataInputTab.css';

const DataInputTabTemp = () => {
  const [showMessage] = useState(true);

  return (
    <div className="data-input-tab">
      <div style={{
        padding: '50px',
        textAlign: 'center',
        background: '#f8f9fa',
        borderRadius: '10px',
        margin: '20px'
      }}>
        <h2>📊 데이터 입력 기능 업그레이드 중</h2>
        <p style={{ color: '#666', marginTop: '20px', fontSize: '16px' }}>
          더 안정적이고 효율적인 데이터 관리를 위해<br/>
          클린 아키텍처 기반으로 시스템을 개선하고 있습니다.
        </p>
        
        <div style={{
          marginTop: '30px',
          padding: '20px',
          background: '#e3f2fd',
          borderRadius: '8px',
          border: '1px solid #90caf9'
        }}>
          <h3>🔧 개선 사항</h3>
          <ul style={{ textAlign: 'left', marginTop: '15px', lineHeight: '1.8' }}>
            <li>Firebase 400 오류 완전 해결</li>
            <li>데이터 검증 강화</li>
            <li>저장 속도 개선</li>
            <li>에러 복구 기능 추가</li>
          </ul>
        </div>

        <div style={{
          marginTop: '30px',
          padding: '15px',
          background: '#fff3e0',
          borderRadius: '8px',
          border: '1px solid #ffcc80'
        }}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>
            📅 예상 완료: 2025년 1월 12일
          </p>
          <p style={{ margin: '10px 0 0 0', fontSize: '14px', color: '#666' }}>
            기존 데이터는 모두 안전하게 보관되어 있습니다.
          </p>
        </div>

        <div style={{ marginTop: '30px' }}>
          <button 
            className="btn-primary"
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 30px',
              fontSize: '16px',
              background: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            새로고침
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataInputTabTemp;