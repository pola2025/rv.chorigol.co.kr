// Dashboard.jsx - 선언형 마이그레이션 버전
// useEffect 완전 제거, React Query 기반
import React, { useState, useMemo, lazy, Suspense } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

// 핵심 컴포넌트 (즉시 로드)
import ReservationCalendar from './ReservationCalendar';
import BookingModal from './BookingModal';
import NewReservationModal from '../common/NewReservationModal';
import DateDetailPanel from './DateDetailPanel';
import MobileMenu from './MobileMenu';
import MobileBottomNav from './MobileBottomNav';

// 레이지 로딩 컴포넌트 (탭별 분리)
const OptionsSettings = lazy(() => import('./OptionsSettings'));
const PricingSettings = lazy(() => import('./PricingSettings'));
const RoomManagement = lazy(() => import('./RoomManagement'));
const ReservationList = lazy(() => import('./ReservationList'));
const BlockedIPManager = lazy(() => import('./BlockedIPManager'));
const NotificationSettingsV2 = lazy(() => import('./NotificationSettingsV2'));
const MessageTemplates = lazy(() => import('./MessageTemplates'));
const MonthlyStatsInput = lazy(() => import('./MonthlyStats/MonthlyStatsInput'));
const IntegratedStatsView = lazy(() => import('./MonthlyStats/IntegratedStatsView'));
const TestComponent = lazy(() => import('./MonthlyStats/TestComponent'));
const AirtableDashboard = lazy(() => import('./AirtableDashboard/AirtableDashboard'));
import { PerformanceMonitor } from './PerformanceMonitor';
import { useDerivedState } from '../application/hooks/useReactiveState';
import notificationService from '../services/notificationService'; // 알림 서비스 추가
import SpotlightCard from './SpotlightCard'; // React Bits 스포트라이트 효과
import AnimatedCounter, { CurrencyCounter, PercentCounter } from './AnimatedCounter'; // React Bits 카운트업 효과
import { TabTransition } from './PageTransition'; // 탭 전환 애니메이션
import Skeleton, { CardSkeleton } from './Skeleton'; // 로딩 스켈레톤

// 레이지 로딩 fallback
const LazyFallback = () => (
  <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
    <Skeleton width="200px" height="2rem" />
    <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
      <CardSkeleton hasImage={false} />
      <CardSkeleton hasImage={false} />
      <CardSkeleton hasImage={false} />
    </div>
  </div>
);
import {
  CalendarIcon,
  DashboardIcon,
  InventoryIcon,
  BookingIcon,
  RoomIcon,
  PriceIcon,
  OptionsIcon,
  ChartIcon,
  CustomerIcon,
  MenuIcon
} from './Icons';
import { 
  useReservations, 
  useAddReservation,
  useUpdateReservation,
  useCancelReservation,
  useConfirmReservation,
  useReservationStatistics,
  useAvailableStock
} from '../hooks/useReservations';
import { useRooms } from '../hooks/useRooms';
import { useOptions, usePricingRules, useBlockedDates } from '../hooks/useOptions';
import useFirebaseStore from '../stores/useFirebaseStore';
import useReservationStore from '../stores/useReservationStore';
import telegramService from '../services/telegramService';
import './Dashboard.css';

// 디버그 시스템 import
import migrationDebugger, { DEBUG_LEVELS } from '../utils/migrationDebugger';
import '../utils/debugPanel.css';

// 선언형 훅 import
import { useWindowEvent, useDeclarativeFetch } from '../hooks/useDeclarative';

// 탭 구성 - 모던 아이콘 사용
const TABS = [
  { id: 'calendar', label: '예약 캘린더', Icon: CalendarIcon },
  { id: 'reservations', label: '예약 목록', Icon: BookingIcon },
  { id: 'rooms', label: '객실 관리', Icon: RoomIcon },
  { id: 'pricing', label: '가격 설정', Icon: PriceIcon },
  { id: 'options', label: '옵션 설정', Icon: OptionsIcon },
  { id: 'notifications', label: '알림 설정', Icon: CustomerIcon },
  { id: 'airtableStats', label: '광고 효율 분석', Icon: ChartIcon },
  { id: 'security', label: '보안 관리', Icon: OptionsIcon },
];

