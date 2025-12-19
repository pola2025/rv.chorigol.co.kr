// Minimal Cloud Functions with SENS support (IMPROVED)
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
  
  // 모든 특수문자 제거
  let normalized = phone.replace(/[-\s()]/g, '');
  
  // 국가코드 제거 (한국)
  if (normalized.startsWith('+82')) {
    normalized = '0' + normalized.substring(3);
  } else if (normalized.startsWith('82')) {
    normalized = '0' + normalized.substring(2);
  }
  
  // 유효성 검사
  if (!/^01[0-9]{8,9}$/.test(normalized)) {
    console.error(`잘못된 전화번호 형식: ${phone} -> ${normalized}`);
    throw new Error(`잘못된 전화번호 형식: ${phone}`);
  }
  
  return normalized;
};

// 이모지 제거 함수 (줄바꿈 보존)
const removeEmojis = (text) => {
  if (!text) return text;
  
  // 이모지 및 특수 유니코드 문자 제거 패턴
  // 1. 이모지 블록들
  // 2. Dingbats, Miscellaneous Symbols 등
  // 3. 서로게이트 페어로 표현되는 문자들
  const emojiPattern = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\uD800-\uDBFF][\uDC00-\uDFFF]/gu;
  
  // 이모지만 제거 (줄바꿈은 보존)
  let cleaned = text.replace(emojiPattern, '');
  
  // 연속된 공백 제거 (줄바꿈은 제외)
  // 각 줄에서만 연속 공백 제거
  cleaned = cleaned.split('\n').map(line => 
    line.replace(/\s+/g, ' ').trim()
  ).join('\n');
  
  // 빈 줄이 여러 개인 경우 하나로 줄이기
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  return cleaned;
};

// HMAC 서명 생성 (개선된 버전)
const makeSignature = (method, url, timestamp, accessKey, secretKey) => {
  const space = " ";
  const newLine = "\n";
  
  // 서명 문자열 생성 (순서 중요!)
  const message = method + space + url + newLine + timestamp + newLine + accessKey;
  
  console.log('[SENS] 서명 생성용 문자열:', message);
  
  const hmac = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, secretKey);
  hmac.update(message);
  
  const hash = hmac.finalize();
  const signature = hash.toString(CryptoJS.enc.Base64);
  
  console.log('[SENS] 생성된 서명:', signature);
  
  return signature;
};

