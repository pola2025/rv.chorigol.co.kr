// functions/src/sensFunction.js
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

// HMAC 서명 생성
const makeSignature = (method, url, timestamp, accessKey, secretKey) => {
  const space = " ";
  const newLine = "\n";
  
  const hmac = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, secretKey);
  hmac.update(method);
  hmac.update(space);
  hmac.update(url);
  hmac.update(newLine);
  hmac.update(timestamp);
  hmac.update(newLine);
  hmac.update(accessKey);
  
  const hash = hmac.finalize();
  return hash.toString(CryptoJS.enc.Base64);
};

// SENS SMS 발송 함수
export const sendSENSSMS = functions.https.onRequest(async (request, response) => {
  setCorsHeaders(response);
  
  // OPTIONS 요청 처리
  if (request.method === 'OPTIONS') {
    response.status(204).send('');
    return;
  }
  
  try {
    const { serviceId, accessKey, secretKey, from, to, content } = request.body;
    
    // 필수 파라미터 검증
    if (!serviceId || !accessKey || !secretKey || !from || !to || !content) {
      response.status(400).json({
        success: false,
        error: '필수 파라미터가 누락되었습니다.'
      });
      return;
    }
    
    const timestamp = Date.now().toString();
    const method = 'POST';
    const url = `/sms/v2/services/${serviceId}/messages`;
    const baseUrl = 'https://sens.apigw.ntruss.com';
    
    const signature = makeSignature(method, url, timestamp, accessKey, secretKey);
    
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'x-ncp-apigw-timestamp': timestamp,
      'x-ncp-iam-access-key': accessKey,
      'x-ncp-apigw-signature-v2': signature
    };
    
    const body = {
      type: content.length > 90 ? 'LMS' : 'SMS',
      from: from.replace(/-/g, ''),
      content: content,
      messages: [{
        to: to.replace(/-/g, ''),
        content: content
      }]
    };
    
    console.log('SENS API Request:', {
      url: baseUrl + url,
      headers,
      body
    });
    
    const apiResponse = await fetch(baseUrl + url, {
      method: method,
      headers: headers,
      body: JSON.stringify(body)
    });
    
    const result = await apiResponse.json();
    
    if (apiResponse.ok) {
      response.status(200).json({
        success: true,
        requestId: result.requestId,
        requestTime: result.requestTime,
        statusCode: result.statusCode,
        statusName: result.statusName
      });
    } else {
      console.error('SENS API Error:', result);
      response.status(400).json({
        success: false,
        error: result.message || 'SMS 발송 실패',
        statusCode: result.statusCode,
        statusName: result.statusName
      });
    }
  } catch (error) {
    console.error('SMS 발송 중 오류:', error);
    response.status(500).json({
      success: false,
      error: error.message || 'SMS 발송 중 오류가 발생했습니다.'
    });
  }
});

// SENS 연결 테스트
export const testSENSConnection = functions.https.onRequest(async (request, response) => {
  setCorsHeaders(response);
  
  if (request.method === 'OPTIONS') {
    response.status(204).send('');
    return;
  }
  
  try {
    const { serviceId, accessKey, secretKey, from } = request.body;
    
    if (!serviceId || !accessKey || !secretKey) {
      response.status(400).json({
        success: false,
        error: 'SENS 설정 정보가 누락되었습니다.'
      });
      return;
    }
    
    // 간단한 연결 테스트 - 서비스 정보 확인
    const timestamp = Date.now().toString();
    const method = 'GET';
    const url = `/sms/v2/services/${serviceId}`;
    const baseUrl = 'https://sens.apigw.ntruss.com';
    
    const signature = makeSignature(method, url, timestamp, accessKey, secretKey);
    
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'x-ncp-apigw-timestamp': timestamp,
      'x-ncp-iam-access-key': accessKey,
      'x-ncp-apigw-signature-v2': signature
    };
    
    const apiResponse = await fetch(baseUrl + url, {
      method: method,
      headers: headers
    });
    
    const result = await apiResponse.json();
    
    if (apiResponse.ok) {
      response.status(200).json({
        success: true,
        message: 'SENS 연결 테스트 성공',
        service: {
          serviceId: result.serviceId,
          serviceName: result.serviceName
        }
      });
    } else {
      console.error('SENS Connection Test Failed:', result);
      response.status(400).json({
        success: false,
        error: result.message || 'SENS 연결 테스트 실패',
        details: result
      });
    }
  } catch (error) {
    console.error('SENS 테스트 중 오류:', error);
    response.status(500).json({
      success: false,
      error: error.message || 'SENS 테스트 중 오류가 발생했습니다.'
    });
  }
});