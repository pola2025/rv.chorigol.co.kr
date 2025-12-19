// Minimal Cloud Functions with full CORS support
import * as functions from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { sendSENSSMS, testSENSConnection } from './sensFunction';

// Initialize
initializeApp();
const db = getFirestore();

// Export SENS functions
export { sendSENSSMS, testSENSConnection };

// Simple CORS headers
const setCorsHeaders = (response) => {
  response.set('Access-Control-Allow-Origin', '*');
  response.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.set('Access-Control-Max-Age', '3600');
};

// IP 차단 확인
export const checkIPBlock = functions.https.onRequest(async (request, response) => {
  setCorsHeaders(response);
  
  if (request.method === 'OPTIONS') {
    response.status(204).send('');
    return;
  }
  
  try {
    const ip = request.headers['x-forwarded-for'] || request.ip || 'unknown';
    console.log('Checking IP:', ip);
    
    // 항상 차단되지 않음으로 응답 (임시)
    response.status(200).json({ 
      blocked: false,
      ip: ip 
    });
  } catch (error) {
    console.error('Error:', error);
    response.status(200).json({ blocked: false });
  }
});

// 로그인 추적
export const trackLoginAttempt = functions.https.onRequest(async (request, response) => {
  setCorsHeaders(response);
  
  if (request.method === 'OPTIONS') {
    response.status(204).send('');
    return;
  }
  
  try {
    const { email, success } = request.body || {};
    const ip = request.headers['x-forwarded-for'] || request.ip || 'unknown';
    
    console.log('Login attempt:', { email, success, ip });
    
    // 로그 저장 시도 (실패해도 무시)
    try {
      await db.collection('login_attempts').add({
        email: email || 'unknown',
        success: success || false,
        ip: ip,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.log('Failed to save login attempt:', e);
    }
    
    response.status(200).json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    response.status(200).json({ success: true });
  }
});

// Health check
export const healthCheck = functions.https.onRequest((request, response) => {
  setCorsHeaders(response);
  response.status(200).json({ 
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});
