import admin from 'firebase-admin';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Firebase Admin 초기화
async function initializeFirebase() {
  if (!admin.apps.length) {
    // 1. 먼저 에뮬레이터 확인
    if (process.env.FIRESTORE_EMULATOR_HOST) {
      console.log('Firebase Emulator 사용 중...');
      admin.initializeApp({
        projectId: 'demo-choho-pension'
      });
    } else {
      // 2. 서비스 계정 키 파일 확인
      try {
        const serviceAccountPath = join(__dirname, '../../serviceAccountKey.json');
        const serviceAccount = JSON.parse(await readFile(serviceAccountPath, 'utf8'));
        
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        console.log('서비스 계정 키로 초기화 완료');
      } catch (error) {
        // 3. 기본 인증 시도 (Google Cloud 환경)
        console.log('기본 인증 시도 중...');
        admin.initializeApp();
      }
    }
  }
}

async function restoreChohoFullData() {
  try {
    console.log('초호수뷰펜션 전체 데이터 복원 시작...');
    
    // Firebase 초기화
    await initializeFirebase();
    
    const db = admin.firestore();
    
    // 1. 객실 데이터
    const roomsData = [
      {
        id: 'forest',
        객실명: 'Forest',
        재고: 1,
        기준인원: 4,
        최대인원: 6,
        추가인원요금: 20000,
        기본요금: 150000,
        order: 1,
        created: admin.firestore.FieldValue.serverTimestamp(),
        updated: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        id: 'forest-mini',
        객실명: 'Forest mini',
        재고: 1,
        기준인원: 2,
        최대인원: 4,
        추가인원요금: 20000,
        기본요금: 100000,
        order: 2,
        created: admin.firestore.FieldValue.serverTimestamp(),
        updated: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        id: 'forest-family',
        객실명: 'Forest 패밀리',
        재고: 1,
        기준인원: 6,
        최대인원: 10,
        추가인원요금: 20000,
        기본요금: 250000,
        order: 3,
        created: admin.firestore.FieldValue.serverTimestamp(),
        updated: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        id: 'forest-mini-family',
        객실명: 'Forest mini 패밀리',
        재고: 1,
        기준인원: 4,
        최대인원: 6,
        추가인원요금: 20000,
        기본요금: 150000,
        order: 4,
        created: admin.firestore.FieldValue.serverTimestamp(),
        updated: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        id: 'lakeview',
        객실명: '호수뷰객실',
        재고: 1,
        기준인원: 2,
        최대인원: 4,
        추가인원요금: 25000,
        기본요금: 180000,
        order: 5,
        created: admin.firestore.FieldValue.serverTimestamp(),
        updated: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        id: 'group-reservation',
        객실명: '단체예약',
        재고: 5,
        기준인원: 15,
        최대인원: 50,
        추가인원요금: 15000,
        기본요금: 1000000, // 단체 기본 요금
        order: 6,
        created: admin.firestore.FieldValue.serverTimestamp(),
        updated: admin.firestore.FieldValue.serverTimestamp()
      }
    ];

    // 2. 가격 규칙 데이터
    const pricingRulesData = [
      {
        id: 'weekend-rule',
        name: '주말 요금',
        roomName: 'all',
        dateRange: {
          type: 'weekdays',
          weekdays: [5, 6] // 금, 토
        },
        priceType: 'multiplier',
        priceValue: 1.2, // 20% 증가
        priority: 10,
        isActive: true,
        created: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        id: 'peak-season-summer',
        name: '여름 성수기',
        roomName: 'all',
        dateRange: {
          type: 'date_range',
          startDate: '2025-07-01',
          endDate: '2025-08-31'
        },
        priceType: 'multiplier',
        priceValue: 1.5, // 50% 증가
        priority: 20,
        isActive: true,
        created: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        id: 'peak-season-winter',
        name: '겨울 성수기',
        roomName: 'all',
        dateRange: {
          type: 'date_range',
          startDate: '2025-12-24',
          endDate: '2026-01-02'
        },
        priceType: 'multiplier',
        priceValue: 1.4, // 40% 증가
        priority: 20,
        isActive: true,
        created: admin.firestore.FieldValue.serverTimestamp()
      }
    ];

    // 3. 옵션 데이터
    const optionsData = [
      {
        id: 'camping_burner',
        name: '캐핑버너&그릴',
        type: 'service',
        price: 20000,
        description: '호수뷰객실 제외, 객실 요금에 포함',
        isActive: true,
        order: 1,
        created: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        id: 'charcoal_bbq',
        name: '숯불바베큐',
        type: 'service',
        price: 30000,
        description: '현장 결제',
        isActive: true,
        order: 2,
        created: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        id: 'late_checkout',
        name: '레이트 체크아웃',
        type: 'service',
        price: 0,
        description: 'Forest, Forest mini 객실만 가능 (14:00까지)',
        isActive: true,
        order: 3,
        created: admin.firestore.FieldValue.serverTimestamp()
      }
    ];

    const batch = db.batch();

    // 객실 데이터 추가
    roomsData.forEach(room => {
      const roomRef = db.collection('rooms').doc(room.id);
      batch.set(roomRef, room);
    });

    // 가격 규칙 데이터 추가
    pricingRulesData.forEach(rule => {
      const ruleRef = db.collection('pricing_rules').doc(rule.id);
      batch.set(ruleRef, rule);
    });

    // 옵션 데이터 추가
    optionsData.forEach(option => {
      const optionRef = db.collection('options').doc(option.id);
      batch.set(optionRef, option);
    });

    await batch.commit();
    
    console.log('초호수뷰펜션 전체 데이터 복원 완료!');
    console.log(`- 객실: ${roomsData.length}개`);
    console.log(`- 가격 규칙: ${pricingRulesData.length}개`);
    console.log(`- 옵션: ${optionsData.length}개`);
    
    console.log('\n복원된 객실 목록:');
    roomsData.forEach(room => {
      console.log(`  - ${room.객실명} (${room.기준인원}-${room.최대인원}인) - 기본요금: ${room.기본요금.toLocaleString()}원`);
    });
    
  } catch (error) {
    console.error('데이터 복원 중 오류 발생:', error);
    throw error;
  }
}

// 스크립트 실행
restoreChohoFullData()
  .then(() => {
    console.log('스크립트 실행 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('스크립트 실행 실패:', error);
    process.exit(1);
  });