// 통계 카드 컴포넌트 - React Bits SpotlightCard + AnimatedCounter 적용
const StatCard = ({ title, value, icon, trend, valueType = 'number' }) => {
  // 값 렌더링 함수
  const renderValue = () => {
    // 숫자인 경우 애니메이션 카운터 적용
    if (typeof value === 'number') {
      switch (valueType) {
        case 'currency':
          return <CurrencyCounter value={value} duration={1.5} />;
        case 'percent':
          return <PercentCounter value={value} duration={1.5} />;
        default:
          return <AnimatedCounter value={value} duration={1.5} />;
      }
    }
    // 문자열이지만 숫자 형식인 경우 (예: "1,234")
    if (typeof value === 'string' && /^[\d,.\s₩%]+$/.test(value)) {
      const numericValue = parseFloat(value.replace(/[^0-9.-]/g, ''));
      if (!isNaN(numericValue)) {
        if (value.includes('₩')) {
          return <CurrencyCounter value={numericValue} duration={1.5} />;
        }
        if (value.includes('%')) {
          return <PercentCounter value={numericValue} duration={1.5} />;
        }
        return <AnimatedCounter value={numericValue} duration={1.5} />;
      }
    }
    // 그 외의 경우 그대로 표시
    return value;
  };

  return (
    <SpotlightCard
      className="stat-card"
      spotlightColor="rgba(16, 185, 129, 0.12)"
      spotlightSize={200}
    >
      <div className="stat-icon">{icon}</div>
      <div className="stat-content">
        <h3>{title}</h3>
        <p className="stat-value">{renderValue()}</p>
        {trend && (
          <span className={`stat-trend ${trend > 0 ? 'positive' : 'negative'}`}>
            {trend > 0 ? '↑' : '↓'} <AnimatedCounter value={Math.abs(trend)} duration={1} decimals={1} suffix="%" />
          </span>
        )}
      </div>
    </SpotlightCard>
  );
};

