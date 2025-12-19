// src/components/LoginScreen.jsx - 비밀번호만 입력 버전

import React, { useState, useRef, useEffect } from 'react';
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from '../config/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';

// 환경변수에서 관리자 이메일 가져오기
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;

// 테마 설정
const theme = {
    colors: {
        primary: '#2d5016',
        secondary: '#558b2f',
        danger: '#dc3545',
        warning: '#ffc107',
        success: '#28a745',
        info: '#17a2b8',
    },
    shadow: '0 4px 12px rgba(0,0,0,0.08)',
    borderRadius: '12px',
};

const styles = {
    input: {
        width: '100%',
        padding: '14px 16px',
        border: '2px solid #e0e0e0',
        borderRadius: '8px',
        fontSize: '18px',
        boxSizing: 'border-box',
        transition: 'border-color 0.2s ease',
        outline: 'none',
        textAlign: 'center',
        letterSpacing: '2px',
    },
    inputFocus: {
        borderColor: theme.colors.primary,
    },
    button: {
        padding: '14px 20px',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: '600',
        fontSize: '16px',
        transition: 'all 0.2s ease',
    },
    label: {
        display: 'block',
        marginBottom: '8px',
        fontSize: '14px',
        fontWeight: '500',
        color: '#333',
        textAlign: 'center',
    }
};

// 에러 메시지 매핑
const getErrorMessage = (errorCode) => {
    switch (errorCode) {
        case 'auth/invalid-email':
            return '시스템 오류가 발생했습니다.';
        case 'auth/user-disabled':
            return '비활성화된 계정입니다. 관리자에게 문의하세요.';
        case 'auth/user-not-found':
            return '등록되지 않은 계정입니다.';
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
            return '비밀번호가 올바르지 않습니다.';
        case 'auth/too-many-requests':
            return '너무 많은 시도가 있었습니다. 잠시 후 다시 시도해주세요.';
        case 'auth/network-request-failed':
            return '네트워크 연결을 확인해주세요.';
        case 'LOCATION_BLOCKED':
            return '해당 지역에서는 접속이 차단되었습니다.';
        case 'IP_BLOCKED':
            return '접속이 차단되었습니다. 관리자에게 문의하세요.';
        case 'TOO_MANY_ATTEMPTS':
            return '너무 많은 로그인 시도로 인해 차단되었습니다.';
        case 'CONFIG_ERROR':
            return '시스템 설정 오류입니다. 관리자에게 문의하세요.';
        default:
            return '로그인 중 오류가 발생했습니다. 다시 시도해주세요.';
    }
};

// 클라이언트 IP 가져오기
async function getClientIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (error) {
        console.error('Failed to get IP:', error);
        return null;
    }
}

