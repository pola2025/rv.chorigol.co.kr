import admin from 'firebase-admin';
import { readFile, writeFile } from 'fs/promises';
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

async function backupData() {
  try {
    console.log('데이터 백업 시작...');
    
    // Firebase 초기화
    await initializeFirebase();
    
    const db = admin.firestore();
    const backupData = {};
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // 백업할 컬렉션 목록
    const collections = [
      'rooms',
      'reservations', 
      'pricing_rules',
      'options',
      'customers',
      'inventory_overrides',
      'blocked_dates'
    ];
    
    // 각 컬렉션 백업
    for (const collectionName of collections) {
      console.log(`${collectionName} 백업 중...`);
      const snapshot = await db.collection(collectionName).get();
      
      backupData[collectionName] = [];
      snapshot.forEach(doc => {
        backupData[collectionName].push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      console.log(`  - ${backupData[collectionName].length}개 문서 백업 완료`);
    }
    
    // 백업 파일 저장
    const backupPath = join(__dirname, '../../backups', `backup_${timestamp}.json`);
    await writeFile(backupPath, JSON.stringify(backupData, null, 2));
    
    console.log('✅ 백업 완료!');
    console.log(`📁 백업 파일: ${backupPath}`);
    
    // 백업 통계
    console.log('\n📊 백업 통계:');
    for (const [collection, data] of Object.entries(backupData)) {
      console.log(`  - ${collection}: ${data.length}개`);
    }
    
  } catch (error) {
    console.error('백업 중 오류 발생:', error);
    throw error;
  }
}

// 스크립트 실행
backupData()
  .then(() => {
    console.log('백업 스크립트 실행 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('백업 스크립트 실행 실패:', error);
    process.exit(1);
  });
