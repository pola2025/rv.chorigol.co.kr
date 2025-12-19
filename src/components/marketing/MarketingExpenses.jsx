// src/components/marketing/MarketingExpenses.jsx
import React, { useState, useEffect } from 'react';
import { 
  collection, 
  doc, 
  getDocs, 
  setDoc,
  addDoc, // addDoc 추가
  deleteDoc,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import './MarketingExpenses.css';

const MarketingExpenses = ({ selectedMonth }) => {
  const [expenses, setExpenses] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newExpense, setNewExpense] = useState({
    date: new Date().toISOString().split('T')[0],
    category: '',
    description: '',
    amount: '',
    memo: ''
  });
  const [categories] = useState([
    '광고비',
    '콘텐츠 제작',
    '인플루언서 마케팅',
    '프로모션',
    '디자인/인쇄',
    '소프트웨어 구독',
    '기타'
  ]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    loadExpenses();
  }, [selectedMonth]);

  // 지출 내역 로드
  const loadExpenses = async () => {
    try {
      setLoading(true);
      const monthKey = `${selectedMonth.year}_${String(selectedMonth.month).padStart(2, '0')}`; // _ 사용
      const expensesQuery = query(
        collection(db, 'marketing_expenses'),
        where('month', '==', monthKey),
        orderBy('date', 'desc')
      );
      
      const snapshot = await getDocs(expensesQuery);
      const expensesList = [];
      
      snapshot.forEach((doc) => {
        expensesList.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      setExpenses(expensesList);
    } catch (error) {
      console.error('지출 내역 로드 오류:', error);
      // orderBy 인덱스가 없을 경우 단순 쿼리로 재시도
      try {
        const monthKey = `${selectedMonth.year}_${String(selectedMonth.month).padStart(2, '0')}`; // _ 사용
        const snapshot = await getDocs(collection(db, 'marketing_expenses'));
        const expensesList = [];
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.month === monthKey) {
            expensesList.push({
              id: doc.id,
              ...data
            });
          }
        });
        
        // 수동 정렬
        expensesList.sort((a, b) => new Date(b.date) - new Date(a.date));
        setExpenses(expensesList);
      } catch (fallbackError) {
        console.error('지출 내역 로드 실패:', fallbackError);
      }
    } finally {
      setLoading(false);
    }
  };

  // 지출 추가/수정
  const handleSaveExpense = async () => {
    if (!newExpense.date || !newExpense.category || !newExpense.description || !newExpense.amount) {
      alert('필수 항목을 모두 입력해주세요.');
      return;
    }

    try {
      const monthKey = `${selectedMonth.year}_${String(selectedMonth.month).padStart(2, '0')}`; // _ 사용
      const expenseData = {
        ...newExpense,
        amount: parseInt(newExpense.amount.replace(/[^0-9]/g, '')),
        month: monthKey,
        updatedAt: new Date().toISOString()
      };

      if (editingId) {
        // 수정
        await setDoc(doc(db, 'marketing_expenses', editingId), expenseData);
      } else {
        // 추가 - addDoc 사용
        await addDoc(collection(db, 'marketing_expenses'), {
          ...expenseData,
          createdAt: new Date().toISOString()
        });
      }

      await loadExpenses();
      resetForm();
    } catch (error) {
      console.error('지출 저장 오류:', error);
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  // 지출 삭제
  const handleDeleteExpense = async (id) => {
    if (!window.confirm('이 지출 내역을 삭제하시겠습니까?')) return;

    try {
      await deleteDoc(doc(db, 'marketing_expenses', id));
      await loadExpenses();
    } catch (error) {
      console.error('지출 삭제 오류:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  // 지출 수정
  const handleEditExpense = (expense) => {
    setNewExpense({
      date: expense.date,
      category: expense.category,
      description: expense.description,
      amount: expense.amount.toString(),
      memo: expense.memo || ''
    });
    setEditingId(expense.id);
    setShowAddForm(true);
  };

  // 폼 리셋
  const resetForm = () => {
    setNewExpense({
      date: new Date().toISOString().split('T')[0],
      category: '',
      description: '',
      amount: '',
      memo: ''
    });
    setEditingId(null);
    setShowAddForm(false);
  };

  // 카테고리별 합계
  const getCategoryTotals = () => {
    const totals = {};
    expenses.forEach(expense => {
      if (!totals[expense.category]) {
        totals[expense.category] = 0;
      }
      totals[expense.category] += expense.amount;
    });
    return totals;
  };

  // 총 지출
  const getTotalExpenses = () => {
    return expenses.reduce((sum, expense) => sum + expense.amount, 0);
  };

  const formatMonth = (year, month) => {
    return `${year}년 ${month}월`;
  };

  const formatAmount = (value) => {
    const numValue = value.replace(/[^0-9]/g, '');
    return numValue ? parseInt(numValue).toLocaleString() : '';
  };

  return (
    <div className="marketing-expenses">
      <div className="expenses-header">
        <h3>📋 {formatMonth(selectedMonth.year, selectedMonth.month)} 마케팅 지출 내역</h3>
        <button 
          onClick={() => setShowAddForm(true)}
          className="btn-add-expense"
        >
          + 지출 추가
        </button>
      </div>

      {/* 요약 정보 */}
      <div className="expenses-summary">
        <div className="summary-card total">
          <h4>총 지출</h4>
          <div className="value">{getTotalExpenses().toLocaleString()}원</div>
        </div>
        <div className="summary-card count">
          <h4>지출 건수</h4>
          <div className="value">{expenses.length}건</div>
        </div>
        <div className="summary-card average">
          <h4>평균 지출</h4>
          <div className="value">
            {expenses.length > 0 
              ? Math.round(getTotalExpenses() / expenses.length).toLocaleString() 
              : 0}원
          </div>
        </div>
      </div>

      {/* 카테고리별 분석 */}
      <div className="category-analysis">
        <h4>카테고리별 지출</h4>
        <div className="category-grid">
          {Object.entries(getCategoryTotals()).map(([category, total]) => (
            <div key={category} className="category-item">
              <span className="category-name">{category}</span>
              <span className="category-amount">{total.toLocaleString()}원</span>
              <span className="category-percent">
                ({((total / getTotalExpenses()) * 100).toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 지출 목록 */}
      <div className="expenses-list">
        <h4>상세 내역</h4>
        {loading ? (
          <div className="loading">로딩 중...</div>
        ) : expenses.length === 0 ? (
          <div className="empty-state">
            <p>등록된 지출 내역이 없습니다.</p>
          </div>
        ) : (
          <div className="expenses-table">
            <div className="table-header">
              <div className="col-date">날짜</div>
              <div className="col-category">카테고리</div>
              <div className="col-description">내용</div>
              <div className="col-amount">금액</div>
              <div className="col-memo">메모</div>
              <div className="col-actions">관리</div>
            </div>
            {expenses.map(expense => (
              <div key={expense.id} className="table-row">
                <div className="col-date">{expense.date}</div>
                <div className="col-category">
                  <span className="category-badge">{expense.category}</span>
                </div>
                <div className="col-description">{expense.description}</div>
                <div className="col-amount">{expense.amount.toLocaleString()}원</div>
                <div className="col-memo">{expense.memo || '-'}</div>
                <div className="col-actions">
                  <button 
                    onClick={() => handleEditExpense(expense)}
                    className="btn-edit"
                    title="수정"
                  >
                    ✏️
                  </button>
                  <button 
                    onClick={() => handleDeleteExpense(expense.id)}
                    className="btn-delete"
                    title="삭제"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 지출 추가/수정 폼 */}
      {showAddForm && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="expense-form" onClick={(e) => e.stopPropagation()}>
            <div className="form-header">
              <h3>{editingId ? '지출 수정' : '지출 추가'}</h3>
              <button onClick={resetForm} className="close-btn">✕</button>
            </div>
            
            <div className="form-body">
              <div className="form-row">
                <div className="form-group">
                  <label>날짜 *</label>
                  <input
                    type="date"
                    value={newExpense.date}
                    onChange={(e) => setNewExpense({...newExpense, date: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>카테고리 *</label>
                  <select
                    value={newExpense.category}
                    onChange={(e) => setNewExpense({...newExpense, category: e.target.value})}
                  >
                    <option value="">선택하세요</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="form-group">
                <label>내용 *</label>
                <input
                  type="text"
                  value={newExpense.description}
                  onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                  placeholder="예: 네이버 키워드 광고"
                />
              </div>
              
              <div className="form-group">
                <label>금액 *</label>
                <input
                  type="text"
                  value={formatAmount(newExpense.amount)}
                  onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
                  placeholder="예: 1,000,000"
                />
              </div>
              
              <div className="form-group">
                <label>메모</label>
                <textarea
                  value={newExpense.memo}
                  onChange={(e) => setNewExpense({...newExpense, memo: e.target.value})}
                  placeholder="추가 메모 사항"
                  rows={3}
                />
              </div>
            </div>
            
            <div className="form-footer">
              <button onClick={handleSaveExpense} className="btn-save">
                {editingId ? '수정' : '저장'}
              </button>
              <button onClick={resetForm} className="btn-cancel">
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketingExpenses;
