import { getModelSpecById } from '@/src/services/voiceAi/modelCatalog';
import { ParsedTransactionDraft } from '@/src/services/voiceAi/types';
import { VoiceAiOrchestrator } from '@/src/services/voiceAi/voiceAiOrchestrator';
import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import VoiceCaptureSheet from './VoiceCaptureSheet';
import VoiceReviewSheet from './VoiceReviewSheet';

interface VoiceTransactionFlowModalProps {
    visible: boolean;
    onClose: () => void;
    onTransactionSaved?: () => void;
    initialDraft?: ParsedTransactionDraft | null;
}

export default function VoiceTransactionFlowModal(props: VoiceTransactionFlowModalProps) {
    if (!props.visible) return null;
    return <VoiceTransactionFlowInner {...props} />;
}

function VoiceTransactionFlowInner({
    onClose,
    onTransactionSaved,
    initialDraft = null,
}: VoiceTransactionFlowModalProps) {
    const { accounts } = useSelector((state: any) => state.accounts);
    const { categories } = useSelector((state: any) => state.categories);
    const { settings } = useSelector((state: any) => state.voiceAi);

    const [stage, setStage] = useState<'capture' | 'refine' | 'review'>(() =>
        initialDraft ? 'refine' : 'capture'
    );
    const [draft, setDraft] = useState<ParsedTransactionDraft | null>(initialDraft);
    const [isParsing, setIsParsing] = useState(false);
    const [parseError, setParseError] = useState<string | null>(null);

    const spec = getModelSpecById(settings.activeModelId);
    const activeModelLabel =
        spec?.name ||
        settings.customModelName ||
        settings.activeModelPathOrTag ||
        'Local Model';

    const handleTranscriptSubmit = async (transcript: string) => {
        setIsParsing(true);
        setParseError(null);
        try {
            const parsed = await VoiceAiOrchestrator.parseTranscriptToDraft({
                transcript,
                accounts: accounts || [],
                categories: categories || [],
                settings,
                currentDraft: stage === 'refine' ? draft : null,
            });
            setDraft(parsed);
            setIsParsing(false);
            setStage('review');
        } catch (err: any) {
            setIsParsing(false);
            setParseError(err?.message || 'Failed to parse voice transaction locally.');
        }
    };

    const handleCloseCapture = () => {
        if (stage === 'refine' && draft) {
            setParseError(null);
            setStage('review');
            return;
        }
        onClose();
    };

    const handleSaved = () => {
        onClose();
        onTransactionSaved?.();
    };

    return (
        <>
            <VoiceCaptureSheet
                visible={stage === 'capture' || stage === 'refine'}
                mode={stage === 'refine' ? 'refine' : 'create'}
                locale={settings.speechLocale || 'en-IN'}
                activeModelLabel={activeModelLabel}
                isParsing={isParsing}
                parseError={parseError}
                onSubmitTranscript={handleTranscriptSubmit}
                onClose={handleCloseCapture}
            />

            <VoiceReviewSheet
                visible={stage === 'review'}
                draft={draft}
                onChangeDraft={setDraft}
                onRequestVoiceRefine={() => {
                    setParseError(null);
                    setStage('refine');
                }}
                onSaved={handleSaved}
                onClose={onClose}
            />
        </>
    );
}