// 메인 대시보드 컴포넌트
const Dashboard = ({ user, onLogout }) => {
  // 디버그 시작
  console.log('✅ Dashboard 컴포넌트 로드됨 - ', new Date().toLocaleString());
  migrationDebugger.startPerformance('Dashboard');
  migrationDebugger.log(DEBUG_LEVELS.INFO, 'Dashboard', 'Component initialized', { user: user?.email });

  const [activeTab, setActiveTab] = useState('calendar');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [isDatePanelOpen, setIsDatePanelOpen] = useState(false);
  const [newReservationInitialData, setNewReservationInitialData] = useState({});
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // 🔄 MIGRATION: useEffect 제거, React Query로 교체
  // Before: useEffect로 window 크기 감지
  // After: useQuery로 선언형 처리
  const { data: windowWidth } = useQuery({
    queryKey: ['windowWidth'],
    queryFn: () => window.innerWidth,
    staleTime: Infinity,
    initialData: window.innerWidth
  });

  // React Query 클라이언트
  const queryClient = useQueryClient();
  
  // 🔄 MIGRATION: resize 이벤트 리스너 선언형 처리
  useWindowEvent('resize', () => {
    migrationDebugger.log(DEBUG_LEVELS.TRACE, 'Dashboard', 'Window resized', { width: window.innerWidth });
    // React Query 캐시 업데이트
    queryClient.setQueryData(['windowWidth'], window.innerWidth);
  });

  // 🔄 MIGRATION: changeTab 이벤트 리스너 선언형 처리
  useWindowEvent('changeTab', (event) => {
    migrationDebugger.log(DEBUG_LEVELS.DEBUG, 'Dashboard', 'Tab changed', { tab: event.detail });
    setActiveTab(event.detail);
  });
  
  const isMobile = useMemo(() => windowWidth < 768, [windowWidth]);
  
  // 데이터 훅
  const { data: rooms, isLoading: roomsLoading } = useRooms();
  const { data: reservations, isLoading: reservationsLoading } = useReservations();
  const { data: options } = useOptions();
  const { data: pricingRules } = usePricingRules();
  const { data: blockedDates } = useBlockedDates();
  const statistics = useReservationStatistics();
  const { getAvailableStock } = useAvailableStock();
  
  // Firebase 스토어에서 직접 가져오기
  const overrides = useFirebaseStore((state) => state.overrides);
  const isLoading = useFirebaseStore((state) => state.isLoading());
  
  // 액션 훅
  const { mutateAsync: addReservation } = useAddReservation();
  const { mutateAsync: updateReservation } = useUpdateReservation();
  const { mutateAsync: cancelReservation } = useCancelReservation();
  const { mutateAsync: confirmReservation } = useConfirmReservation();
  const { updateInventoryOverride, createReservationWithInventoryCheck } = useReservationStore();

  // 디버그: 데이터 로딩 상태 추적
  if (roomsLoading || reservationsLoading) {
    migrationDebugger.markPerformance('Dashboard', 'Data loading');
  }

  // 예약 추가 핸들러 - 트랜잭션 기반
  const handleAddNewReservation = async (reservationData) => {
    console.log('🆕 [DEBUG] 새 예약 추가 시작:', reservationData);
    migrationDebugger.log(DEBUG_LEVELS.INFO, 'Dashboard', 'Adding new reservation', reservationData);
    migrationDebugger.startPerformance('AddReservation');

    try {
      // 트랜잭션 기반 예약 생성으로 재고 정확성 보장
      const result = await createReservationWithInventoryCheck(reservationData);
      
      if (result.success) {
        console.log('🆕 [DEBUG] 예약 추가 성공:', result);
        migrationDebugger.log(DEBUG_LEVELS.INFO, 'Dashboard', 'Reservation added successfully', result);
        setIsNewModalOpen(false);
        setNewReservationInitialData({});

        // 예약 추가 성공 메시지
        alert('예약이 추가되었습니다.');
        // 알림 발송은 useReservationStore에서 자동 처리됨
      } else {
        migrationDebugger.log(DEBUG_LEVELS.ERROR, 'Dashboard', 'Reservation failed', result.error);
        alert(result.error || '예약 추가에 실패했습니다.');
      }
    } catch (error) {
      migrationDebugger.log(DEBUG_LEVELS.ERROR, 'Dashboard', 'Reservation error', error);
      alert('예약 추가 중 오류가 발생했습니다.');
    } finally {
      migrationDebugger.endPerformance('AddReservation');
    }
  };

  // 🔄 MIGRATION: 알림 처리를 선언형으로 분리
  const handleNotifications = async (reservationData, type) => {
    try {
      console.log('🟡 [NOTIFICATION] handleNotifications 시작');
      console.log('🟡 [NOTIFICATION] 타입:', type);
      console.log('🟡 [NOTIFICATION] 데이터:', JSON.stringify({
        id: reservationData.id,
        customerName: reservationData.customerName,
        roomName: reservationData.roomName || reservationData.room,
        source: reservationData.source,
        cancelReason: reservationData.cancelReason,
        refundAmount: reservationData.refundAmount,
        refundRate: reservationData.refundRate,
        cancellationFee: reservationData.cancellationFee
      }, null, 2));
      
      // notificationService 초기화 확인
      console.log('🟡 [NOTIFICATION] notificationService 타입:', typeof notificationService);
      console.log('🟡 [NOTIFICATION] notificationService.initialize 타입:', typeof notificationService?.initialize);
      console.log('🟡 [NOTIFICATION] notificationService.sendCancellationNotifications 타입:', typeof notificationService?.sendCancellationNotifications);
      
      // notificationService 초기화
      console.log('🟡 [NOTIFICATION] notificationService 초기화 시작');
      await notificationService.initialize();
      console.log('🟡 [NOTIFICATION] notificationService 초기화 완료');
      
      // 예약 확정 알림
      if (type === 'confirm') {
        console.log('🟡 [NOTIFICATION] sendConfirmationNotifications 호출');
        const result = await notificationService.sendConfirmationNotifications(reservationData);
        console.log('🟡 [NOTIFICATION] 확정 알림 결과:', result);
        return result;
      }
      // 새 예약 알림 (텔레그램만)
      else if (type === 'create') {
        console.log('🟡 [NOTIFICATION] sendNewReservationNotifications 호출');
        const result = await notificationService.sendNewReservationNotifications(reservationData);
        console.log('🟡 [NOTIFICATION] 새 예약 알림 결과:', result);
        return result;
      }
      // 예약 취소 알림
      else if (type === 'cancel') {
        console.log('🟡 [NOTIFICATION] sendCancellationNotifications 호출 전');
        console.log('🟡 [NOTIFICATION] 취소 데이터 전체:', JSON.stringify(reservationData, null, 2));
        
        // 함수 호출 직전 확인
        if (!notificationService.sendCancellationNotifications) {
          console.error('🔴 [NOTIFICATION ERROR] sendCancellationNotifications 함수가 없습니다!');
          console.log('🔴 [NOTIFICATION ERROR] notificationService 객체 키:', Object.keys(notificationService));
          throw new Error('sendCancellationNotifications 함수가 없습니다');
        }
        
        const result = await notificationService.sendCancellationNotifications(reservationData);
        console.log('🟡 [NOTIFICATION] 취소 알림 결과:', result);
        return result;
      }
      
      migrationDebugger.log(DEBUG_LEVELS.INFO, 'Dashboard', 'Notifications sent', { type });
    } catch (error) {
      console.error('🔴 [NOTIFICATION ERROR] 알림 실패:', error);
      console.error('🔴 [NOTIFICATION ERROR] 오류 스택:', error.stack);
      console.error('🔴 [NOTIFICATION ERROR] 오류 메시지:', error.message);
      console.error('🔴 [NOTIFICATION ERROR] 오류 전체:', error);
      migrationDebugger.log(DEBUG_LEVELS.ERROR, 'Dashboard', 'Notification failed', error);
      // 알림 실패는 무시하고 계속 진행
      throw error; // 에러를 다시 throw해서 호출측에서 확인 가능하게
    }
  };

  // 메시지 템플릿 가져오기 (선언형)
  const getMessageTemplate = async (type) => {
    const { getDocs, collection, query, where, limit } = await import('firebase/firestore');
    const { db } = await import('../config/firebase');
    
    const templatesQuery = query(
      collection(db, 'message_templates'),
      where('type', '==', type === 'create' ? 'confirmation' : 'cancellation'),
      limit(1)
    );
    
    const snapshot = await getDocs(templatesQuery);
    
    if (!snapshot.empty) {
      return snapshot.docs[0].data().content;
    }
    
    // 기본 템플릿
    return type === 'create' 
      ? `[초호수뷰펜션]\n{고객명}님, 예약이 확정되었습니다.\n\n📅 일정: {체크인} ~ {체크아웃}\n🏠 객실: {객실명}\n👥 인원: {인원}\n💰 금액: {금액}\n\n입실 당일 안내 문자 드리겠습니다.\n감사합니다 😊`
      : `[초호수뷰펜션]\n{고객명}님, 예약이 취소되었습니다.\n\n📅 일정: {체크인} ~ {체크아웃}\n🏠 객실: {객실명}\n\n다음에 더 좋은 기회로 뜵겠습니다.\n감사합니다.`;
  };

  // 예약 수정 핸들러
  const handleUpdateReservation = async (id, data) => {
    console.log('🔄 [Dashboard] handleUpdateReservation 호출:', { id, data });
    migrationDebugger.log(DEBUG_LEVELS.INFO, 'Dashboard', 'Updating reservation', { id, data });
    
    try {
      const result = await updateReservation(id, data);
      console.log('🔄 [Dashboard] updateReservation 결과:', result);
      
      if (result.success) {
        setSelectedBooking(null);
        migrationDebugger.log(DEBUG_LEVELS.INFO, 'Dashboard', 'Reservation updated');
        // 성공 메시지는 ReservationModal에서 처리하므로 여기서는 생략
        return result;
      } else {
        migrationDebugger.log(DEBUG_LEVELS.ERROR, 'Dashboard', 'Update failed', result.error);
        alert('예약 수정에 실패했습니다: ' + result.error);
        return result;
      }
    } catch (error) {
      console.error('❌ [Dashboard] 예약 수정 오류:', error);
      migrationDebugger.log(DEBUG_LEVELS.ERROR, 'Dashboard', 'Update error', error);
      alert('예약 수정 중 오류가 발생했습니다.');
      return { success: false, error: error.message };
    }
  };

  // 예약 취소 핸들러
  const handleCancelReservation = async (reservation, cancelData) => {
    console.log('❗❗❗ [Dashboard] handleCancelReservation 함수 시작!');
    console.log('🔴 [CANCEL] 예약 취소 시작:', { reservation, cancelData });
    console.log('🔴 [CANCEL] reservation 상세:', JSON.stringify(reservation, null, 2));
    console.log('🔴 [CANCEL] cancelData 상세:', JSON.stringify(cancelData, null, 2));
    
    // 호출 스택 확인
    console.trace('🔴 [CANCEL] 호출 스택:');
    
    migrationDebugger.log(DEBUG_LEVELS.INFO, 'Dashboard', 'Canceling reservation', { reservation, cancelData });
    
    const result = await cancelReservation(reservation.id, cancelData);
    console.log('🔴 [CANCEL] 취소 결과:', result);
    
    if (result.success) {
      setSelectedBooking(null);
      // 알림 발송은 useReservationStore에서 자동 처리됨
      migrationDebugger.log(DEBUG_LEVELS.INFO, 'Dashboard', 'Reservation canceled');
    } else {
      console.error('🔴 [CANCEL] 취소 실패:', result.error);
      migrationDebugger.log(DEBUG_LEVELS.ERROR, 'Dashboard', 'Cancellation failed', result.error);
      alert('예약 취소에 실패했습니다: ' + result.error);
    }
  };

  // 예약 확정 핸들러
  const handleConfirmReservation = async (id, depositorName) => {
    migrationDebugger.log(DEBUG_LEVELS.INFO, 'Dashboard', 'Confirming reservation', { id, depositorName });
    
    try {
      const result = await confirmReservation(id, depositorName);
      
      if (result.success) {
        setSelectedBooking(null);
        // 알림 발송은 useReservationStore에서 자동 처리됨
        migrationDebugger.log(DEBUG_LEVELS.INFO, 'Dashboard', 'Reservation confirmed');
      } else {
        alert(result.error || '예약 확정에 실패했습니다.');
        migrationDebugger.log(DEBUG_LEVELS.ERROR, 'Dashboard', 'Confirmation failed', result.error);
      }
    } catch (error) {
      migrationDebugger.log(DEBUG_LEVELS.ERROR, 'Dashboard', 'Confirmation error', error);
      alert('예약 확정 중 오류가 발생했습니다.');
    }
  };

  // 날짜 클릭 핸들러
  const handleDateClick = (dateStr) => {
    migrationDebugger.log(DEBUG_LEVELS.DEBUG, 'Dashboard', 'Date clicked', { date: dateStr });
    setSelectedDate(dateStr);
    setIsDatePanelOpen(true);
  };

  // 예약하기 핸들러 - 패널에서 호출
  const handleNewReservationFromPanel = async (initialData) => {
    migrationDebugger.log(DEBUG_LEVELS.INFO, 'Dashboard', 'New reservation from panel', initialData);
    
    // 막기 처리인 경우
    if (initialData.source === '막기') {
      await handleBlockingReservation(initialData);
    } else {
      // 일반 예약 처리
      setNewReservationInitialData(initialData);
      setIsNewModalOpen(true);
    }
  };

  // 막기 예약 처리 (분리된 함수)
  const handleBlockingReservation = async (initialData) => {
    const availableStock = getAvailableStock(initialData.checkIn, initialData.roomName);
    
    if (availableStock <= 0) {
      alert('해당 날짜는 이미 예약이 모두 차있습니다.');
      return;
    }
    
    const blockCount = prompt(
      `${initialData.roomName} 객실의 ${initialData.checkIn} 날짜에\n몇 개의 객실을 막으시겠습니까?\n\n현재 예약 가능: ${availableStock}개`,
      availableStock
    );
    
    if (blockCount === null) return;
    
    const numToBlock = parseInt(blockCount);
    
    if (isNaN(numToBlock) || numToBlock <= 0) {
      alert('올바른 숫자를 입력해주세요.');
      return;
    }
    
    if (numToBlock > availableStock) {
      alert(`최대 ${availableStock}개까지만 막을 수 있습니다.`);
      return;
    }
    
    if (window.confirm(`${initialData.roomName} 객실을 ${initialData.checkIn}에 ${numToBlock}개 차단하시겠습니까?`)) {
      migrationDebugger.startPerformance('BlockingReservation');
      
      try {
        const promises = [];
        for (let i = 0; i < numToBlock; i++) {
          const blockingReservation = {
            customerName: `관리자 막기 ${i + 1}`,
            phone: `000-0000-000${i}`,
            roomName: initialData.roomName,
            checkIn: initialData.checkIn,
            checkOut: initialData.checkOut,
            status: '예약확정',
            source: '막기',
            totalPrice: 0,
            memo: '관리자에 의한 예약 차단',
            depositorName: '',
            options: [],
            guests: 0
          };
          
          promises.push(createReservationWithInventoryCheck(blockingReservation));
        }
        
        const results = await Promise.all(promises);
        const successCount = results.filter(r => r.success).length;
        
        if (successCount === numToBlock) {
          alert(`${successCount}개의 객실이 차단되었습니다.`);
        } else if (successCount > 0) {
          alert(`${successCount}개의 객실이 차단되었습니다. (${numToBlock - successCount}개 실패)`);
        } else {
          throw new Error('막기 처리에 실패했습니다.');
        }
        
        migrationDebugger.log(DEBUG_LEVELS.INFO, 'Dashboard', 'Blocking completed', { successCount, total: numToBlock });
      } catch (error) {
        migrationDebugger.log(DEBUG_LEVELS.ERROR, 'Dashboard', 'Blocking failed', error);
        alert(`막기 처리 중 오류가 발생했습니다: ${error.message}`);
      } finally {
        migrationDebugger.endPerformance('BlockingReservation');
      }
    }
  };

  // 재고 변경 핸들러
  const handleStockChange = async (dateStr, roomName, available) => {
    migrationDebugger.log(DEBUG_LEVELS.DEBUG, 'Dashboard', 'Stock change', { dateStr, roomName, available });
    await updateInventoryOverride(dateStr, roomName, available);
  };

  // 현재 탭 정보 가져오기 (선언형)
  const currentTab = useMemo(() => 
    TABS.find(tab => tab.id === activeTab),
    [activeTab]
  );

  // 탭 컨텐츠 렌더링 (선언형)
  const renderTabContent = useMemo(() => {
    if (isLoading) {
      return (
        <div className="loading-overlay">
          <div className="loading-modal">
            <div className="loading-spinner-circle"></div>
            <p>로딩중입니다</p>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'calendar':
        return (
          <ReservationCalendar
            onConfirmReservation={handleConfirmReservation}
            onCancelReservation={handleCancelReservation}
            onUpdateReservation={handleUpdateReservation}
            onAddReservation={handleAddNewReservation}
          />
        );

      case 'reservations':
        return (
          <Suspense fallback={<LazyFallback />}>
            <ReservationList
              reservations={reservations || []}
              onUpdateReservation={handleUpdateReservation}
              onCancelReservation={handleCancelReservation}
              onSelectReservation={setSelectedBooking}
            />
          </Suspense>
        );

      case 'pricing':
        return <Suspense fallback={<LazyFallback />}><PricingSettings /></Suspense>;

      case 'rooms':
        return <Suspense fallback={<LazyFallback />}><RoomManagement /></Suspense>;

      case 'options':
        return <Suspense fallback={<LazyFallback />}><OptionsSettings /></Suspense>;

      case 'notifications':
        return (
          <div className="notifications-container">
            <Suspense fallback={<LazyFallback />}>
              <NotificationSettingsV2 />
            </Suspense>
          </div>
        );

      case 'airtableStats':
        return <Suspense fallback={<LazyFallback />}><AirtableDashboard /></Suspense>;

      case 'security':
        return <Suspense fallback={<LazyFallback />}><BlockedIPManager /></Suspense>;
      
      default:
        return (
          <div className="empty-state">
            <p>준비 중인 기능입니다.</p>
          </div>
        );
    }
  }, [activeTab, isLoading, isMobile, rooms, reservations, overrides, handleCancelReservation, handleUpdateReservation, handleStockChange]);

  // 성능 모니터링
  migrationDebugger.endPerformance('Dashboard');

  return (
    <div className="dashboard">
      {/* 헤더 + 네비게이션 통합 */}
      <header className="dashboard-header">
        <div className="header-left">
          <div className="logo">
            <img
              src="/images/logo-white.webp"
              alt="초호 펜션"
              className="logo-image"
            />
          </div>
          <nav className="header-nav">
            {TABS.map(tab => {
              const TabIcon = tab.Icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`header-nav-tab ${activeTab === tab.id ? 'active' : ''}`}
                >
                  <span className="header-nav-label">{tab.label}</span>
                  {tab.id === 'notifications' && statistics.pendingPayments > 0 && (
                    <span className="header-nav-badge">{statistics.pendingPayments}</span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main className={`dashboard-content ${activeTab === 'airtableStats' ? 'airtable-tab' : ''}`}>
        {/* 상단 통계 표시 삭제 - 2025.01.08 */}
        
        {isMobile && currentTab && (
          <div className="mobile-page-title">
            <h2>
              <currentTab.Icon className="icon" size={20} />
              {currentTab.label}
            </h2>
          </div>
        )}
        {/* 탭 전환 애니메이션 적용 */}
        <TabTransition tabKey={activeTab} preset="fade" duration={0.15}>
          {renderTabContent}
        </TabTransition>
      </main>

      {/* 하단 푸터 - 데스크탑에서만 표시 */}
      <footer className="dashboard-footer">
        <div className="dashboard-footer-content">
          <span className="dashboard-footer-text">© 2025 초호수뷰펜션</span>
          <span className="dashboard-footer-divider"></span>
          <span className="dashboard-footer-text">관리자 시스템</span>
        </div>
      </footer>

      {/* 모바일 하단 네비게이션 바 */}
      <MobileBottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        allTabs={TABS}
      />

      {/* 모달 */}
      <MobileMenu
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* 날짜 상세 패널 - ReservationCalendar 자체 패널 사용으로 비활성화 */}
      {/* {isDatePanelOpen && selectedDate && (
        <DateDetailPanel
          selectedDate={selectedDate}
          onClose={() => {
            setIsDatePanelOpen(false);
            setSelectedDate(null);
          }}
          onNewReservation={handleNewReservationFromPanel}
          onConfirmReservation={handleConfirmReservation}
          onCancelReservation={handleCancelReservation}
          onUpdateReservation={handleUpdateReservation}
        />
      )} */}

      {/* BookingModal */}
      {selectedBooking && (
        <BookingModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onConfirm={handleConfirmReservation}
          onCancel={handleCancelReservation}
          onUpdate={handleUpdateReservation}
        />
      )}

      {isNewModalOpen && (
        <NewReservationModal
          isOpen={isNewModalOpen}
          onClose={() => {
            setIsNewModalOpen(false);
            setNewReservationInitialData({});
          }}
          dateStr={selectedDate}
          rooms={rooms}
          options={options}
          onSubmit={handleAddNewReservation}
          getAvailableStock={getAvailableStock}
          initialData={newReservationInitialData}
        />
      )}

      {/* 디버그 패널 토글 버튼 (개발 모드) - 삭제
      {process.env.NODE_ENV === 'development' && (
        <button
          onClick={() => window.debug.show()}
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            padding: '10px',
            background: '#333',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            zIndex: 9999
          }}
        >
          🔧 Debug
        </button>
      )}
      */}
    </div>
  );
};

export default Dashboard;
