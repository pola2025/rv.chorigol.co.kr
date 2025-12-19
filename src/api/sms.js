// src/api/sms.js

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// SMS 발송
export const sendSMS = async (reservationData, type = 'confirmation') => {
  try {
    const response = await fetch(`${API_URL}/api/sms/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reservation: reservationData,
        type: type
      })
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('SMS 발송 실패:', error);
    throw error;
  }
};

// SMS 재발송
export const resendSMS = async (reservationId, type) => {
  try {
    const response = await fetch(`${API_URL}/api/sms/resend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reservationId,
        type
      })
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('SMS 재발송 실패:', error);
    throw error;
  }
};
