// src/providers/FirebaseProvider.jsx
import { useEffect, useRef } from 'react';
import useFirebaseStore from '../stores/useFirebaseStore';

export const FirebaseProvider = ({ children }) => {
    const isInitializedRef = useRef(false);
    const unsubscribeRef = useRef(null);
    
    useEffect(() => {
        if (isInitializedRef.current) {
            return;
        }
        
        console.log('FirebaseProvider: Initializing Firebase listeners...');
        isInitializedRef.current = true;
        
        const unsubscribe = useFirebaseStore.getState().initialize();
        unsubscribeRef.current = unsubscribe;
        
        return () => {
            console.log('FirebaseProvider: Cleaning up Firebase listeners...');
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
            }
            isInitializedRef.current = false;
        };
    }, []);
    
    return children;
};

export default FirebaseProvider;