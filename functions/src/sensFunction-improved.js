// functions/src/sensFunction-improved.js
import * as functions from 'firebase-functions';
import CryptoJS from 'crypto-js';
import fetch from 'node-fetch';

// CORS 헤더 설정
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

// SENS SMS 발송 함수 (개선된 버전)
export const sendSENSSMS = functions.https.onRequest(async (request, response) => {
  setCorsHeaders(response);
  
  // OPTIONS 요청 처리
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
    
    // SMS/LMS 타입 결정 (한글 기준 45자/90바이트)
    const messageType = content.length > 45 ? 'LMS' : 'SMS';
    
    // 요청 본문
    const body = {
      type: messageType,
      contentType: 'COMM',
      countryCode: '82',
      from: normalizedFrom,
      content: content,
      messages: [{
        to: normalizedTo,
        content: content  // 개별 메시지 내용 (동일하게 설정)
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
    response.status(500).json({
      success: false,
      error: error.message || 'SMS 발송 중 오류가 발생했습니다.',
      stack: error.stack
    });
  }
});

// SENS 연결 테스트 (개선된 버전)
export const testSENSConnection = functions.https.onRequest(async (request, response) => {
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
    
    const body = {
      type: 'SMS',
      contentType: 'COMM',
      countryCode: '82',
      from: normalizedFrom,
      content: testMessage,
      messages: [{
        to: normalizedFrom,  // 자기 자신에게 테스트
        content: testMessage
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