// manual-trigger-sms.js
// SMS 수동 발송 테스트 스크립트

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const crypto = require('crypto');
const fetch = require('node-fetch');

// Firebase Admin 초기화
const serviceAccount = require('./service-account-key.json');
initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

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

// SENS API 클래스
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
    
    const normalizedTo = to.replace(/[-\s]/g, '');
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

// 템플릿 가져오기
async function getTemplate(reservation, templateType, businessType) {
  try {
    const docName = businessType === 'shelter' ? 'notifications_v2_shelter' : 'notifications_v2_choho';
    const doc = await db.doc(`settings/${docName}`).get();
    
    if (doc.exists) {
      const data = doc.data();
      const roomSettings = data.roomSettings?.[reservation.roomName];
      
      // 객실별 템플릿 우선
      if (roomSettings?.templates?.[templateType]) {
        const template = roomSettings.templates[templateType];
        return typeof template === 'object' ? template.content : template;
      }
      
      // 전역 템플릿
      if (data.messageTemplates?.[templateType]) {
        const template = data.messageTemplates[templateType];
        return typeof template === 'object' ? template.content : template;
      }
    }
    
    // 기본 템플릿
    const defaults = {
      checkIn: '[{펜션명}]\n{고객명}님, 오늘 입실입니다.\n\n⏰ 입실: 오후 3시\n🏠 객실: {객실명}\n📍 주소: {주소}\n\n편안한 여행 되세요',
      checkOut: '[{펜션명}]\n{고객명}님, 오늘 퇴실입니다.\n\n⏰ 퇴실: 오전 11시\n\n이용해 주셔서 감사합니다.\n안녕히 가세요'
    };
    
    return defaults[templateType];
  } catch (error) {
    console.error('템플릿 로드 실패:', error);
    return null;
  }
}

// 템플릿 변수 치환
function replaceTemplateVariables(template, reservation, businessType) {
  if (!template) return '';
  
  let message = template;
  const pensionName = businessType === 'shelter' ? '초호쉼터' : '초호펜션';
  
  message = message.replace(/{펜션명}/g, pensionName);
  message = message.replace(/{고객명}/g, reservation.customerName || '');
  message = message.replace(/{객실명}/g, reservation.roomName || '');
  message = message.replace(/{체크인}/g, reservation.checkIn || '');
  message = message.replace(/{체크아웃}/g, reservation.checkOut || '');
  message = message.replace(/{인원}/g, reservation.guests || reservation.guestCount || 2);
  message = message.replace(/{금액}/g, reservation.totalPrice ? `${reservation.totalPrice.toLocaleString()}원` : '');
  message = message.replace(/{주소}/g, '경기 파주시 법원읍 초리골길 138-17');
  
  return message;
}

// 수동 SMS 발송
async function manualSendSMS(type) {
  console.log('=' .repeat(60));
  console.log(`📱 ${type === 'checkIn' ? '입실 안내' : '퇴실 안내'} SMS 수동 발송`);
  console.log('=' .repeat(60));
  
  const today = new Date().toISOString().split('T')[0];
  const queryField = type;
  
  console.log(`\n오늘 날짜: ${today}`);
  console.log(`발송 타입: ${type === 'checkIn' ? '입실 안내' : '퇴실 안내'}`);
  
  // 해당 날짜의 예약 조회
  const reservationsSnapshot = await db.collection('reservations')
    .where(queryField, '==', today)
    .where('status', '==', '예약확정')
    .get();
  
  if (reservationsSnapshot.empty) {
    console.log(`\n❌ ${today} ${type === 'checkIn' ? '입실' : '퇴실'} 예약이 없습니다.`);
    return;
  }
  
  console.log(`\n✅ 발송 대상: ${reservationsSnapshot.size}건`);
  console.log('-'.repeat(40));
  
  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;
  
  for (const doc of reservationsSnapshot.docs) {
    const reservation = { id: doc.id, ...doc.data() };
    
    console.log(`\n👤 ${reservation.customerName} (${reservation.roomName})`);
    
    // 이미 발송된 경우
    if (reservation.smsStatus?.[`${type}Sent`]) {
      console.log('   ⏭️  이미 발송됨 - 스킵');
      skipCount++;
      continue;
    }
    
    // 전화번호 확인
    const phone = reservation.phone || reservation.customerPhone;
    if (!phone) {
      console.log('   ❌ 전화번호 없음 - 스킵');
      skipCount++;
      continue;
    }
    
    // 업체 구분 및 설정 로드
    const businessType = getBusinessType(reservation.roomName);
    const sensConfig = await getSENSConfig(businessType);
    
    if (!sensConfig) {
      console.log(`   ❌ SENS 설정 없음 (${businessType})`);
      failCount++;
      continue;
    }
    
    // 템플릿 가져오기
    const template = await getTemplate(reservation, type, businessType);
    if (!template) {
      console.log('   ❌ 템플릿 없음');
      failCount++;
      continue;
    }
    
    // 메시지 생성
    const message = replaceTemplateVariables(template, reservation, businessType);
    console.log('   📝 메시지 생성 완료');
    
    // SMS 발송
    console.log(`   📱 SMS 발송 중... (${phone})`);
    const sensAPI = new NaverSensAPI(sensConfig);
    const result = await sensAPI.sendSMS(phone, message);
    
    if (result.success) {
      // 발송 성공 상태 업데이트
      await doc.ref.update({
        [`smsStatus.${type}Sent`]: true,
        [`smsStatus.${type}SentAt`]: FieldValue.serverTimestamp(),
        [`smsStatus.${type}RequestId`]: result.requestId
      });
      
      console.log(`   ✅ 발송 성공! (Request ID: ${result.requestId})`);
      successCount++;
    } else {
      // 발송 실패 상태 업데이트
      await doc.ref.update({
        [`smsStatus.${type}Error`]: result.error || 'Unknown error',
        [`smsStatus.${type}Sent`]: false
      });
      
      console.log(`   ❌ 발송 실패: ${result.error}`);
      failCount++;
    }
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('📊 발송 결과 요약');
  console.log('=' .repeat(60));
  console.log(`✅ 성공: ${successCount}건`);
  console.log(`⏭️  스킵: ${skipCount}건`);
  console.log(`❌ 실패: ${failCount}건`);
}

// 메인 실행
async function main() {
  console.clear();
  console.log('🚀 SMS 수동 발송 테스트 도구');
  console.log('=' .repeat(60));
  
  const args = process.argv.slice(2);
  const type = args[0];
  
  if (!type || !['checkIn', 'checkOut'].includes(type)) {
    console.log('\n사용법:');
    console.log('  node manual-trigger-sms.js checkIn   # 입실 안내 발송');
    console.log('  node manual-trigger-sms.js checkOut  # 퇴실 안내 발송');
    console.log('\n예시:');
    console.log('  node manual-trigger-sms.js checkIn');
    return;
  }
  
  await manualSendSMS(type);
}

main().catch(console.error);
