// src/components/marketing-v2/StatusTab.jsx
import React from 'react';
import './StatusTab.css';

const StatusTab = ({ data, isEditMode, updateData }) => {
  const handleChange = (value) => {
    updateData('status.memo', value);
  };
  
  return (
    <div className="status-tab">
      <h3>마케팅 현황</h3>
      
      <div className="memo-section">
        <h4>이번 달 마케팅 활동 및 현황</h4>
        {isEditMode ? (
          <textarea
            value={data.memo || ''}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={`7월 마케팅 진행 현황:

1. 네이버 광고
   - 여름 휴가 키워드 집중 운영
   - 일 예산 1만원 → 1.5만원 증액
   - 주말 입찰가 20% 상향 조정

2. SNS 마케팅
   - 인스타그램 리뉴얼 사진 업로드 (주 3회)
   - 고객 후기 스토리 공유
   - 팔로워 이벤트 진행 (7/15~7/31)

3. 제휴 마케팅
   - 지역 카페와 상호 홍보 협약
   - 블로거 체험단 3팀 진행

4. 특이사항
   - 7/20 네이버 플레이스 베스트 리뷰 선정
   - 경쟁 펜션 가격 인하로 예약 경쟁 심화`}
            rows={25}
            className="status-textarea"
          />
        ) : (
          <div className="memo-display">
            {data.memo ? (
              <pre>{data.memo}</pre>
            ) : (
              <p className="no-content">등록된 현황이 없습니다.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatusTab;