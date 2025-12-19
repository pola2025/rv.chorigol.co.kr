// functions/src/smsScheduler.js - 알림설정 템플릿 사용
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';
import fetch from 'node-fetch';

const db = getFirestore();

// 이모지 제거 함수 (줄바꿈 유지)
const removeEmojis = (text) => {
  if (!text) return text;
  
  const emojiPattern = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\uD800-\uDBFF][\uDC00-\uDFFF]/gu;
  
  let cleaned = text.replace(emojiPattern, '');
  
  // 각 줄에서 연속된 공백만 제거 (줄바꿈은 유지)
  cleaned = cleaned.split('\n').map(line => 
    line.replace(/\s+/g, ' ').trim()
  ).join('\n');
  
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  return cleaned;
};

// 네이버 SENS API 헬퍼 클래스
class NaverSensAPI {
  constructor(config) {
    this.serviceId = config.serviceId;
    this.accessKey = config.accessKey;
    this.secretKey = config.secretKey;
    this.from = config.from;
  }

  makeSignature(method, url, timestamp) {
    const space = ' ';
    const newLine = '\n';
    const hmac = crypto.createHmac('sha256', this.secretKey);
    hmac.update(method);
    hmac.update(space);
    hmac.update(url);
    hmac.update(newLine);
    hmac.update(timestamp);
    hmac.update(newLine);
    hmac.update(this.accessKey);
    return hmac.digest('base64');
  }

