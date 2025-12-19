import React from 'react';
import useStore from '../store.js';

const panelStyle = {
    position: 'fixed',
    bottom: '10px',
    right: '10px',
    width: '450px',
    maxHeight: '60vh',
    background: 'rgba(0, 0, 0, 0.85)',
    color: '#00ff00',
    border: '1px solid #333',
    borderRadius: '8px',
    padding: '20px',
    fontFamily: 'monospace',
    fontSize: '13px',
    overflowY: 'auto',
    zIndex: 9999,
    boxShadow: '0 0 20px rgba(0,0,0,0.5)'
};

function DebugPanel() {
    const { getDebugInfo, toggleDebug } = useStore();
    const debugInfo = getDebugInfo();

    return (
        <div style={panelStyle}>
            <button 
                onClick={toggleDebug}
                style={{ position: 'absolute', top: '10px', right: '10px', background: 'red', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '50%', width: '24px', height: '24px', lineHeight: '24px', textAlign: 'center', padding: 0 }}
            >
                X
            </button>
            <h4 style={{ margin: '0 0 15px 0', color: 'white', borderBottom: '1px solid #555', paddingBottom: '10px' }}>
                실시간 디버그 패널
            </h4>
            <pre style={{whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0}}>
                {JSON.stringify(debugInfo, null, 2)}
            </pre>
        </div>
    );
}

export default DebugPanel;