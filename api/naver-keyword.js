// Vercel Serverless Function - 네이버 검색광고 API 프록시
import crypto from 'crypto';

// HMAC-SHA256 서명 생성
function makeSignature(timestamp, method, path, secretKey) {
  const message = `${timestamp}.${method}.${path}`;
  const hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(message);
  return hmac.digest('base64');
}

export default async function handler(req, res) {
  // CORS 헤더
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { keywords, showDetail = true } = req.body;

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({
        success: false,
        error: '검색어 목록이 필요합니다.'
      });
    }

    // API 키 (환경변수 또는 하드코딩)
    const accessLicense = process.env.NAVER_AD_ACCESS_LICENSE || '0100000000c00ae8a28657f54600760fdd62b10a9fee18c318ab638d6a7dc77eae37bf53dd';
    const secretKey = process.env.NAVER_AD_SECRET_KEY || 'AQAAAADACuiihlf1RgB2D91isQqffrx2bXGlSs7jB79+AJyYNg==';
    const customerId = process.env.NAVER_AD_CUSTOMER_ID || '';

    const timestamp = Date.now().toString();
    const method = 'GET';
    const path = '/keywordstool';
    const baseUrl = 'https://api.searchad.naver.com';

    // 쿼리 파라미터
    const queryParams = new URLSearchParams();
    queryParams.append('hintKeywords', keywords.join(','));
    queryParams.append('showDetail', showDetail ? '1' : '0');

    const fullUrl = `${baseUrl}${path}?${queryParams.toString()}`;
    const signature = makeSignature(timestamp, method, path, secretKey);

    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Timestamp': timestamp,
      'X-API-KEY': accessLicense,
      'X-Signature': signature
    };

    if (customerId) {
      headers['X-Customer'] = customerId;
    }

    console.log('네이버 검색광고 API 호출:', { url: fullUrl, keywords });

    const apiResponse = await fetch(fullUrl, { method, headers });
    const responseText = await apiResponse.text();

    console.log('API 응답 상태:', apiResponse.status);

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      result = { error: responseText };
    }

    if (apiResponse.ok) {
      const keywordList = result.keywordList || [];

      const processedData = keywordList.map(item => ({
        keyword: item.relKeyword,
        monthlyPcCnt: item.monthlyPcQcCnt || 0,
        monthlyMobileCnt: item.monthlyMobileQcCnt || 0,
        totalMonthlyCount: (item.monthlyPcQcCnt || 0) + (item.monthlyMobileQcCnt || 0),
        monthlyAvgClickCnt: item.monthlyAvgClkCnt || 0,
        monthlyAvgClickRate: item.monthlyAvgCtr || 0,
        compIdx: item.compIdx || '-',
        plAvgDepth: item.plAvgDepth || 0
      }));

      return res.status(200).json({
        success: true,
        data: processedData,
        totalCount: processedData.length,
        requestedKeywords: keywords
      });
    } else {
      let errorMessage = '네이버 검색광고 API 호출 실패';

      if (apiResponse.status === 401) {
        errorMessage = '인증 실패 - API 키를 확인해주세요';
      } else if (apiResponse.status === 403) {
        errorMessage = '권한 없음 - 고객 ID가 필요할 수 있습니다';
      } else if (apiResponse.status === 429) {
        errorMessage = 'API 호출 한도 초과';
      }

      return res.status(apiResponse.status).json({
        success: false,
        error: errorMessage,
        details: result
      });
    }
  } catch (error) {
    console.error('API 호출 오류:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
