                              return opt.name;
                              return '';
                            })
                            .filter(Boolean)
                            .join(', ')}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="card-price">
                    <span className="price-label">총 금액</span>
                    <span className="price-value">
                      ₩{SafeDataProcessor.parseNumber(res.totalPrice).toLocaleString()}
                    </span>
                  </div>

                  {getRefundStatus(res)}
                  
                  {res.cancellationFee && res.cancellationFee > 0 && (
                    <div className="cancellation-fee-mobile">
                      취소수수료: ₩{SafeDataProcessor.parseNumber(res.cancellationFee).toLocaleString()}
                    </div>
                  )}
                </div>

                <div className="card-footer">
                  <div className="card-meta">
                    <span className="meta-label">예약일</span>
                    <span className="meta-value">{formatDate(res.createdAt)}</span>
                  </div>
                  <div className="card-actions">
                    {res.status === '입금대기' && (
                      <button 
                        onClick={(e) => handleStatusChange(e, res.id)}
                        className="btn-confirm"
                        disabled={isLoading}
                      >
                        확정
                      </button>
                    )}
                    {res.status !== '예약취소' && (
                      <button 
                        onClick={(e) => handleCancelClick(e, res)}
                        className="btn-cancel"
                        disabled={isLoading}
                      >
                        취소
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </ErrorBoundary>
          ))}
        </div>
      )}

      {/* 취소 모달 */}
      {cancelTarget && (
        <ErrorBoundary
          level="component"
          fallback={() => (
            <div className="modal-error">
              <p>취소 모달을 표시할 수 없습니다.</p>
              <button onClick={() => setCancelTarget(null)}>닫기</button>
            </div>
          )}
        >
          <CancelReservationModal
            reservation={cancelTarget}
            onConfirm={handleCancelConfirm}
            onClose={() => setCancelTarget(null)}
          />
        </ErrorBoundary>
      )}
    </div>
  );
};

// ============================================
// 4. 최상위 Error Boundary로 감싸기
// ============================================

const ReservationList: React.FC<any> = (props) => {
  return (
    <ErrorBoundary
      level="page"
      maxRetries={3}
      fallback={(error, errorInfo, retry) => (
        <div className="page-error-container">
          <h1>⚠️ 예약 목록을 불러올 수 없습니다</h1>
          <p>{error.message}</p>
          <div className="error-actions">
            <button onClick={retry} className="btn-primary">
              다시 시도
            </button>
            <button onClick={() => window.location.reload()} className="btn-secondary">
              페이지 새로고침
            </button>
          </div>
          <details className="error-details">
            <summary>기술적 세부사항</summary>
            <pre>{errorInfo.componentStack}</pre>
          </details>
        </div>
      )}
      onError={(error, errorInfo, errorId) => {
        // 에러 리포팅
        globalErrorHandler.handleError(
          ErrorFactory.create({
            code: 'RESERVATION_LIST_ERROR',
            message: error.message,
            category: ErrorCategory.SYSTEM,
            severity: ErrorSeverity.HIGH,
            originalError: error,
            context: {
              errorId,
              componentStack: errorInfo.componentStack
            }
          })
        );
      }}
      resetKeys={[props.reservations]}
      resetOnPropsChange={true}
    >
      <ReservationListCore {...props} />
    </ErrorBoundary>
  );
};

export default ReservationList;