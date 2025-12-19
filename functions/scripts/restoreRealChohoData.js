import admin from 'firebase-admin';

// Firebase Admin 초기화
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function restoreRealChohoData() {
  try {
    console.log('실제 초호 펜션 데이터 복원 시작...');
    
    // 실제 초호 펜션 객실 데이터
    const roomsData = [
      {
        id: 'forest',
        객실명: 'Forest',
        재고: 1,
        기준인원: 2,
        최대인원: 4,
        주중요금: 120000,
        주말요금: 140000,
        기본요금: 120000,
        추가인원요금: 20000,
        order: 1,
        created: admin.firestore.FieldValue.serverTimestamp(),
        updated: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        id: 'forest-mini',
        객실명: 'Forest mini',
        재고: 1,
        기준인원: 2,
        최대인원: 3,
        주중요금: 100000,
        주말요금: 120000,
        기본요금: 100000,
        추가인원요금: 20000,
        order: 2,
        created: admin.firestore.FieldValue.serverTimestamp(),
        updated: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        id: 'lake-view',
        객실명: '호수뷰객실',
        재고: 1,
        기준인원: 2,
        최대인원: 4,
        주중요금: 150000,
        주말요금: 170000,
        기본요금: 150000,
        추가인원요금: 20000,
        order: 3,
        created: admin.firestore.FieldValue.serverTimestamp(),
        updated: admin.firestore.FieldValue.serverTimestamp()
      }
    ];

    // 옵션 데이터
    const optionsData = [
      {
        id: 'camping_burner',
        name: '캐핑버너&그릴',
        type: 'equipment',
        price: 20000,
        description: '캐핑버너와 그릴 세트 (호수뷰객실 제외)',
        isActive: true,
        order: 1,
        created: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        id: 'charcoal_bbq',
        name: '숯불바베큐',
        type: 'service',
        price: 30000,
        description: '숯불바베큐 세트 (현장 결제)',
        isActive: true,
        order: 2,
        created: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        id: 'late_checkout',
        name: '레이트 체크아웃',
        type: 'service',
        price: 0,
        description: '14:00까지 체크아웃 (Forest, Forest mini만)',
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

    // 옵션 데이터 추가
    optionsData.forEach(option => {
      const optionRef = db.collection('options').doc(option.id);
      batch.set(optionRef, option);
    });

    await batch.commit();
    
    console.log('실제 초호 펜션 데이터 복원 완료!');
    console.log(`- 객실: ${roomsData.length}개 (Forest, Forest mini, 호수뷰객실)`);
    console.log(`- 옵션: ${optionsData.length}개 (캐핑버너&그릴, 숯불바베큐, 레이트 체크아웃)`);
    
  } catch (error) {
    console.error('데이터 복원 중 오류 발생:', error);
    throw error;
  }
}

// 스크립트 실행
restoreRealChohoData()
  .then(() => {
    console.log('스크립트 실행 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('스크립트 실행 실패:', error);
    process.exit(1);
  });