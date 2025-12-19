// src/components/SMSDashboard.jsx
import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, getDocs, addDoc, updateDoc, doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';
import sensService from '../services/sensService';
import './SMSDashboard.css';

const SMSDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedProperty, setSelectedProperty] = useState('all'); // all, choho, shelter
  
  // SMS 로그 데이터
  const [smsLogs, setSmsLogs] = useState([]);
  const [stats, setStats] = useState({
    today: { sent: 0, failed: 0, cost: 0 },
    week: { sent: 0, failed: 0, cost: 0 },
    month: { sent: 0, failed: 0, cost: 0 }
  });
  
  // 템플릿 데이터
  const [templates, setTemplates] = useState({
    choho: {
      checkIn: { name: '입실 안내', content: '', enabled: true },
      checkOut: { name: '퇴실 안내', content: '', enabled: true },
      confirmation: { name: '예약 확정', content: '', enabled: true },
      cancellation: { name: '예약 취소', content: '', enabled: false }
    },
    shelter: {
      checkIn: { name: '입실 안내', content: '', enabled: true },
      checkOut: { name: '퇴실 안내', content: '', enabled: true },
      confirmation: { name: '예약 확정', content: '', enabled: true },
      cancellation: { name: '예약 취소', content: '', enabled: false }
    }
  });
  
  // 대량 발송 설정
  const [bulkSendConfig, setBulkSendConfig] = useState({
    recipients: 'today_checkin',
    message: '',
    sendTime: 'immediate',
    scheduledTime: ''
  });
  
  // 예약 데이터 (대량 발송용)
  const [reservations, setReservations] = useState([]);
  
  // 초기 데이터 로드
  useEffect(() => {
    loadSMSLogs();
    loadTemplates();
    loadReservations();
  }, [selectedMonth, selectedProperty]);
  
  // SMS 로그 불러오기
  const loadSMSLogs = async () => {
    setLoading(true);
    try {
      const startDate = new Date(selectedMonth + '-01');
      const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
      
      let q = query(
        collection(db, 'notification_logs'),
        where('type', 'in', ['sms_reservation', 'sms_cancellation', 'sms_checkin', 'sms_checkout']),
        where('sentAt', '>=', startDate),
        where('sentAt', '<=', endDate),
        orderBy('sentAt', 'desc'),
        limit(100)
      );
      
      if (selectedProperty !== 'all') {
        const propertyName = selectedProperty === 'choho' ? '초호펜션' : '초호쉼터';
        q = query(q, where('property', '==', propertyName));
      }
      
      const snapshot = await getDocs(q);
      const logs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        sentAt: doc.data().sentAt?.toDate()?.toLocaleString('ko-KR') || ''
      }));
      
      setSmsLogs(logs);
      calculateStats(logs);
    } catch (error) {
      console.error('SMS 로그 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // 통계 계산
  const calculateStats = (logs) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const todayLogs = logs.filter(log => new Date(log.sentAt) >= today);
    const weekLogs = logs.filter(log => new Date(log.sentAt) >= weekAgo);
    const monthLogs = logs.filter(log => new Date(log.sentAt) >= monthAgo);
    
    setStats({
      today: {
        sent: todayLogs.filter(l => l.status === 'success').length,
        failed: todayLogs.filter(l => l.status === 'failed').length,
        cost: todayLogs.filter(l => l.status === 'success').length * 20
      },
      week: {
        sent: weekLogs.filter(l => l.status === 'success').length,
        failed: weekLogs.filter(l => l.status === 'failed').length,
        cost: weekLogs.filter(l => l.status === 'success').length * 20
      },
      month: {
        sent: monthLogs.filter(l => l.status === 'success').length,
        failed: monthLogs.filter(l => l.status === 'failed').length,
        cost: monthLogs.filter(l => l.status === 'success').length * 20
      }
    });
  };
  
  // 템플릿 불러오기
  const loadTemplates = async () => {
    try {
      // 초호펜션 템플릿
      const chohoDoc = await getDoc(doc(db, 'settings', 'sms_templates_choho'));
      if (chohoDoc.exists()) {
        setTemplates(prev => ({ ...prev, choho: chohoDoc.data() }));
      }
      
      // 초호쉼터 템플릿
      const shelterDoc = await getDoc(doc(db, 'settings', 'sms_templates_shelter'));
      if (shelterDoc.exists()) {
        setTemplates(prev => ({ ...prev, shelter: shelterDoc.data() }));
      }
    } catch (error) {
      console.error('템플릿 로드 실패:', error);
    }
  };
  
  // 예약 데이터 불러오기
  const loadReservations = async () => {
    try {
      const snapshot = await getDocs(
        query(
          collection