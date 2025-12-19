const functions = require('firebase-functions');
const cors = require('cors')({ 
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://choho-pension.web.app',
    'https://choho-pension.firebaseapp.com'
  ],
  credentials: true 
});

// checkIPBlock 함수에 CORS 적용
exports.checkIPBlock = functions.https.onRequest((request, response) => {
  cors(request, response, async () => {
    // 기존 로직
    try {
      // IP 차단 체크 로직
      response.status(200).json({ blocked: false });
    } catch (error) {
      console.error('Error checking IP block:', error);
      response.status(500).json({ error: 'Internal server error' });
    }
  });
});

// trackLoginAttempt 함수에 CORS 적용
exports.trackLoginAttempt = functions.https.onRequest((request, response) => {
  cors(request, response, async () => {
    // 기존 로직
    try {
      // 로그인 시도 추적 로직
      response.status(200).json({ success: true });
    } catch (error) {
      console.error('Error tracking login attempt:', error);
      response.status(500).json({ error: 'Internal server error' });
    }
  });
});
