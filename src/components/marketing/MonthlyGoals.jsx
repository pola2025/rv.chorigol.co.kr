// src/components/marketing/MonthlyGoals.jsx
import React, { useState, useEffect } from 'react';
import './MonthlyGoals.css';

const MonthlyGoals = ({ selectedMonth, goal, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempGoal, setTempGoal] = useState(goal);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setTempGoal(goal);
  }, [goal]);

  const handleSave = async () => {
    setIsSaving(true);
    const success = await onSave(tempGoal);
    if (success) {
      setIsEditing(false);
    }
    setIsSaving(false);
  };

  const handleCancel = () => {
    setTempGoal(goal);
    setIsEditing(false);
  };

  const formatMonth = (year, month) => {
    return `${year}년 ${month}월`;
  };

  return (
    <div className="monthly-goals">
      <div className="goals-header">
        <h3>
          📌 {formatMonth(selectedMonth.year, selectedMonth.month)} 목표
        </h3>
        {!isEditing && (
          <button 
            onClick={() => setIsEditing(true)}
            className="edit-btn"
            title="목표 편집"
          >
            ✏️
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="goals-edit">
          <textarea
            value={tempGoal}
            onChange={(e) => setTempGoal(e.target.value)}
            placeholder="이번 달 마케팅 목표를 입력하세요..."
            rows={3}
            autoFocus
          />
          <div className="edit-actions">
            <button 
              onClick={handleSave}
              className="btn-save"
              disabled={isSaving}
            >
              {isSaving ? '저장 중...' : '저장'}
            </button>
            <button 
              onClick={handleCancel}
              className="btn-cancel"
              disabled={isSaving}
            >
              취소
            </button>
          </div>
        </div>
      ) : (
        <div className="goals-display">
          {goal ? (
            <p>{goal}</p>
          ) : (
            <p className="no-goal">
              목표를 설정하려면 편집 버튼을 클릭하세요.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default MonthlyGoals;
