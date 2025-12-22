// 네이버 검색광고 API 프록시 (검색어 검색량 조회)
import * as functions from 'firebase-functions';
import CryptoJS from 'crypto-js';
import fetch from 'node-fetch';

// CORS 헤더 설정
const setCorsHeaders = (response) => {
  response.set('Access-Control-Allow-Origin', '*');
  response.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.set('Access-Control-Max-Age', '3600');
};

// 네이버 검색광고 API 서명 생성
const makeNaverAdSignature = (timestamp, method, path, secretKey) => {
  const message = `${timestamp}.${method}.${path}`;
  const hmac = CryptoJS.HmacSHA256(message, secretKey);
  return CryptoJS.enc.Base64.stringify(hmac);
};

/**
 * 네이버 검색광고 API - 키워드 검색량 조회
 *
 * 요청 본문:
 * {
 *   keywords: ['초호펜션', '초호쉼터', '초리골164카페'],
 *   showDetail: true  // 월별 상세 데이터 포함 여부
 * }
 */
export const getKeywordSearchVolume = functions.region('asia-northeast3').https.onRequest(async (request, response) => {
  setCorsHeaders(response);

  if (request.method === 'OPTIONS') {
    response.status(204).send('');
    return;
  }

  console.log('=== 네이버 검색광고 API 호출 시작 ===');

  try {
    const { keywords, showDetail = true } = request.body;

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      response.status(400).json({
        success: false,
        error: '검색어 목록이 필요합니다.'
      });
      return;
    }

    // 환경 변수에서 API 키 가져오기 (또는 하드코딩)
    const accessLicense = process.env.NAVER_AD_ACCESS_LICENSE || '0100000000c00ae8a28657f54600760fdd62b10a9fee18c318ab638d6a7dc77eae37bf53dd';
    const secretKey = process.env.NAVER_AD_SECRET_KEY || 'AQAAAADACuiihlf1RgB2D91isQqffrx2bXGlSs7jB79+AJyYNg==';
    const customerId = process.env.NAVER_AD_CUSTOMER_ID || '';

    const timestamp = Date.now().toString();
    const method = 'GET';
    const path = '/keywordstool';
    const baseUrl = 'https://api.searchad.naver.com';

    // 쿼리 파라미터 구성
    const queryParams = new URLSearchParams();
    queryParams.append('hintKeywords', keywords.join(','));
    queryParams.append('showDetail', showDetail ? '1' : '0');

    const fullPath = `${path}?${queryParams.toString()}`;
    const signature = makeNaverAdSignature(timestamp, method, path, secretKey);

    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Timestamp': timestamp,
      'X-API-KEY': accessLicense,
      'X-Signature': signature
    };

    // 고객 ID가 있으면 추가
    if (customerId) {
      headers['X-Customer'] = customerId;
    }

    console.log('API 요청:', {
      url: baseUrl + fullPath,
      method,
      headers: { ...headers, 'X-API-KEY': '***', 'X-Signature': '***' }
    });

    const apiResponse = await fetch(baseUrl + fullPath, {
      method,
      headers
    });

    const responseText = await apiResponse.text();
    console.log('API 응답 상태:', apiResponse.status);
    console.log('API 응답 본문:', responseText.substring(0, 500));

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.error('응답 파싱 실패:', responseText);
      result = { error: responseText };
    }

    if (apiResponse.ok) {
      // 데이터 가공
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

      response.status(200).json({
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
        errorMessage = '권한 없음 - 접근 권한을 확인해주세요';
      } else if (apiResponse.status === 429) {
        errorMessage = 'API 호출 한도 초과';
      }

      response.status(apiResponse.status).json({
        success: false,
        error: errorMessage,
        details: result
      });
    }
  } catch (error) {
    console.error('API 호출 중 오류:', error);
    response.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});
