// src/utils/firebaseReconnect.js - Firebase 재연결 관리
import { enableNetwork, disableNetwork } from 'firebase/firestore';
import { db } from '../config/firebase';

class FirebaseReconnectManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // 1초부터 시작
    
    this.setupListeners();
  }

  setupListeners() {
    // 네트워크 상태 감지
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
    
    // 페이지 포커스 시 재연결
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    window.addEventListener('focus', this.handleFocus.bind(this));
  }

  async handleOnline() {
    console.log('Network is online, reconnecting to Firebase...');
    this.isOnline = true;
    await this.reconnect();
  }

  async handleOffline() {
    console.log('Network is offline');
    this.isOnline = false;
    this.clearReconnectTimer();
    
    try {
      await disableNetwork(db);
    } catch (error) {
      console.error('Error disabling network:', error);
    }
  }

  async handleVisibilityChange() {
    if (document.visibilityState === 'visible' && this.isOnline) {
      console.log('Page became visible, checking Firebase connection...');
      await this.reconnect();
    }
  }

  async handleFocus() {
    if (this.isOnline) {
      console.log('Window focused, checking Firebase connection...');
      await this.reconnect();
    }
  }

  async reconnect() {
    this.clearReconnectTimer();
    
    try {
      await enableNetwork(db);
      console.log('Successfully reconnected to Firebase');
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      return true;
    } catch (error) {
      console.error('Failed to reconnect:', error);
      
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      } else {
        console.error('Max reconnection attempts reached');
        // 사용자에게 알림
        this.notifyReconnectFailed();
      }
      
      return false;
    }
  }

  scheduleReconnect() {
    this.reconnectAttempts++;
    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${this.reconnectDelay}ms`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnect();
    }, this.reconnectDelay);
    
    // 지수 백오프
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000); // 최대 30초
  }

  clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  notifyReconnectFailed() {
    // 재연결 실패 시 사용자에게 알림
    const event = new CustomEvent('firebase-reconnect-failed', {
      detail: { attempts: this.reconnectAttempts }
    });
    window.dispatchEvent(event);
  }

  // 수동 재연결 시도
  async manualReconnect() {
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;
    return await this.reconnect();
  }

  destroy() {
    this.clearReconnectTimer();
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('focus', this.handleFocus);
  }
}

// 싱글톤 인스턴스
let reconnectManager = null;

export const initializeReconnectManager = () => {
  if (!reconnectManager) {
    reconnectManager = new FirebaseReconnectManager();
  }
  return reconnectManager;
};

export const getReconnectManager = () => {
  return reconnectManager;
};

export default { initializeReconnectManager, getReconnectManager };
