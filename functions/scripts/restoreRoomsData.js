import admin from 'firebase-admin';

// Firebase Admin 초기화
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function restoreRoomsData() {
  try {
    console.log('객실 데이터 복원 시작...');
    
    const roomsData = [
      {
        id: 'room-101',
        name: '바다뷰 스위트',
        type: 'suite',
        capacity: {
          standard: 2,
          maximum: 4
        },
        amenities: [
          '바다 전망',
          '킹사이즈 침대',
          '소파베드',
          '미니 냉장고',
          '커피머신',
          '발코니'
        ],
        basePrice: 150000,
        weekendPrice: 180000,
        peakPrice: 220000,
        images: [
          '/images/rooms/suite-101-1.jpg',
          '/images/rooms/suite-101-2.jpg'
        ],
        description: '넓은 바다 전망과 함께 럭셔리한 휴식을 즐길 수 있는 스위트룸입니다.',
        area: 45,
        bedType: 'king',
        bathType: 'bathtub',
        isActive: true,
        order: 1,
        created: admin.firestore.FieldValue.serverTimestamp(),
        updated: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        id: 'room-102',
        name: '가든뷰 디럭스',
        type: 'deluxe',
        capacity: {
          standard: 2,
          maximum: 3
        },
        amenities: [
          '정원 전망',
          '퀸사이즈 침대',
          '미니 냉장고',
          '커피머신',
          '테라스'
        ],
        basePrice: 120000,
        weekendPrice: 140000,
        peakPrice: 170000,
        images: [
          '/images/rooms/deluxe-102-1.jpg',
          '/images/rooms/deluxe-102-2.jpg'
        ],
        description: '아름다운 정원을 바라보며 편안한 휴식을 취할 수 있는 디럭스룸입니다.',
        area: 35,
        bedType: 'queen',
        bathType: 'shower',
        isActive: true,
        order: 2,
        created: admin.firestore.FieldValue.serverTimestamp(),
        updated: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        id: 'room-103',
        name: '스탠다드 트윈',
        type: 'standard',
        capacity: {
          standard: 2,
          maximum: 2
        },
        amenities: [
          '트윈 침대',
          '미니 냉장고',
          '책상',
          '의자'
        ],
        basePrice: 80000,
        weekendPrice: 95000,
        peakPrice: 110000,
        images: [
          '/images/rooms/standard-103-1.jpg'
        ],
        description: '깔끔하고 편안한 스탠다드 트윈룸입니다.',
        area: 25,
        bedType: 'twin',
        bathType: 'shower',
        isActive: true,
        order: 3,
        created: admin.firestore.FieldValue.serverTimestamp(),
        updated: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        id: 'room-104',
        name: '패밀리룸',
        type: 'family',
        capacity: {
          standard: 4,
          maximum: 6
        },
        amenities: [
          '킹사이즈 침대',
          '이층침대',
          '대형 냉장고',
          '전자레인지',
          '소파',
          '테이블'
        ],
        basePrice: 200000,
        weekendPrice: 240000,
        peakPrice: 280000,
        images: [
          '/images/rooms/family-104-1.jpg',
          '/images/rooms/family-104-2.jpg',
          '/images/rooms/family-104-3.jpg'
        ],
        description: '가족 단위 고객을 위한 넓고 편안한 패밀리룸입니다.',
        area: 55,
        bedType: 'king+bunk',
        bathType: 'bathtub',
        isActive: true,
        order: 4,
        created: admin.firestore.FieldValue.serverTimestamp(),
        updated: admin.firestore.FieldValue.serverTimestamp()
      }
    ];

    // 기본 가격 규칙 데이터
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
        priceValue: 1.2,
        priority: 10,
        isActive: true,
        created: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        id: 'peak-season-rule',
        name: '성수기 요금',
        roomName: 'all',
        dateRange: {
          type: 'date_range',
          startDate: '2024-07-01',
          endDate: '2024-08-31'
        },
        priceType: 'multiplier',
        priceValue: 1.5,
        priority: 20,
        isActive: true,
        created: admin.firestore.FieldValue.serverTimestamp()
      }
    ];

    // 기본 옵션 데이터
    const optionsData = [
      {
        id: 'breakfast',
        name: '조식',
        type: 'service',
        price: 15000,
        description: '신선한 재료로 준비한 한식/양식 조식',
        isActive: true,
        order: 1,
        created: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        id: 'barbecue',
        name: '바베큐 세트',
        type: 'service',
        price: 40000,
        description: '2-4인용 바베큐 세트 (고기, 야채, 도구 포함)',
        isActive: true,
        order: 2,
        created: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        id: 'extra-bed',
        name: '엑스트라 베드',
        type: 'facility',
        price: 20000,
        description: '추가 침대 (1박당)',
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
    
    console.log('객실 데이터 복원 완료!');
    console.log(`- 객실: ${roomsData.length}개`);
    console.log(`- 가격 규칙: ${pricingRulesData.length}개`);
    console.log(`- 옵션: ${optionsData.length}개`);
    
  } catch (error) {
    console.error('데이터 복원 중 오류 발생:', error);
    throw error;
  }
}

// 스크립트 실행
restoreRoomsData()
  .then(() => {
    console.log('스크립트 실행 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('스크립트 실행 실패:', error);
    process.exit(1);
  });