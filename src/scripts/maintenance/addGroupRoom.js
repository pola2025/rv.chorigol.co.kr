// addGroupRoom.js
// 단체예약 객실 추가 스크립트

import { collection, addDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../config/firebase.js';

const addGroupRoom = async () => {
  try {
    console.log('단체예약 객실을 추가합니다...');
    
    // 현재 객실들의 최대 order 값 찾기
    const roomsRef = collection(db, 'rooms');
    const q = query(roomsRef, orderBy('order', 'desc'), limit(1));
    const snapshot = await getDocs(q);
    
    let maxOrder = 0;
    if (!snapshot.empty) {
      maxOrder = snapshot.docs[0].data().order || 0;
    }
    
    // 단체예약 객실 데이터
    const groupRoom = {
      객실명: '초호쉼터 단체예약',
      객실타입: 'GROUP',  // 단체 타입
      기준인원: 20,
      최대인원: 50,
      기본가격: 0,  // 단체예약은 별도 협의
      주말가격: 0,
      인원추가가격: 0,
      설명: '20명 이상 단체 고객을 위한 전체 펜션 대관',
      특징: [
        '전체 펜션 독점 사용',
        '바베큐 시설 무료 이용',
        '캠프파이어 가능',
        '단체 행사 지원',
        '주차장 완비'
      ],
      시설: [
        '전 객실 사용 가능',
        '야외 바베큐장',
        '캠프파이어장',
        '넓은 주차장',
        '단체 식사 공간'
      ],
      어메니티: [
        '기본 어메니티 제공',
        '바베큐 그릴',
        '캠프파이어 장작',
        '단체용 식기'
      ],
      체크인: '15:00',
      체크아웃: '11:00',
      order: maxOrder + 1,
      활성화: true,
      생성일: new Date().toISOString(),
      수정일: new Date().toISOString(),
      
      // 단체예약 전용 필드
      단체예약전용: true,
      최소인원: 20,
      예약방식: 'PHONE_ONLY',  // 전화 예약만 가능
      가격정책: 'NEGOTIABLE',  // 협의 가능
      포함객실: [
        'Forest',
        'Forest mini', 
        'Forest 미니패밀리',
        'Forest 패밀리',
        '호수뷰객실'
      ]
    };
    
    // 객실 추가
    const docRef = await addDoc(roomsRef, groupRoom);
    console.log(`✅ 단체예약 객실이 추가되었습니다. ID: ${docRef.id}`);
    
    // 단체예약 관련 옵션 추가
    const optionsRef = collection(db, 'options');
    const groupOptions = [
      {
        id: 'group_meal',
        name: '단체 식사',
        type: 'custom',
        price: 0,  // 인원수에 따라 다름
        priceType: 'negotiable',
        applicableRooms: 'selected',
        selectedRooms: ['초호쉼터 단체예약'],
        description: '조식, 중식, 석식 제공 가능 (별도 협의)',
        isDefault: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'group_event',
        name: '단체 행사 지원',
        type: 'custom',
        price: 0,
        priceType: 'negotiable',
        applicableRooms: 'selected',
        selectedRooms: ['초호쉼터 단체예약'],
        description: '음향장비, 프로젝터, 행사 진행 지원',
        isDefault: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    
    for (const option of groupOptions) {
      await addDoc(optionsRef, option);
      console.log(`✅ 옵션 추가: ${option.name}`);
    }
    
    console.log('✅ 모든 작업이 완료되었습니다.');
    
  } catch (error) {
    console.error('❌ 단체예약 객실 추가 중 오류 발생:', error);
  }
};

// 실행
addGroupRoom();
