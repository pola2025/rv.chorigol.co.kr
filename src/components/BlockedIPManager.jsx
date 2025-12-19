// src/components/BlockedIPManager.jsx
import React, { useState, useEffect } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAuth } from 'firebase/auth';
import './BlockedIPManager.css';

const BlockedIPManager = () => {
  const [blockedIPs, setBlockedIPs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const functions = getFunctions();
  const auth = getAuth();

  useEffect(() => {
    fetchBlockedIPs();
  }, []);

  const fetchBlockedIPs = async () => {
    try {
      setLoading(true);
      const token = await auth.currentUser?.getIdToken();
      
      const response = await fetch(
        `https://asia-northeast3-choho-pension.cloudfunctions.net/manageBlockedIPs`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (!response.ok) throw new Error('Failed to fetch blocked IPs');
      
      const data = await response.json();
      setBlockedIPs(data.blockedIPs || []);
    } catch (err) {
      console.error('Error fetching blocked IPs:', err);
      setError('차단된 IP 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const unblockIP = async (ip) => {
    if (!window.confirm(`정말 ${ip}의 차단을 해제하시겠습니까?`)) return;
    
    try {
      const token = await auth.currentUser?.getIdToken();
      
      const response = await fetch(
        `https://asia-northeast3-choho-pension.cloudfunctions.net/manageBlockedIPs`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ ip })
        }
      );
      
      if (!response.ok) throw new Error('Failed to unblock IP');
      
      alert('차단이 해제되었습니다.');
      fetchBlockedIPs();
    } catch (err) {
      console.error('Error unblocking IP:', err);
      alert('차단 해제에 실패했습니다.');
    }
  };

  const formatDate = (date) => {
    if (!date) return '-';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleString('ko-KR');
  };

  const getReasonBadge = (reason) => {
    const badges = {
      'Chinese IP': { text: '중국 IP', color: '#dc3545' },
      'Too many failed login attempts': { text: '로그인 실패 초과', color: '#ff9800' },
      'Manual block': { text: '수동 차단', color: '#6c757d' }
    };
    
    const badge = badges[reason] || { text: reason, color: '#6c757d' };
    
    return (
      <span 
        className="reason-badge" 
        style={{ backgroundColor: badge.color }}
      >
        {badge.text}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="blocked-ip-manager">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>차단된 IP 목록을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="blocked-ip-manager">
      <div className="manager-header">
        <h2>차단된 IP 관리</h2>
        <button onClick={fetchBlockedIPs} className="btn-refresh">
          🔄 새로고침
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="ip-stats">
        <div className="stat-card">
          <div className="stat-icon">🚫</div>
          <div className="stat-content">
            <div className="stat-value">{blockedIPs.length}</div>
            <div className="stat-label">차단된 IP</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🇨🇳</div>
          <div className="stat-content">
            <div className="stat-value">
              {blockedIPs.filter(ip => ip.reason === 'Chinese IP').length}
            </div>
            <div className="stat-label">중국 IP</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🔐</div>
          <div className="stat-content">
            <div className="stat-value">
              {blockedIPs.filter(ip => ip.reason === 'Too many failed login attempts').length}
            </div>
            <div className="stat-label">로그인 실패</div>
          </div>
        </div>
      </div>

      <div className="ip-table-container">
        <table className="ip-table">
          <thead>
            <tr>
              <th>IP 주소</th>
              <th>차단 사유</th>
              <th>차단 일시</th>
              <th>실패 횟수</th>
              <th>마지막 시도 이메일</th>
              <th>영구 차단</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            {blockedIPs.length === 0 ? (
              <tr>
                <td colSpan="7" className="empty-message">
                  차단된 IP가 없습니다.
                </td>
              </tr>
            ) : (
              blockedIPs.map((ip) => (
                <tr key={ip.id}>
                  <td className="ip-address">{ip.ip}</td>
                  <td>{getReasonBadge(ip.reason)}</td>
                  <td>{formatDate(ip.blockedAt)}</td>
                  <td className="text-center">{ip.failedAttempts || '-'}</td>
                  <td>{ip.lastFailedEmail || '-'}</td>
                  <td className="text-center">
                    {ip.permanent ? (
                      <span className="permanent-badge">✓</span>
                    ) : (
                      <span className="temporary-badge">✗</span>
                    )}
                  </td>
                  <td>
                    <button
                      onClick={() => unblockIP(ip.ip)}
                      className="btn-unblock"
                      disabled={ip.permanent && ip.reason === 'Chinese IP'}
                      title={ip.permanent && ip.reason === 'Chinese IP' ? '중국 IP는 자동으로 차단됩니다' : '차단 해제'}
                    >
                      차단 해제
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="ip-info-panel">
        <h3>📋 IP 차단 정책</h3>
        <ul>
          <li>중국 IP 대역은 자동으로 차단됩니다.</li>
          <li>10회 이상 로그인 실패 시 해당 IP가 차단됩니다.</li>
          <li>차단된 IP는 24시간 후 자동 해제되거나 관리자가 수동으로 해제할 수 있습니다.</li>
          <li>중국 IP의 경우 차단 해제를 하더라도 다시 접속 시 자동으로 차단됩니다.</li>
        </ul>
      </div>
    </div>
  );
};

export default BlockedIPManager;