function LoginScreen() {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [focusedInput, setFocusedInput] = useState(null);
    const [remainingAttempts, setRemainingAttempts] = useState(null);
    const [isIPBlocked, setIsIPBlocked] = useState(false);

    const passwordRef = useRef(null);
    const functions = getFunctions();

    // 컴포넌트 마운트 시 IP 차단 체크 및 설정 확인
    useEffect(() => {
        if (!ADMIN_EMAIL) {
            setError('시스템 설정 오류입니다. 관리자에게 문의하세요.');
            console.error('VITE_ADMIN_EMAIL 환경변수가 설정되지 않았습니다.');
        } else {
            checkIPBlock();
        }
        passwordRef.current?.focus();
    }, []);

    // IP 차단 체크
    const checkIPBlock = async () => {
        try {
            const clientIP = await getClientIP();
            if (!clientIP) return;

            const checkIP = httpsCallable(functions, 'checkIPBlock');
            const result = await checkIP({ ip: clientIP });

            if (result.data?.code === 'LOCATION_BLOCKED' || result.data?.code === 'IP_BLOCKED') {
                setIsIPBlocked(true);
                setError(getErrorMessage(result.data.code));
            }
        } catch (error) {
            console.error('IP check failed:', error);
        }
    };

    const validateForm = () => {
        if (!ADMIN_EMAIL) {
            setError('시스템 설정 오류입니다.');
            return false;
        }

        if (!password) {
            setError('비밀번호를 입력해주세요.');
            passwordRef.current?.focus();
            return false;
        }

        if (password.length < 6) {
            setError('비밀번호는 6자 이상이어야 합니다.');
            passwordRef.current?.focus();
            return false;
        }

        return true;
    };

    const handleLogin = async (e) => {
        e.preventDefault();

        // IP 차단된 경우 로그인 시도 불가
        if (isIPBlocked) {
            setError('접속이 차단되었습니다.');
            return;
        }

        // 로딩 중 중복 제출 방지
        if (loading) return;

        // 에러 초기화
        setError('');
        setRemainingAttempts(null);

        // 폼 검증
        if (!validateForm()) return;

        setLoading(true);

        try {
            const clientIP = await getClientIP();

            // 로그인 시도 (환경변수의 이메일 사용)
            await signInWithEmailAndPassword(auth, ADMIN_EMAIL, password);

            // 성공 시 로그인 추적
            if (clientIP) {
                const trackLogin = httpsCallable(functions, 'trackLoginAttempt');
                await trackLogin({
                    email: ADMIN_EMAIL,
                    success: true,
                    ip: clientIP
                });
            }

            // 성공 시 Dashboard로 자동 이동 (App.jsx에서 처리)
        } catch (error) {
            console.error('Login error:', error);

            // 실패 시 로그인 추적
            try {
                const clientIP = await getClientIP();
                if (clientIP) {
                    const trackLogin = httpsCallable(functions, 'trackLoginAttempt');
                    const result = await trackLogin({
                        email: ADMIN_EMAIL,
                        success: false,
                        ip: clientIP
                    });

                    if (result.data?.remainingAttempts !== undefined) {
                        setRemainingAttempts(result.data.remainingAttempts);
                    }

                    if (result.data?.code === 'TOO_MANY_ATTEMPTS') {
                        setIsIPBlocked(true);
                        setError(getErrorMessage('TOO_MANY_ATTEMPTS'));
                        return;
                    }
                }
            } catch (trackError) {
                console.error('Failed to track login attempt:', trackError);
            }

            setError(getErrorMessage(error.code));
            passwordRef.current?.focus();
        } finally {
            setLoading(false);
        }
    };

    const inputStyle = () => ({
        ...styles.input,
        ...(focusedInput === 'password' ? styles.inputFocus : {}),
        ...(error && { borderColor: theme.colors.danger }),
    });

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.secondary} 100%)`,
            padding: '20px',
        }}>
            <div style={{
                background: 'white',
                padding: '40px',
                borderRadius: theme.borderRadius,
                boxShadow: theme.shadow,
                width: '100%',
                maxWidth: '360px',
            }}>
                <h1 style={{
                    color: theme.colors.primary,
                    marginBottom: '8px',
                    fontWeight: 700,
                    fontSize: '28px',
                    textAlign: 'center',
                }}>
                    초호 펜션
                </h1>
                <p style={{
                    color: '#666',
                    marginBottom: '32px',
                    textAlign: 'center',
                    fontSize: '14px',
                }}>
                    관리자 로그인
                </p>

                {isIPBlocked ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '40px 20px',
                    }}>
                        <div style={{
                            fontSize: '48px',
                            marginBottom: '20px',
                        }}>
                            🚫
                        </div>
                        <h2 style={{
                            color: theme.colors.danger,
                            marginBottom: '16px',
                            fontSize: '20px',
                        }}>
                            접속이 차단되었습니다
                        </h2>
                        <p style={{
                            color: '#666',
                            fontSize: '14px',
                            lineHeight: '1.6',
                        }}>
                            {error || '관리자에게 문의하세요.'}
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleLogin} noValidate>
                        <div style={{ marginBottom: '24px' }}>
                            <label htmlFor="password" style={styles.label}>
                                비밀번호
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    ref={passwordRef}
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    onFocus={() => setFocusedInput('password')}
                                    onBlur={() => setFocusedInput(null)}
                                    placeholder="••••••••"
                                    required
                                    aria-label="비밀번호"
                                    aria-invalid={!!error}
                                    aria-describedby={error ? "error-message" : undefined}
                                    disabled={loading || !ADMIN_EMAIL}
                                    style={inputStyle()}
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: 'absolute',
                                        right: '12px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        padding: '4px',
                                        color: '#666',
                                        fontSize: '14px',
                                    }}
                                    aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 표시"}
                                >
                                    {showPassword ? '숨기기' : '표시'}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div
                                id="error-message"
                                role="alert"
                                style={{
                                    color: theme.colors.danger,
                                    marginBottom: '20px',
                                    fontSize: '14px',
                                    textAlign: 'center',
                                    padding: '10px',
                                    background: '#fee',
                                    borderRadius: '6px',
                                }}
                            >
                                {error}
                                {remainingAttempts !== null && remainingAttempts > 0 && (
                                    <div style={{ marginTop: '4px', fontSize: '12px' }}>
                                        남은 시도 횟수: {remainingAttempts}회
                                    </div>
                                )}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || !ADMIN_EMAIL}
                            style={{
                                ...styles.button,
                                width: '100%',
                                backgroundColor: (loading || !ADMIN_EMAIL) ? '#ccc' : theme.colors.success,
                                opacity: (loading || !ADMIN_EMAIL) ? 0.7 : 1,
                                cursor: (loading || !ADMIN_EMAIL) ? 'not-allowed' : 'pointer',
                            }}
                            aria-busy={loading}
                        >
                            {loading ? (
                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span
                                        style={{
                                            display: 'inline-block',
                                            width: '14px',
                                            height: '14px',
                                            border: '2px solid #fff',
                                            borderTopColor: 'transparent',
                                            borderRadius: '50%',
                                            animation: 'spin 0.8s linear infinite',
                                            marginRight: '8px',
                                        }}
                                    />
                                    로그인 중...
                                </span>
                            ) : '로그인'}
                        </button>
                    </form>
                )}

                <div style={{
                    marginTop: '24px',
                    paddingTop: '24px',
                    borderTop: '1px solid #e0e0e0',
                    textAlign: 'center',
                    fontSize: '12px',
                    color: '#999',
                }}>
                    <p>문제가 있으신가요?</p>
                    <p>관리자에게 문의하세요.</p>
                </div>
            </div>

            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}

export default LoginScreen;
