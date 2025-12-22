// src/utils/sms.js
import { doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import sensService from '../services/sensService';

// 업체별 주소 정보
const BUSINESS_INFO = {
  choho: {
    name: '초호 펜션',
    address: '경기도 파주시 법원읍 초리골길 134'
  },
  shelter: {
    name: '초호쉼터',
    address: '경기도 파주시 법원읍 초리골길 134'
  }
};

// 예약의 객실명으로 업체 구분
// 초호펜션: Forest, Forest mini, Forest 패밀리, Forest mini 패밀리
// 초호쉼터: 호수뷰객실, 1박2일워크샵, 야유회, 단체예약
const getBusinessType = (reservation) => {
  const roomName = reservation.roomName || '';
  // 호수뷰객실은 초호쉼터 소속
  const shelterRooms = ['호수뷰객실', '1박2일워크샵', '야유회', '단체예약'];
  if (shelterRooms.some(room => roomName.includes(room) || room.includes(roomName))) {
    return 'shelter';
  }
  // Forest 계열은 초호펜션 소속
  const chohoRooms = ['Forest', 'Forest mini', 'Forest 패밀리', 'Forest mini 패밀리'];
  if (chohoRooms.some(room => roomName.includes(room) || room.includes(roomName))) {
    return 'choho';
  }
  return 'choho'; // 기본값
};

// 이모지 제거 함수 (줄바꿈 유지)
const removeEmojis = (text) => {
  if (!text) return text;
  
  // 이모지 패턴
  const emojiPattern = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\uD800-\uDBFF][\uDC00-\uDFFF]/gu;
  
  // 이모지만 제거 (줄바꿈은 보존)
  let cleaned = text.replace(emojiPattern, '');
  
  // 각 줄에서 연속된 공백만 제거 (줄바꿈은 유지)
  cleaned = cleaned.split('\n').map(line => 
    line.replace(/\s+/g, ' ').trim()
  ).join('\n');
  
  // 빈 줄이 3개 이상인 경우만 2개로 줄이기
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  return cleaned;
};

// 알림설정에서 메시지 템플릿 가져오기
const getMessageTemplate = async (type, businessType, roomName) => {
  try {
    // 업체별 알림설정 문서 가져오기
    const docName = businessType === 'shelter' ? 'notifications_v2_shelter' : 'notifications_v2_choho';
    const notificationDoc = await getDoc(doc(db, 'settings', docName));
    
    if (notificationDoc.exists()) {
      const data = notificationDoc.data();
      
      // roomSettings에서 해당 객실의 templates 확인
      if (data.roomSettings && data.roomSettings[roomName]) {
        const roomConfig = data.roomSettings[roomName];
        console.log(`📱 [SMS] ${roomName} 설정 확인:`, roomConfig);
        
        // templates 객체 확인
        if (roomConfig.templates && roomConfig.templates[type]) {
          console.log(`📱 [SMS] ${roomName}.templates.${type} 템플릿 발견!`);
          return roomConfig.templates[type];
        }
      }
      
      // 모든 객실에서 찾기 (roomName이 일치하지 않을 경우)
      if (data.roomSettings) {
        for (const roomKey in data.roomSettings) {
          const roomConfig = data.roomSettings[roomKey];
          if (roomConfig.templates && roomConfig.templates[type]) {
            console.log(`📱 [SMS] ${roomKey}.templates.${type} 템플릿 사용 (fallback)`);
            return roomConfig.templates[type];
          }
        }
      }
    } else {
      console.error(`📱 [SMS] ${docName} 문서가 존재하지 않습니다`);
    }
  } catch (error) {
    console.error('📱 [SMS] 템플릿 로드 실패:', error);
  }
  
  console.log(`📱 [SMS] ${businessType} ${roomName} ${type} 템플릿을 찾을 수 없음`);
  return null;
};

// 템플릿 변수 치환
const replaceTemplateVariables = (template, reservation, type) => {
  if (!template) return '';

  // content 필드가 있는 경우 (객체 형태)
  let message = typeof template === 'object' && template.content ? template.content : template;

  // 금액 값 (원 없이)
  const priceValue = reservation.totalPrice ? reservation.totalPrice.toLocaleString() : '0';

  // 현장결제 옵션 계산
  let onsiteText = '';
  if (reservation.options && reservation.options.length > 0) {
    const onsiteOptions = reservation.options.filter(opt => {
      const name = typeof opt === 'object' ? (opt.name || '') : opt;
      return name.includes('바베큐') || name.includes('BBQ') || name.toLowerCase().includes('bbq');
    });

    if (onsiteOptions.length > 0) {
      const onsiteTotal = onsiteOptions.reduce((sum, opt) => {
        const price = typeof opt === 'object' ? (opt.price || 0) : 0;
        return sum + price;
      }, 0);
      if (onsiteTotal > 0) {
        onsiteText = `현장결제: ${onsiteTotal.toLocaleString()}원`;
      }
    }
  }
  // onsitePrice 필드가 있는 경우도 처리
  if (!onsiteText && reservation.onsitePrice && reservation.onsitePrice > 0) {
    onsiteText = `현장결제: ${reservation.onsitePrice.toLocaleString()}원`;
  }

  // 변수 치환 (원, 명은 템플릿에서 직접 붙이도록)
  message = message.replace(/{고객명}/g, reservation.customerName || '');
  message = message.replace(/{객실명}/g, reservation.roomName || '');
  message = message.replace(/{체크인}/g, reservation.checkIn || '');
  message = message.replace(/{체크아웃}/g, reservation.checkOut || '');
  message = message.replace(/{인원}/g, reservation.guests || reservation.guestCount || 2);
  message = message.replace(/{금액}/g, priceValue);  // 숫자만 (원 없이)
  message = message.replace(/{현장결제}/g, onsiteText);

  // 옵션 처리
  if (reservation.options && reservation.options.length > 0) {
    const optionNames = reservation.options.map(opt =>
      typeof opt === 'object' ? opt.name : opt
    ).join(', ');
    message = message.replace(/{옵션}/g, optionNames);
  } else {
    message = message.replace(/{옵션}/g, '');
  }

  // 주소 처리 - 퇴실안내에는 주소 제외
  if (type !== 'checkOut') {
    const businessType = getBusinessType(reservation);
    const business = BUSINESS_INFO[businessType];
    message = message.replace(/{주소}/g, business.address);

    // 템플릿에 주소가 전혀 없으면 끝에 추가 (퇴실안내 제외)
    if (!message.includes(business.address) && !message.includes('주소')) {
      message += `\n\n주소: ${business.address}`;
    }
  } else {
    // 퇴실안내에서는 {주소} 변수 제거
    message = message.replace(/{주소}/g, '');
    // 주소: 라는 텍스트가 있으면 해당 줄 전체 제거
    message = message.replace(/.*주소:.*\n?/g, '');
  }

  return message;
};

