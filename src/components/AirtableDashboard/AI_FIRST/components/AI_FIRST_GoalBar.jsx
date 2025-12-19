/**
 * AI_FIRST_GoalBar.jsx
 * 목표 설정 바 컴포넌트 (선언형)
 * useEffect 없이 CSS 애니메이션 활용
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useGoals } from '../hooks/AI_FIRST_hooks';
import { useCountUp, useIntersectionObserver } from '../hooks/AI_FIRST_utilHooks';
import '../styles/AI_FIRST_GoalBar.css';

/**
 * 목표 아이템 컴포넌트
 */
const GoalItem = ({ 
  label, 
  current, 
  target, 
  unit = '', 
  format = 'number',
  color = '#667eea' 
}) => {
  const { targetRef, isIntersecting } = useIntersectionObserver({ threshold: 0.1 });
  
  // 달성률 계산
  const achievement = useMemo(() => {
    if (!target || target === 0) return 0;
    const rate = (current / target) * 100;
    return Math.min(rate, 100);
  }, [current, target]);
  
  // 상태 계산
  const status = useMemo(() => {
    if (achievement >= 100) return { label: '달성', color: '#28a745', icon: '🎉' };
    if (achievement >= 80) return { label: '임박', color: '#ffc107', icon: '⚡' };
    if (achievement >= 50) return { label: '진행중', color: '#17a2b8', icon: '📈' };
    return { label: '시작', color: '#6c757d', icon: '🎯' };
  }, [achievement]);
  
  // 포맷팅
  const formattedCurrent = useMemo(() => {
    const value = Number(current) || 0;
    switch (format) {
      case 'currency':
        return `₩${new Intl.NumberFormat('ko-KR').format(value)}`;
      case 'percent':
        return `${value.toFixed(2)}%`;
      default:
        return new Intl.NumberFormat('ko-KR').format(value);
    }
  }, [current, format]);
  
  const formattedTarget = useMemo(() => {
    const value = Number(target) || 0;
    switch (format) {
      case 'currency':
        return `₩${new Intl.NumberFormat('ko-KR').format(value)}`;
      case 'percent':
        return `${value.toFixed(2)}%`;
      default:
        return new Intl.NumberFormat('ko-KR').format(value);
    }
  }, [target, format]);
  
  // 애니메이션 값
  const { count, startAnimation } = useCountUp(achievement, 1500);
  
  // 뷰포트 진입 시 애니메이션 시작
  useMemo(() => {
    if (isIntersecting) {
      startAnimation();
    }
  }, [isIntersecting, startAnimation]);
  
  return (
    <div className="goal-item" ref={targetRef}>
      <div className="goal-header">
        <div className="goal-label">
          <span className="goal-icon">{status.icon}</span>
          <span>{label}</span>
        </div>
        <div className="goal-status" style={{ color: status.color }}>
          {status.label}
        </div>
      </div>
      
      <div className="goal-progress">
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ 
              width: isIntersecting ? `${count}%` : '0%',
              background: `linear-gradient(90deg, ${color}, ${color}dd)`
            }}
          >
            <span className="progress-label">
              {count.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
      
      <div className="goal-values">
        <div className="current-value">
          <span className="value-label">현재</span>
          <span className="value-number">{formattedCurrent}</span>
        </div>
        <div className="separator">/</div>
        <div className="target-value">
          <span className="value-label">목표</span>
          <span className="value-number">{formattedTarget}</span>
        </div>
      </div>
    </div>
  );
};

/**
 * 목표 편집 모달
 */
