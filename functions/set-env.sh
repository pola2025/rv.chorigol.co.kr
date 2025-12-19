# Firebase Functions 환경 변수 설정

firebase functions:config:set \
  sens.service_id="ncp:sms:kr:333502619582:choho-sens" \
  sens.access_key="RBqMJtykb8TINOSdaVCj" \
  sens.secret_key="JsXBJ0Cz3SiqP0K6FLK8i0eL9EDN5aXqwGdoSO92" \
  sens.from="01079320029"

# 설정 확인
firebase functions:config:get

# 배포
firebase deploy --only functions