// SMS 발송 (실제 SENS API 호출)
export const sendSMS = async (reservation, type = 'confirmation') => {
  try {
    // 전화번호 확인
    const phoneNumber = reservation.phone;
    
    if (!phoneNumber) {
      console.error('📱 [SMS] 전화번호 없음:', reservation);
      throw new Error('전화번호가 없습니다.');
    }
    
    const businessType = getBusinessType(reservation);
    const roomName = reservation.roomName;
    
    // 알림설정에서 템플릿 가져오기 (객실명 포함)
    const template = await getMessageTemplate(type, businessType, roomName);
    
    if (!template) {
      console.error(`📱 [SMS] ${businessType} ${type} 템플릿이 설정되지 않았습니다.`);
      console.error(`📱 [SMS] 알림설정 > ${businessType === 'shelter' ? '초호쉼터' : '초호펜션'} > 메시지 템플릿에서 설정해주세요.`);
      throw new Error(`메시지 템플릿이 설정되지 않았습니다. 알림설정에서 ${type} 템플릿을 등록해주세요.`);
    }
    
    // 템플릿 변수 치환 (type 전달)
    let message = replaceTemplateVariables(template, reservation, type);
    
    // 이모지 제거 (줄바꿈은 유지)
    message = removeEmojis(message);
    
    console.log('📱 [SMS] 발송 시작:', {
      to: phoneNumber,
      type,
      customerName: reservation.customerName,
      messageLength: message.length,
      businessType,
      templateUsed: true
    });
    
    // sensService를 통한 실제 SMS 발송
    const result = await sensService.sendSMS(phoneNumber, message, reservation.id, reservation);
    
    console.log('📱 [SMS] 발송 결과:', result);
    
    return {
      success: result.success,
      requestId: result.requestId,
      message: result.message || '발송 완료'
    };
    
  } catch (error) {
    console.error('📱 [SMS] 발송 오류:', error);
    throw error;
  }
};

// SMS 재발송
export const resendSMS = async (reservationId, type) => {
  try {
    console.log('📱 [SMS] 재발송 시작:', { reservationId, type });
    
    // Firestore에서 예약 정보 가져오기
    const reservationRef = doc(db, 'reservations', reservationId);
    const reservationSnap = await getDoc(reservationRef);
    
    if (!reservationSnap.exists()) {
      throw new Error('예약 정보를 찾을 수 없습니다.');
    }
    
    const reservation = { 
      id: reservationId, 
      ...reservationSnap.data() 
    };
    
    console.log('📱 [SMS] 예약 정보 로드:', {
      customerName: reservation.customerName,
      phone: reservation.phone,
      roomName: reservation.roomName
    });
    
    // SMS 발송
    const result = await sendSMS(reservation, type);
    
    // 발송 성공시 상태 업데이트
    if (result.success) {
      const updateData = {
        [`smsStatus.${type}Sent`]: true,
        [`smsStatus.${type}SentAt`]: serverTimestamp(),
        [`smsStatus.${type}RequestId`]: result.requestId,
        [`smsStatus.${type}Error`]: null
      };
      
      await updateDoc(reservationRef, updateData);
      console.log('📱 [SMS] 상태 업데이트 완료');
    }
    
    return result;
  } catch (error) {
    console.error('📱 [SMS] 재발송 오류:', error);
    
    // 에러 상태 업데이트
    try {
      const reservationRef = doc(db, 'reservations', reservationId);
      await updateDoc(reservationRef, {
        [`smsStatus.${type}Error`]: error.message,
        [`smsStatus.${type}Sent`]: false
      });
    } catch (updateError) {
      console.error('📱 [SMS] 에러 상태 업데이트 실패:', updateError);
    }
    
    throw error;
  }
};

// 자동 SMS 발송 시점
export const SMS_SCHEDULE = {
  confirmation: 'immediate',      // 예약 등록 시 즉시 발송
  checkIn: '13:00',               // 입실 당일 오후 1시
  checkOut: '10:00'               // 퇴실 당일 오전 10시
};
