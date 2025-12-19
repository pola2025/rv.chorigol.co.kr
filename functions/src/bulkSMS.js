// functions/src/bulkSMS.js
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';
import fetch from 'node-fetch';

const db = getFirestore();

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
            type: content.length > 45 ? 'LMS' : 'SMS',
            contentType: 'COMM',
            countryCode: '82',
            from: this.from.replace(/-/g, ''),
            content: content,
            messages: [{ 
              to: normalizedTo,
              content: content  // 개별 메시지 내용
            }]
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

// 대량 SMS 발송 (개인정보 보호 강화)
export const sendBulkSMS = onCall({
  region: 'asia-northeast3',
  cors: true,
  maxInstances: 10  // 동시 처리 제한
}, async (request) => {
  // 인증 확인
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '인증이 필요합니다.');
  }

  const { to, message, recipientName, recipientId } = request.data;
  
  if (!to || !message) {
    throw new HttpsError('invalid-argument', '수신자와 메시지는 필수입니다.');
  }

  try {
    // 관리자 권한 확인 (옵션)
    const userDoc = await db.doc(`users/${request.auth.uid}`).get();
    if (userDoc.exists && !userDoc.data().isAdmin) {
      throw new HttpsError('permission-denied', '관리자 권한이 필요합니다.');
    }

    // SMS 설정 가져오기 (초호펜션 기본)
    const settingsDoc = await db.doc('settings/notifications_choho').get();
    if (!settingsDoc.exists) {
      throw new HttpsError('failed-precondition', 'SMS 설정이 없습니다.');
    }

    const settings = settingsDoc.data();
    if (!settings.sens?.serviceId) {
      throw new HttpsError('failed-precondition', 'SENS 설정이 완료되지 않았습니다.');
    }

    // SENS API 초기화
    const sens = new NaverSensAPI(settings.sens);
    
    // SMS 발송 (개별 발송으로 개인정보 보호)
    const result = await sens.sendSMS(to, message);
    
    if (result.success) {
      // 발송 로그 저장 (개인정보 마스킹)
      await db.collection('bulk_sms_logs').add({
        senderId: request.auth.uid,
        recipientId: recipientId,
        recipientName: recipientName,
        recipientPhone: to.substring(0, 7) + '****',  // 전화번호 마스킹
        messagePreview: message.substring(0, 50) + '...',  // 메시지 일부만
        status: 'success',
        requestId: result.requestId,
        sentAt: FieldValue.serverTimestamp(),
        isBulkSend: true
      });
      
      console.log(`✅ 대량 SMS 발송 성공: ${recipientName} (${to.substring(0, 7)}****)`);
      
      return {
        success: true,
        requestId: result.requestId,
        message: '발송 완료'
      };
    } else {
      // 실패 로그 저장
      await db.collection('bulk_sms_logs').add({
        senderId: request.auth.uid,
        recipientId: recipientId,
        recipientName: recipientName,
        recipientPhone: to.substring(0, 7) + '****',
        status: 'failed',
        error: result.error,
        sentAt: FieldValue.serverTimestamp(),
        isBulkSend: true
      });
      
      throw new HttpsError('internal', `발송 실패: ${result.error}`);
    }
  } catch (error) {
    console.error('대량 SMS 발송 오류:', error);
    
    if (error instanceof HttpsError) {
      throw error;
    }
    
    throw new HttpsError('internal', '대량 SMS 발송 중 오류가 발생했습니다.');
  }
});

// 대량 발송 통계 조회
export const getBulkSMSStats = onCall({
  region: 'asia-northeast3',
  cors: true
}, async (request) => {
  // 인증 확인
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '인증이 필요합니다.');
  }

  try {
    const { startDate, endDate } = request.data;
    
    // 기간별 통계 조회
    let query = db.collection('bulk_sms_logs')
      .where('senderId', '==', request.auth.uid)
      .where('isBulkSend', '==', true);
    
    if (startDate) {
      query = query.where('sentAt', '>=', new Date(startDate));
    }
    if (endDate) {
      query = query.where('sentAt', '<=', new Date(endDate));
    }
    
    const snapshot = await query.get();
    
    const stats = {
      total: 0,
      success: 0,
      failed: 0,
      cost: 0,
      logs: []
    };
    
    snapshot.forEach(doc => {
      const data = doc.data();
      stats.total++;
      
      if (data.status === 'success') {
        stats.success++;
        stats.cost += 20;  // SMS 단가
      } else {
        stats.failed++;
      }
      
      stats.logs.push({
        id: doc.id,
        ...data,
        sentAt: data.sentAt?.toDate()
      });
    });
    
    return stats;
  } catch (error) {
    console.error('통계 조회 오류:', error);
    throw new HttpsError('internal', '통계 조회 중 오류가 발생했습니다.');
  }
});
