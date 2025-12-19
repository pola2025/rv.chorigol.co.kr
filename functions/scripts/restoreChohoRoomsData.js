import admin from 'firebase-admin';

// Firebase Admin 초기화
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function restoreChohoRoomsData() {
  try {
    console.log('초호수뷰펜션 객실 데이터 복원 시작...');
    
    // 실제 초호수뷰펜션 객실 데이터
    const roomsData = [
      {
        id: 'forest',
        객실명: 'Forest',
        재고: 1,
        기준인원: 4,
        최대인원: 6,
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
        최대인원: 4,
        추가인원요금: 20000,
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
        order: 5,
        created: admin.firestore.FieldValue.serverTimestamp(),
        updated: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        id: 'group-reservation',
        객실명: '단체예약',
        재고: 5, // 단체예약은 여러 객실 조합이므로 재고를 높게 설정
        기준인원: 15,
        최대인원: 50,
        추가인원요금: 15000,
        order: 6,
        created: admin.firestore.FieldValue.serverTimestamp(),
        updated: admin.firestore.FieldValue.serverTimestamp()
      }
    ];

    const batch = db.batch();

    // 객실 데이터 추가
    roomsData.forEach(room => {
      const roomRef = db.collection('rooms').doc(room.id);
      batch.set(roomRef, room);
    });

    await batch.commit();
    
    console.log('초호수뷰펜션 객실 데이터 복원 완료!');
    console.log(`- 객실: ${roomsData.length}개`);
    console.log('복원된 객실:');
    roomsData.forEach(room => {
      console.log(`  - ${room.객실명} (${room.기준인원}-${room.최대인원}인)`);
    });
    
  } catch (error) {
    console.error('데이터 복원 중 오류 발생:', error);
    throw error;
  }
}

// 스크립트 실행
restoreChohoRoomsData()
  .then(() => {
    console.log('스크립트 실행 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('스크립트 실행 실패:', error);
    process.exit(1);
  });