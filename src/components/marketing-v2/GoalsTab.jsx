// src/components/marketing-v2/GoalsTab.jsx
import React from 'react';
import './GoalsTab.css';

const GoalsTab = ({ data, isEditMode, updateData }) => {
  const handleChange = (value) => {
    updateData('goals.memo', value);
  };
  
  return (
    <div className="goals-tab">
      <h3>마케팅 목표</h3>
      
      <div className="memo-section">
        <h4>이번 달 마케팅 목표</h4>
        {isEditMode ? (
          <textarea
            value={data.memo || ''}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={`7월 마케팅 목표:

- 여름 성수기 예약률 극대화
- 네이버 플레이스 리뷰 20건 이상 확보
- 인스타그램 팔로워 1,000명 달성
- 8월 특가 프로모션 준비
- 매출 목표: 2천만원
- 예약 목표: 50건
- 방문자 목표: 2,000명`}
            rows={20}
            className="goals-textarea"
          />
        ) : (
          <div className="memo-display">
            {data.memo ? (
              <pre>{data.memo}</pre>
            ) : (
              <p className="no-content">등록된 목표가 없습니다.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GoalsTab;