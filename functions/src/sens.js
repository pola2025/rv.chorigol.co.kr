// Firebase Functions - SENS SMS 발송 (환경 변수 사용)
import * as functions from 'firebase-functions';
import admin from 'firebase-admin';
import CryptoJS from 'crypto-js';
import fetch from 'node-fetch';

// Initialize Admin SDK once
try {
  admin.initializeApp();
} catch (error) {
  console.log('Admin already initialized');
}

const db = admin.firestore();

// Simple CORS headers
const setCorsHeaders = (response) => {
  response.set('Access-Control-Allow-Origin', '*');
  response.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.set('Access-Control-Max-Age', '3600');
};

// 전화번호 정규화
const normalizePhoneNumber = (phone) => {
  if (!phone) throw new Error('전화번호가 없습니다');
  
  let normalized = phone.replace(/[-\s()]/g, '');
  
  if (normalized.startsWith('+82')) {
    normalized = '0' + normalized.substring(3);
  } else if (normalized.startsWith('82')) {
    normalized = '0' + normalized.substring(2);
  }
  
  if (!/^01[0-9]{8,9}$/.test(normalized)) {
    console.error(`잘못된 전화번호 형식: ${phone} -> ${normalized}`);
    throw new Error(`잘못된 전화번호 형식: ${phone}`);
  }
  
  return normalized;
};

// 이모지 제거 함수
const removeEmojis = (text) => {
  if (!text) return text;
  
  const emojiPattern = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\uD800-\uDBFF][\uDC00-\uDFFF]/gu;
  
  let cleaned = text.replace(emojiPattern, '');
  cleaned = cleaned.split('\n').map(line => 
    line.replace(/\s+/g, ' ').trim()
  ).join('\n');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  return cleaned;
};

// HMAC 서명 생성
const makeSignature = (method, url, timestamp, accessKey, secretKey) => {
  const space = " ";
  const newLine = "\n";
  const message = method + space + url + newLine + timestamp + newLine + accessKey;
  
  const hmac = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, secretKey);
  hmac.update(message);
  const hash = hmac.finalize();
  
  return hash.toString(CryptoJS.enc.Base64);
};

// SENS API 키 가져오기
const getSENSConfig = async () => {
  // 1. 환경 변수 우선 사용
  const config = functions.config();
  if (config.sens) {
    console.log('[SENS] Using environment variables');
    return {
      serviceId: config.sens.service_id,
      accessKey: config.sens.access_key,
      secretKey: config.sens.secret_key,
      from: config.sens.from
    };
  }
  
  // 2. Firestore에서 가져오기 (알림설정 V2)
  try {
    const notificationDoc = await db.doc('settings/notifications_v2_choho').get();
    if (notificationDoc.exists) {
      const data = notificationDoc.data();
      if (data.globalSettings?.sens) {
        console.log('[SENS] Using Firestore notifications_v2_choho');
        return {
          serviceId: data.globalSettings.sens.serviceId,
          accessKey: data.globalSettings.sens.accessKey,
          secretKey: data.globalSettings.sens.secretKey,
          from: data.globalSettings.sens.from
        };
      }
    }
  } catch (error) {
    console.error('[SENS] Failed to load from Firestore:', error);
  }
  
  throw new Error('SENS 설정을 찾을 수 없습니다. 환경 변수를 설정하세요.');
};