// SENS 연결 테스트 (asia-northeast3 리전)
export const testSENSConnection = functions.region('asia-northeast3').https.onRequest(async (request, response) => {
  setCorsHeaders(response);
  
  if (request.method === 'OPTIONS') {
    response.status(204).send('');
    return;
  }
  
  console.log('=== SENS 연결 테스트 시작 ===');
  
  try {
    const { serviceId, accessKey, secretKey, from } = request.body;
    
    if (!serviceId || !accessKey || !secretKey || !from) {
      response.status(400).json({
        success: false,
        error: 'SENS 설정 정보가 누락되었습니다.'
      });
      return;
    }
    
    // 전화번호 정규화
    const normalizedFrom = normalizePhoneNumber(from);
    console.log('테스트 발신번호:', normalizedFrom);
    
    const timestamp = Date.now().toString();
    const method = 'POST';
    const path = `/sms/v2/services/${serviceId}/messages`;
    const baseUrl = 'https://sens.apigw.ntruss.com';
    
    const signature = makeSignature(method, path, timestamp, accessKey, secretKey);
    
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'x-ncp-apigw-timestamp': timestamp,
      'x-ncp-iam-access-key': accessKey,
      'x-ncp-apigw-signature-v2': signature
    };
    
    const testMessage = `[초호펜션] SENS 테스트\n${new Date().toLocaleString('ko-KR')}`;
    const cleanTestMessage = removeEmojis(testMessage);
    
    const body = {
      type: 'SMS',
      contentType: 'COMM',
      countryCode: '82',
      from: normalizedFrom,
      content: cleanTestMessage,
      messages: [{
        to: normalizedFrom,  // 자기 자신에게 테스트
        content: cleanTestMessage
      }]
    };
    
    console.log('테스트 요청:', {
      url: baseUrl + path,
      body: body
    });
    
    const apiResponse = await fetch(baseUrl + path, {
      method: method,
      headers: headers,
      body: JSON.stringify(body)
    });
    
    const responseText = await apiResponse.text();
    console.log('테스트 응답:', {
      status: apiResponse.status,
      body: responseText
    });
    
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      result = { error: responseText };
    }
    
    if (apiResponse.status === 202 || (apiResponse.ok && result.requestId)) {
      response.status(200).json({
        success: true,
        message: `테스트 성공! ${from}로 메시지가 발송되었습니다.`,
        requestId: result.requestId
      });
    } else {
      let errorMessage = 'SENS 테스트 실패';
      let solution = '';
      
      if (apiResponse.status === 401) {
        errorMessage = '인증 실패 (401)';
        solution = 'Access Key와 Secret Key를 다시 확인해주세요.';
      } else if (apiResponse.status === 404) {
        errorMessage = '서비스를 찾을 수 없음 (404)';
        solution = `Service ID를 확인해주세요: ${serviceId}`;
      } else if (apiResponse.status === 400) {
        errorMessage = '잘못된 요청 (400)';
        if (result.invalidRequestParameters) {
          solution = `잘못된 파라미터: ${JSON.stringify(result.invalidRequestParameters)}`;
        } else {
          solution = `발신번호 ${from}이 사전 등록되어 있는지 확인해주세요.`;
        }
      }
      
      response.status(400).json({
        success: false,
        error: errorMessage,
        solution: solution,
        details: result
      });
    }
  } catch (error) {
    console.error('테스트 중 오류:', error);
    response.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// SENS SMS 발송 (asia-northeast3 리전)
export const sendSENSSMS = functions.region('asia-northeast3').https.onRequest(async (request, response) => {
  setCorsHeaders(response);
  
  if (request.method === 'OPTIONS') {
    response.status(204).send('');
    return;
  }
  
  console.log('=== SENS SMS 디버깅 시작 ===');
  console.log('요청 데이터:', JSON.stringify(request.body, null, 2));
  
  try {
    const { serviceId, accessKey, secretKey, from, to, content } = request.body;
    
    // 필수 파라미터 검증
    const missingFields = [];
    if (!serviceId) missingFields.push('serviceId');
    if (!accessKey) missingFields.push('accessKey');
    if (!secretKey) missingFields.push('secretKey');
    if (!from) missingFields.push('from');
    if (!to) missingFields.push('to');
    if (!content) missingFields.push('content');
    
    if (missingFields.length > 0) {
      console.error('누락된 필드:', missingFields);
      response.status(400).json({
        success: false,
        error: `필수 파라미터가 누락되었습니다: ${missingFields.join(', ')}`
      });
      return;
    }
    
    // 전화번호 정규화
    let normalizedFrom, normalizedTo;
    try {
      normalizedFrom = normalizePhoneNumber(from);
      normalizedTo = normalizePhoneNumber(to);
      console.log('정규화된 전화번호:', {
        from: `${from} -> ${normalizedFrom}`,
        to: `${to} -> ${normalizedTo}`
      });
    } catch (phoneError) {
      console.error('전화번호 정규화 실패:', phoneError);
      response.status(400).json({
        success: false,
        error: phoneError.message
      });
      return;
    }
    
    const timestamp = Date.now().toString();
    const method = 'POST';
    const url = `/sms/v2/services/${serviceId}/messages`;
    const baseUrl = 'https://sens.apigw.ntruss.com';
    
    // 서명 생성
    const signature = makeSignature(method, url, timestamp, accessKey, secretKey);
    
    // 헤더 설정
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'x-ncp-apigw-timestamp': timestamp,
      'x-ncp-iam-access-key': accessKey,
      'x-ncp-apigw-signature-v2': signature
    };
    
    // 이모지 제거 (SENS API는 멀티바이트 이모지를 지원하지 않음)
    const cleanContent = removeEmojis(content);
    
    console.log('메시지 처리:', {
      original: content,
      cleaned: cleanContent,
      originalLength: content.length,
      cleanedLength: cleanContent.length
    });
    
    // SMS/LMS 타입 결정 (한글 기준 45자/90바이트)
    const messageType = cleanContent.length > 45 ? 'LMS' : 'SMS';
    
    // 요청 본문
    const body = {
      type: messageType,
      contentType: 'COMM',
      countryCode: '82',
      from: normalizedFrom,
      content: cleanContent,
      messages: [{
        to: normalizedTo,
        content: cleanContent  // 개별 메시지 내용 (이모지 제거됨)
      }]
    };
    
    console.log('SENS API 요청:', {
      url: baseUrl + url,
      method: method,
      headers: headers,
      body: JSON.stringify(body, null, 2)
    });
    
    // API 호출
    const apiResponse = await fetch(baseUrl + url, {
      method: method,
      headers: headers,
      body: JSON.stringify(body)
    });
    
    const responseText = await apiResponse.text();
    console.log('SENS API 응답 상태:', apiResponse.status);
    console.log('SENS API 응답 본문:', responseText);
    
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.error('응답 파싱 실패:', responseText);
      result = { error: responseText };
    }
    
    // 202 Accepted가 성공 상태
    if (apiResponse.status === 202 || (apiResponse.ok && result.requestId)) {
      console.log('SMS 발송 성공:', result);
      
      // SMS 발송 로그 저장
      try {
        await db.collection('sms_logs').add({
          reservationId: request.body.reservationId || null,
          phone: normalizedTo.substring(0, 7) + '****', // 개인정보 보호
          message: content.substring(0, 50) + '...', // 메시지 일부만 저장
          status: 'success',
          requestId: result.requestId,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (logError) {
        console.error('로그 저장 실패:', logError);
      }
      
      response.status(200).json({
        success: true,
        requestId: result.requestId,
        requestTime: result.requestTime,
        statusCode: result.statusCode,
        statusName: result.statusName
      });
    } else {
      // 에러 상세 분석
      let errorMessage = 'SMS 발송 실패';
      let solution = '';
      
      if (apiResponse.status === 400) {
        errorMessage = '잘못된 요청 (400)';
        if (result.invalidRequestParameters) {
          solution = `잘못된 파라미터: ${JSON.stringify(result.invalidRequestParameters)}`;
        } else {
          solution = '요청 형식을 확인해주세요. 발신번호가 사전 등록되어 있는지 확인하세요.';
        }
      } else if (apiResponse.status === 401) {
        errorMessage = '인증 실패 (401)';
        solution = 'Access Key와 Secret Key를 다시 확인해주세요.';
      } else if (apiResponse.status === 403) {
        errorMessage = '권한 없음 (403)';
        solution = 'SENS 서비스 접근 권한을 확인해주세요.';
      } else if (apiResponse.status === 404) {
        errorMessage = '서비스를 찾을 수 없음 (404)';
        solution = `Service ID를 확인해주세요: ${serviceId}`;
      } else if (apiResponse.status === 429) {
        errorMessage = 'API 호출 한도 초과 (429)';
        solution = '잠시 후 다시 시도해주세요.';
      } else if (apiResponse.status === 500) {
        errorMessage = 'SENS 서버 오류 (500)';
        solution = 'SENS 서비스 상태를 확인해주세요.';
      }
      
      console.error('SENS API 에러:', {
        status: apiResponse.status,
        errorMessage,
        solution,
        details: result
      });
      
      // 실패 로그 저장
      try {
        await db.collection('sms_logs').add({
          reservationId: request.body.reservationId || null,
          phone: normalizedTo.substring(0, 7) + '****',
          status: 'failed',
          error: errorMessage,
          solution: solution,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (logError) {
        console.error('로그 저장 실패:', logError);
      }
      
      response.status(400).json({
        success: false,
        error: errorMessage,
        solution: solution,
        statusCode: apiResponse.status,
        details: result
      });
    }
  } catch (error) {
    console.error('SMS 발송 중 예외 발생:', error);
    console.error('에러 스택:', error.stack);
    
    // 예외 로그 저장
    try {
      await db.collection('sms_logs').add({
        reservationId: request.body.reservationId || null,
        phone: request.body.to?.substring(0, 7) + '****',
        status: 'error',
        error: error.message,
        stack: error.stack,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (logError) {
      console.error('로그 저장 실패:', logError);
    }
    
    response.status(500).json({
      success: false,
      error: error.message || 'SMS 발송 중 오류가 발생했습니다.',
      stack: error.stack
    });
  }
});

// IP 차단 확인
export const checkIPBlock = functions.https.onRequest(async (request, response) => {
  setCorsHeaders(response);
  
  if (request.method === 'OPTIONS') {
    response.status(204).send('');
    return;
  }
  
  response.status(200).json({ 
    blocked: false,
    ip: request.headers['x-forwarded-for'] || request.ip || 'unknown'
  });
});

// 로그인 추적
export const trackLoginAttempt = functions.https.onRequest(async (request, response) => {
  setCorsHeaders(response);
  
  if (request.method === 'OPTIONS') {
    response.status(204).send('');
    return;
  }
  
  response.status(200).json({ success: true });
});

// 헬스 체크
export const healthCheck = functions.https.onRequest((request, response) => {
  setCorsHeaders(response);
  response.status(200).json({ 
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// 스케줄러 import는 모든 초기화 이후에
export { notificationScheduler } from './notificationScheduler.js';
export { autoSendSMSScheduler, triggerSMSScheduler } from './smsScheduler.js';
export { sendBulkSMS, getBulkSMSStats } from './bulkSMS.js';