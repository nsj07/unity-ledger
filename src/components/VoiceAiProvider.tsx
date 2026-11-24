import React, { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { useDispatch } from 'react-redux';
import { VoiceAiOrchestrator } from '../services/voiceAi/voiceAiOrchestrator';

export default function VoiceAiProvider({ children }: { children: React.ReactNode }) {
    const dispatch = useDispatch();

    useEffect(() => {
        VoiceAiOrchestrator.initialize(dispatch as any);
    }, [dispatch]);

    useEffect(() => {
        if (Platform.OS === 'web') return;
        const sub = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'background') {
                VoiceAiOrchestrator.unloadMemory().catch(() => {});
            }
        });
        return () => sub.remove();
    }, []);

    return <>{children}</>;
}