  async sendSMS(to, content) {
    const timestamp = Date.now().toString();
    const url = `/sms/v2/services/${this.serviceId}/messages`;
    const signature = this.makeSignature('POST', url, timestamp);
    
    // 전화번호 정규화
    const normalizedTo = to.replace(/[-\s]/g, '');
    
    // 이모지 제거 (줄바꿈 유지)
    const cleanContent = removeEmojis(content);

    try {
      const response = await fetch(
        `https://sens.apigw.ntruss.com${url}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-ncp-apigw-timestamp': timestamp,
            'x-ncp-iam-access-key': this.accessKey,
            'x-ncp-apigw-signature-v2': signature
          },
          body: JSON.stringify({
            type: cleanContent.length > 45 ? 'LMS' : 'SMS',
            contentType: 'COMM',
            countryCode: '82',
            from: this.from.replace(/-/g, ''),
            content: cleanContent,
            messages: [{ to: normalizedTo }]
          })
        }
      );
      
      const result = await response.json();
      return { 
        success: response.ok, 
        data: result,
        requestId: result.requestId 
      };
    } catch (error) {
      console.error('SMS 발송 실패:', error);
      return { success: false, error: error.message };
    }
  }
}

// 업체 구분
const getBusinessType = (roomName) => {
  const shelterRooms = ['호수뷰객실', '1박2일워크샵', '야유회'];
  return shelterRooms.includes(roomName) ? 'shelter' : 'choho';
};

// 템플릿 가져오기 함수 (알림설정에서)
async function getTemplate(reservation, templateType) {
  try {
    const businessType = getBusinessType(reservation.roomName);
    const docName = businessType === 'shelter' ? 'notifications_v2_shelter' : 'notifications_v2_choho';

    const docRef = await db.doc(`settings/${docName}`).get();

    if (docRef.exists) {
      const data = docRef.data();

      // 1. 객실별 템플릿 확인 (roomSettings에서)
      if (data.roomSettings && data.roomSettings[reservation.roomName]?.templates?.[templateType]) {
        const roomTemplate = data.roomSettings[reservation.roomName].templates[templateType];
        console.log(`✅ [${businessType}] ${reservation.roomName} 객실별 ${templateType} 템플릿 사용`);
        return typeof roomTemplate === 'object' ? roomTemplate.content : roomTemplate;
      }

      // 2. 전역 템플릿 확인 (messageTemplates에서 - 레거시 지원)
      if (data.messageTemplates && data.messageTemplates[templateType]) {
        console.log(`✅ [${businessType}] 전역 ${templateType} 템플릿 사용`);
        const template = data.messageTemplates[templateType];
        return typeof template === 'object' ? template.content : template;
      }

      // 3. 기본 템플릿 생성
      console.log(`⚠️ [${businessType}] ${templateType} 템플릿 없음 - 기본 템플릿 사용`);
      return getDefaultTemplate(reservation.roomName, templateType, businessType);
    }

    console.error(`❌ [${businessType}] 알림 설정 문서가 없습니다`);
    return getDefaultTemplate(reservation.roomName, templateType, businessType);
  } catch (error) {
    console.error('템플릿 로드 실패:', error);
    return null;
  }
}

// 기본 템플릿 생성
function getDefaultTemplate(roomName, templateType, businessType) {
  const pensionName = businessType === 'shelter' ? '초호쉼터' : '초호펜션';

  const templates = {
    checkIn: `[${pensionName}]
안녕하세요 {고객명}님!
${roomName} 예약 고객님 입실 안내드립니다.

일정: {체크인} ~ {체크아웃}
객실: ${roomName}
인원: {인원}명
입실: 오후 3시

주소: {주소}
주차: 객실 앞 전용주차장

편안한 휴식 되세요!`,

    checkOut: `[${pensionName}]
{고객명}님, 즐거운 시간 보내셨나요?

객실: ${roomName}
퇴실시간: 오전 11시

퇴실준비
- 사용하신 그릇은 싱크대에
- 쓰레기는 분리수거 부탁드립니다

감사합니다. 또 뵙겠습니다!`
  };

  return templates[templateType] || templates.checkIn;
}

// 템플릿 변수 치환
function replaceTemplateVariables(template, reservation) {
  if (!template) return '';
  
  let message = template;
  
  // 변수 치환
  message = message.replace(/{고객명}/g, reservation.customerName || '');
  message = message.replace(/{객실명}/g, reservation.roomName || '');
  message = message.replace(/{체크인}/g, reservation.checkIn || '');
  message = message.replace(/{체크아웃}/g, reservation.checkOut || '');
  message = message.replace(/{인원}/g, reservation.guests || reservation.guestCount || 2);
  message = message.replace(/{금액}/g, reservation.totalPrice ? `${reservation.totalPrice.toLocaleString()}원` : '');
  
  // 주소 추가
  const address = '경기 파주시 법원읍 초리골길 138-17';
  message = message.replace(/{주소}/g, address);
  
  if (!message.includes(address) && !message.includes('주소')) {
    message += `\n\n주소: ${address}`;
  }
  
  return message;
}

// SENS 설정 가져오기
async function getSENSConfig(businessType) {
  try {
    const docName = businessType === 'shelter' ? 'notifications_v2_shelter' : 'notifications_v2_choho';
    const doc = await db.doc(`settings/${docName}`).get();

    if (doc.exists) {
      const data = doc.data();
      if (data.globalSettings?.sens) {
        return data.globalSettings.sens;
      }
    }

    console.error(`SENS 설정이 없습니다: ${businessType}`);
    return null;
  } catch (error) {
    console.error('SENS 설정 로드 실패:', error);
    return null;
  }
}

// 객실별 자동발송 설정 확인
async function isAutoSendEnabled(roomName, smsType) {
  try {
    const businessType = getBusinessType(roomName);
    const docName = businessType === 'shelter' ? 'notifications_v2_shelter' : 'notifications_v2_choho';
    const doc = await db.doc(`settings/${docName}`).get();

    if (doc.exists) {
      const data = doc.data();
      const roomSettings = data.roomSettings?.[roomName];

      // 객실이 비활성화된 경우
      if (roomSettings?.enabled === false) {
        console.log(`⏸️ [${roomName}] 객실 알림 비활성화됨`);
        return false;
      }

      // autoSend 설정 확인
      const autoSend = roomSettings?.autoSend;
      if (autoSend) {
        if (smsType === 'checkIn' && autoSend.checkInEnabled === false) {
          console.log(`⏸️ [${roomName}] 입실안내 자동발송 비활성화됨`);
          return false;
        }
        if (smsType === 'checkOut' && autoSend.checkOutEnabled === false) {
          console.log(`⏸️ [${roomName}] 퇴실안내 자동발송 비활성화됨`);
          return false;
        }
      }

      // 설정이 없거나 활성화된 경우 기본값 true
      return true;
    }

    // 설정 문서가 없으면 기본값 true (발송)
    return true;
  } catch (error) {
    console.error('자동발송 설정 확인 실패:', error);
    return true; // 오류 시 기본값 발송
  }
}

// 자동 SMS 스케줄러
export const autoSendSMSScheduler = onSchedule({
  schedule: '0 10,13 * * *',  // 매일 오전 10시, 오후 1시
  timeZone: 'Asia/Seoul',
  region: 'asia-northeast3',
  memory: '256MiB',
  retryCount: 3
}, async (context) => {
  // ⚠️ 자동 발송 비활성화 - 템플릿 확정 후 이 블록을 제거하세요
  console.log('⏸️ 자동 SMS 발송이 비활성화되어 있습니다. 템플릿 확정 후 활성화하세요.');
  return;
  // ⚠️ 비활성화 끝

  console.log('🔔 자동 SMS 발송 스케줄러 시작');

  // 한국 시간으로 변환 (UTC+9)
  const now = new Date();
  const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  const hour = koreaTime.getUTCHours();
  const todayStr = koreaTime.toISOString().split('T')[0];

  console.log(`현재 한국 시간: ${koreaTime.toISOString()}, 시간: ${hour}시`);

  let smsType = '';
  let queryField = '';

  // 발송 시간 및 타입 결정 (한국 시간 기준)
  if (hour === 13) {
    smsType = 'checkIn';  // 입실 안내
    queryField = 'checkIn';
    console.log(`📱 입실 안내 SMS 발송 시작 (${todayStr})`);
  } else if (hour === 10) {
    smsType = 'checkOut';  // 퇴실 안내
    queryField = 'checkOut';
    console.log(`📱 퇴실 안내 SMS 발송 시작 (${todayStr})`);
  } else {
    console.log(`현재 시간(${hour}시)은 SMS 발송 시간(10시, 13시)이 아닙니다.`);
    return;
  }
  
  try {
    // 해당 날짜의 예약 조회
    const reservationsSnapshot = await db.collection('reservations')
      .where(queryField, '==', todayStr)
      .where('status', '==', '예약확정')
      .get();
    
    if (reservationsSnapshot.empty) {
      console.log(`${todayStr} ${smsType} 예약이 없습니다.`);
      return;
    }
    
    const sendPromises = [];
    
    for (const doc of reservationsSnapshot.docs) {
      const reservation = { id: doc.id, ...doc.data() };

      // 이미 발송된 경우 스킵
      if (reservation.smsStatus?.[`${smsType}Sent`]) {
        console.log(`✅ 이미 발송됨: ${reservation.customerName} (${reservation.roomName})`);
        continue;
      }

      // 전화번호가 없는 경우 스킵
      if (!reservation.phone) {
        console.log(`❌ 전화번호 없음: ${reservation.customerName}`);
        continue;
      }

      // 객실별 자동발송 설정 확인
      const autoSendEnabled = await isAutoSendEnabled(reservation.roomName, smsType);
      if (!autoSendEnabled) {
        console.log(`⏸️ 자동발송 비활성화: ${reservation.customerName} (${reservation.roomName})`);
        continue;
      }

      // 업체 구분 및 SENS 설정 가져오기
      const businessType = getBusinessType(reservation.roomName);
      const sensConfig = await getSENSConfig(businessType);

      if (!sensConfig) {
        console.error(`❌ SENS 설정 없음: ${businessType}`);
        continue;
      }

      // 템플릿 가져오기
      const template = await getTemplate(reservation, smsType);
      if (!template) {
        console.error(`❌ 템플릿 없음: ${businessType} - ${smsType}`);
        continue;
      }
      
      // 템플릿 변수 치환
      const message = replaceTemplateVariables(template, reservation);
      
      // SMS 발송
      const sensAPI = new NaverSensAPI(sensConfig);
      
      sendPromises.push(
        sensAPI.sendSMS(reservation.phone, message)
          .then(async (result) => {
            if (result.success) {
              // 발송 성공 상태 업데이트
              await doc.ref.update({
                [`smsStatus.${smsType}Sent`]: true,
                [`smsStatus.${smsType}SentAt`]: FieldValue.serverTimestamp(),
                [`smsStatus.${smsType}RequestId`]: result.requestId
              });
              
              console.log(`✅ 발송 성공: ${reservation.customerName} (${reservation.roomName})`);
            } else {
              // 발송 실패 상태 업데이트
              await doc.ref.update({
                [`smsStatus.${smsType}Error`]: result.error || 'Unknown error',
                [`smsStatus.${smsType}Sent`]: false
              });
              
              console.error(`❌ 발송 실패: ${reservation.customerName} - ${result.error}`);
            }
          })
          .catch(async (error) => {
            console.error(`❌ 발송 중 오류: ${reservation.customerName}`, error);
            await doc.ref.update({
              [`smsStatus.${smsType}Error`]: error.message,
              [`smsStatus.${smsType}Sent`]: false
            });
          })
      );
    }
    
    // 모든 발송 완료 대기
    await Promise.allSettled(sendPromises);
    
    console.log(`✅ ${smsType} SMS 발송 작업 완료`);
    
  } catch (error) {
    console.error('스케줄러 오류:', error);
  }
});

// 수동 트리거 함수
export const triggerSMSScheduler = onCall({
  region: 'asia-northeast3',
  cors: true
}, async (request) => {
  const { type } = request.data;
  
  if (!['checkIn', 'checkOut'].includes(type)) {
    throw new HttpsError('invalid-argument', '유효하지 않은 SMS 타입입니다.');
  }
  
  console.log(`📱 수동 SMS 발송 트리거: ${type}`);
  
  // 스케줄러와 동일한 로직 실행
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const queryField = type === 'checkIn' ? 'checkIn' : 'checkOut';
  
  try {
    const reservationsSnapshot = await db.collection('reservations')
      .where(queryField, '==', todayStr)
      .where('status', '==', '예약확정')
      .get();
    
    let successCount = 0;
    let failCount = 0;
    
    for (const doc of reservationsSnapshot.docs) {
      const reservation = { id: doc.id, ...doc.data() };
      
      if (reservation.smsStatus?.[`${type}Sent`] || !reservation.phone) {
        continue;
      }
      
      const businessType = getBusinessType(reservation.roomName);
      const sensConfig = await getSENSConfig(businessType);
      
      if (!sensConfig) continue;
      
      const template = await getTemplate(reservation, type);
      if (!template) continue;
      
      const message = replaceTemplateVariables(template, reservation);
      const sensAPI = new NaverSensAPI(sensConfig);
      
      const result = await sensAPI.sendSMS(reservation.phone, message);
      
      if (result.success) {
        await doc.ref.update({
          [`smsStatus.${type}Sent`]: true,
          [`smsStatus.${type}SentAt`]: FieldValue.serverTimestamp(),
          [`smsStatus.${type}RequestId`]: result.requestId
        });
        successCount++;
      } else {
        await doc.ref.update({
          [`smsStatus.${type}Error`]: result.error || 'Unknown error',
          [`smsStatus.${type}Sent`]: false
        });
        failCount++;
      }
    }
    
    return {
      success: true,
      message: `${type} SMS 발송 완료`,
      stats: {
        success: successCount,
        failed: failCount
      }
    };
    
  } catch (error) {
    console.error('수동 트리거 오류:', error);
    throw new HttpsError('internal', error.message);
  }
});