// SENS SMS 발송 (메인 함수)
export const sendSENSSMS = functions.region('asia-northeast3').https.onRequest(async (request, response) => {
  setCorsHeaders(response);
  
  if (request.method === 'OPTIONS') {
    response.status(204).send('');
    return;
  }
  
  console.log('=== SENS SMS 발송 시작 ===');
  
  try {
    const { serviceId, from, to, content, reservationId, useServerConfig } = request.body;
    
    // 필수 파라미터 검증
    if (!to || !content) {
      response.status(400).json({
        success: false,
        error: '필수 파라미터가 누락되었습니다: to, content'
      });
      return;
    }
    
    // SENS 설정 가져오기
    let sensConfig;
    if (useServerConfig) {
      // 서버 설정 사용 (환경 변수 또는 Firestore)
      sensConfig = await getSENSConfig();
    } else {
      // 클라이언트에서 전달받은 설정 사용 (레거시 지원)
      const { accessKey, secretKey } = request.body;
      if (!accessKey || !secretKey) {
        // 서버 설정으로 fallback
        sensConfig = await getSENSConfig();
      } else {
        sensConfig = { serviceId, accessKey, secretKey, from };
      }
    }
    
    // 전화번호 정규화
    const normalizedTo = normalizePhoneNumber(to);
    const normalizedFrom = normalizePhoneNumber(sensConfig.from);
    
    console.log('[SENS] 발송 정보:', {
      from: normalizedFrom,
      to: normalizedTo,
      contentLength: content.length,
      reservationId
    });
    
    // SENS API 호출
    const timestamp = Date.now().toString();
    const method = 'POST';
    const path = `/sms/v2/services/${sensConfig.serviceId}/messages`;
    const baseUrl = 'https://sens.apigw.ntruss.com';
    
    const signature = makeSignature(method, path, timestamp, sensConfig.accessKey, sensConfig.secretKey);
    
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'x-ncp-apigw-timestamp': timestamp,
      'x-ncp-iam-access-key': sensConfig.accessKey,
      'x-ncp-apigw-signature-v2': signature
    };
    
    // 메시지 타입 결정
    const messageType = content.length > 90 ? 'LMS' : 'SMS';
    const cleanContent = removeEmojis(content);
    
    const body = {
      type: messageType,
      contentType: 'COMM',
      countryCode: '82',
      from: normalizedFrom,
      subject: messageType === 'LMS' ? '[초호펜션]' : undefined,
      content: cleanContent,
      messages: [{
        to: normalizedTo,
        content: cleanContent
      }]
    };
    
    console.log(`[SENS] ${messageType} 발송 요청`);
    
    const apiResponse = await fetch(baseUrl + path, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body)
    });
    
    const responseText = await apiResponse.text();
    console.log('[SENS] API 응답:', responseText);
    
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.error('[SENS] 응답 파싱 실패:', responseText);
      throw new Error('SENS API 응답 파싱 실패');
    }
    
    if (result.statusCode === '202') {
      console.log('[SENS] SMS 발송 성공:', result.requestId);
      
      // 발송 로그 저장
      if (reservationId) {
        try {
          await db.collection('smsLogs').add({
            reservationId,
            requestId: result.requestId,
            from: normalizedFrom,
            to: normalizedTo,
            content: cleanContent,
            type: messageType,
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'success'
          });
        } catch (logError) {
          console.error('[SENS] 로그 저장 실패:', logError);
        }
      }
      
      response.status(200).json({
        success: true,
        requestId: result.requestId,
        statusCode: result.statusCode,
        statusName: result.statusName,
        message: 'SMS 발송 완료'
      });
    } else {
      console.error('[SENS] SMS 발송 실패:', result);
      
      response.status(400).json({
        success: false,
        error: result.statusName || 'SMS 발송 실패',
        statusCode: result.statusCode,
        details: result
      });
    }
    
  } catch (error) {
    console.error('[SENS] 오류:', error);
    
    response.status(500).json({
      success: false,
      error: error.message || '서버 오류가 발생했습니다.'
    });
  }
});

// 자동 SMS 발송 스케줄러
export const autoSendSMSScheduler = functions
  .region('asia-northeast3')
  .pubsub
  .schedule('*/10 * * * *')  // 10분마다 실행
  .timeZone('Asia/Seoul')
  .onRun(async (context) => {
    console.log('[스케줄러] 자동 SMS 발송 확인 시작');
    
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentHour = now.getHours();
    
    try {
      // 입실 안내 (오후 1시)
      if (currentHour === 13) {
        const checkInQuery = await db.collection('reservations')
          .where('checkIn', '==', todayStr)
          .where('status', '==', '예약확정')
          .get();
        
        for (const doc of checkInQuery.docs) {
          const reservation = doc.data();
          if (!reservation.smsStatus?.checkInSent) {
            console.log(`[스케줄러] 입실 안내 발송: ${reservation.customerName}`);
            // SMS 발송 로직
          }
        }
      }
      
      // 퇴실 안내 (오전 10시)
      if (currentHour === 10) {
        const checkOutQuery = await db.collection('reservations')
          .where('checkOut', '==', todayStr)
          .where('status', '==', '예약확정')
          .get();
        
        for (const doc of checkOutQuery.docs) {
          const reservation = doc.data();
          if (!reservation.smsStatus?.checkOutSent) {
            console.log(`[스케줄러] 퇴실 안내 발송: ${reservation.customerName}`);
            // SMS 발송 로직
          }
        }
      }
      
    } catch (error) {
      console.error('[스케줄러] 오류:', error);
    }
    
    return null;
  });