const GoalEditModal = ({ isOpen, onClose, onSave, currentGoals }) => {
  const [editedGoals, setEditedGoals] = useState(currentGoals);
  
  // 입력 핸들러
  const handleChange = useCallback((key, value) => {
    setEditedGoals(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);
  
  // 저장 핸들러
  const handleSave = useCallback(() => {
    onSave(editedGoals);
    onClose();
  }, [editedGoals, onSave, onClose]);
  
  if (!isOpen) return null;
  
  return (
    <div className="goal-modal-overlay" onClick={onClose}>
      <div className="goal-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>목표 설정</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="goal-input-group">
            <label>CTR 목표 (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={editedGoals.ctr || ''}
              onChange={(e) => handleChange('ctr', parseFloat(e.target.value))}
              placeholder="예: 3.5"
            />
          </div>
          
          <div className="goal-input-group">
            <label>클릭수 목표</label>
            <input
              type="number"
              min="0"
              value={editedGoals.clicks || ''}
              onChange={(e) => handleChange('clicks', parseInt(e.target.value))}
              placeholder="예: 1000"
            />
          </div>
          
          <div className="goal-input-group">
            <label>광고비 목표</label>
            <input
              type="number"
              min="0"
              value={editedGoals.adCost || ''}
              onChange={(e) => handleChange('adCost', parseInt(e.target.value))}
              placeholder="예: 500000"
            />
          </div>
          
          <div className="goal-input-group">
            <label>방문자 목표</label>
            <input
              type="number"
              min="0"
              value={editedGoals.visitors || ''}
              onChange={(e) => handleChange('visitors', parseInt(e.target.value))}
              placeholder="예: 5000"
            />
          </div>
          
          <div className="goal-input-group">
            <label>메모</label>
            <textarea
              rows="3"
              value={editedGoals.memo || ''}
              onChange={(e) => handleChange('memo', e.target.value)}
              placeholder="목표 달성을 위한 전략이나 메모..."
            />
          </div>
        </div>
        
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>취소</button>
          <button className="btn-save" onClick={handleSave}>저장</button>
        </div>
      </div>
    </div>
  );
};

/**
 * 목표 인사이트 컴포넌트
 */
const GoalInsights = ({ currentData, goals }) => {
  // 인사이트 계산
  const insights = useMemo(() => {
    if (!currentData || !goals) return [];
    
    const results = [];
    
    // CTR 인사이트
    if (goals.ctr && currentData.ctr) {
      const ctrGap = goals.ctr - currentData.ctr;
      if (ctrGap > 0) {
        results.push({
          type: 'improvement',
          metric: 'CTR',
          message: `CTR을 ${ctrGap.toFixed(2)}% 더 개선해야 합니다.`,
          priority: 'high'
        });
      } else {
        results.push({
          type: 'success',
          metric: 'CTR',
          message: `CTR 목표를 ${Math.abs(ctrGap).toFixed(2)}% 초과 달성했습니다!`,
          priority: 'low'
        });
      }
    }
    
    // 클릭수 인사이트
    if (goals.clicks && currentData.clicks) {
      const clickRate = (currentData.clicks / goals.clicks) * 100;
      if (clickRate < 50) {
        results.push({
          type: 'warning',
          metric: '클릭수',
          message: `현재 목표의 ${clickRate.toFixed(0)}%만 달성. 광고 최적화가 필요합니다.`,
          priority: 'high'
        });
      }
    }
    
    // 광고비 효율 인사이트
    if (goals.adCost && currentData.adCost) {
      const costEfficiency = currentData.adCost / goals.adCost;
      if (costEfficiency > 1.2) {
        results.push({
          type: 'alert',
          metric: '광고비',
          message: `예산을 ${((costEfficiency - 1) * 100).toFixed(0)}% 초과 사용 중입니다.`,
          priority: 'high'
        });
      }
    }
    
    return results.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }, [currentData, goals]);
  
  if (insights.length === 0) return null;
  
  return (
    <div className="goal-insights">
      <h4 className="insights-title">💡 목표 달성 인사이트</h4>
      <div className="insights-list">
        {insights.map((insight, index) => (
          <div 
            key={index} 
            className={`insight-item ${insight.type}`}
          >
            <span className="insight-icon">
              {insight.type === 'success' ? '✅' : 
               insight.type === 'warning' ? '⚠️' : 
               insight.type === 'alert' ? '🚨' : 'ℹ️'}
            </span>
            <span className="insight-message">{insight.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * 목표 설정 바 메인 컴포넌트
 */
const AI_FIRST_GoalBar = ({ year, month, currentData }) => {
  // 목표 관리 훅 사용
  const { currentGoal, saveGoal, goalHistory } = useGoals(year, month);
  
  // 편집 모달 상태
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // 목표 데이터 파싱
  const goals = useMemo(() => {
    try {
      return typeof currentGoal === 'string' 
        ? JSON.parse(currentGoal) 
        : currentGoal || {};
    } catch {
      return {};
    }
  }, [currentGoal]);
  
  // 전체 달성률 계산
  const overallAchievement = useMemo(() => {
    if (!currentData || Object.keys(goals).length === 0) return 0;
    
    let totalScore = 0;
    let count = 0;
    
    if (goals.ctr && currentData.ctr) {
      totalScore += Math.min((currentData.ctr / goals.ctr) * 100, 100);
      count++;
    }
    if (goals.clicks && currentData.clicks) {
      totalScore += Math.min((currentData.clicks / goals.clicks) * 100, 100);
      count++;
    }
    if (goals.adCost && currentData.adCost) {
      // 광고비는 적을수록 좋으므로 반대로 계산
      totalScore += Math.min((goals.adCost / currentData.adCost) * 100, 100);
      count++;
    }
    if (goals.visitors && currentData.visitors) {
      totalScore += Math.min((currentData.visitors / goals.visitors) * 100, 100);
      count++;
    }
    
    return count > 0 ? totalScore / count : 0;
  }, [currentData, goals]);
  
  // 목표 저장 핸들러
  const handleSaveGoals = useCallback((newGoals) => {
    saveGoal(JSON.stringify(newGoals));
  }, [saveGoal]);
  
  // 목표가 설정되지 않은 경우
  if (Object.keys(goals).length === 0) {
    return (
      <div className="ai-first-goal-bar empty">
        <div className="empty-state">
          <span className="empty-icon">🎯</span>
          <p>{year}년 {month}월 목표가 설정되지 않았습니다.</p>
          <button 
            className="btn-set-goal"
            onClick={() => setIsEditModalOpen(true)}
          >
            목표 설정하기
          </button>
        </div>
        
        <GoalEditModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSave={handleSaveGoals}
          currentGoals={goals}
        />
      </div>
    );
  }
  
  return (
    <div className="ai-first-goal-bar">
      <div className="goal-bar-header">
        <div className="header-left">
          <h3 className="goal-bar-title">
            🎯 {year}년 {month}월 목표 달성 현황
          </h3>
          <div className="overall-achievement">
            <span className="achievement-label">전체 달성률</span>
            <span className="achievement-value" style={{
              color: overallAchievement >= 80 ? '#28a745' : 
                     overallAchievement >= 50 ? '#ffc107' : '#dc3545'
            }}>
              {overallAchievement.toFixed(1)}%
            </span>
          </div>
        </div>
        
        <button 
          className="btn-edit-goal"
          onClick={() => setIsEditModalOpen(true)}
        >
          목표 수정
        </button>
      </div>
      
      <div className="goal-items-grid">
        {goals.ctr && (
          <GoalItem
            label="CTR"
            current={currentData?.ctr}
            target={goals.ctr}
            unit="%"
            format="percent"
            color="#667eea"
          />
        )}
        
        {goals.clicks && (
          <GoalItem
            label="클릭수"
            current={currentData?.clicks}
            target={goals.clicks}
            format="number"
            color="#28a745"
          />
        )}
        
        {goals.adCost && (
          <GoalItem
            label="광고비"
            current={currentData?.adCost}
            target={goals.adCost}
            format="currency"
            color="#ffc107"
          />
        )}
        
        {goals.visitors && (
          <GoalItem
            label="방문자"
            current={currentData?.visitors}
            target={goals.visitors}
            format="number"
            color="#17a2b8"
          />
        )}
      </div>
      
      {goals.memo && (
        <div className="goal-memo">
          <span className="memo-icon">📝</span>
          <p>{goals.memo}</p>
        </div>
      )}
      
      <GoalInsights currentData={currentData} goals={goals} />
      
      {goalHistory.length > 0 && (
        <div className="goal-history">
          <h4>최근 목표 이력</h4>
          <div className="history-list">
            {goalHistory.slice(0, 3).map((item, index) => (
              <div key={index} className="history-item">
                <span className="history-date">
                  {item.year}년 {item.month}월
                </span>
                <span className="history-achievement">
                  {/* 실제 달성률 계산 필요 */}
                  -
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <GoalEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSaveGoals}
        currentGoals={goals}
      />
    </div>
  );
};

export default AI_FIRST_GoalBar;
