'use client';

import { createContext, useContext, useState, useRef, ReactNode, ComponentPropsWithoutRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
interface SpeechInputData {
    partialTranscript: string;
    committedTranscripts: string[];
    transcript: string;
}

interface SpeechInputContextType {
    isConnected: boolean;
    isConnecting: boolean;
    transcript: string;
    partialTranscript: string;
    committedTranscripts: string[];
    error: string | null;
    start: () => Promise<void>;
    stop: () => void;
    cancel: () => void;
}

const SpeechInputContext = createContext<SpeechInputContextType | undefined>(undefined);

export function useSpeechInput() {
    const context = useContext(SpeechInputContext);
    if (!context) {
        throw new Error('useSpeechInput must be used within SpeechInput');
    }
    return context;
}

// Main SpeechInput Component
interface SpeechInputProps {
    children: ReactNode;
    getToken?: () => Promise<string>;
    onChange?: (data: SpeechInputData) => void;
    onStart?: (data: SpeechInputData) => void;
    onStop?: (data: SpeechInputData) => void;
    onCancel?: (data: SpeechInputData) => void;
    onError?: (error: Error | Event) => void;
    className?: string;
}

export function SpeechInput({
    children,
    getToken,
    onChange,
    onStart,
    onStop,
    onCancel,
    onError,
    className,
}: SpeechInputProps) {
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [partialTranscript, setPartialTranscript] = useState('');
    const [committedTranscripts, setCommittedTranscripts] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const recognitionRef = useRef<any>(null);

    const transcript = [...committedTranscripts, partialTranscript].filter(Boolean).join(' ');

    const getData = (): SpeechInputData => ({
        partialTranscript,
        committedTranscripts,
        transcript,
    });

    const start = async () => {
        try {
            setIsConnecting(true);
            setError(null);

            const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;

            if (!SpeechRecognition) {
                throw new Error('Speech recognition not supported in this browser');
            }

            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            recognition.onstart = () => {
                setIsConnecting(false);
                setIsConnected(true);
                onStart?.(getData());
            };

            recognition.onresult = (event: any) => {
                const results = Array.from(event.results);
                const partial = results
                    .slice(-1)[0]
                    ?.[0]?.transcript || '';

                setPartialTranscript(partial);
                onChange?.(getData());
            };

            recognition.onerror = (event: any) => {
                console.error('Speech recognition error:', event.error);
                setError(event.error);
                setIsConnected(false);
                setIsConnecting(false);
                onError?.(event);
            };

            recognition.onend = () => {
                if (isConnected) {
                    // Commit the partial transcript
                    if (partialTranscript) {
                        setCommittedTranscripts(prev => [...prev, partialTranscript]);
                        setPartialTranscript('');
                    }
                }
                setIsConnected(false);
                setIsConnecting(false);
                onStop?.(getData());
            };

            recognitionRef.current = recognition;
            recognition.start();
        } catch (err) {
            setIsConnecting(false);
            setError(err instanceof Error ? err.message : 'Unknown error');
            onError?.(err as Error);
        }
    };

    const stop = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        setIsConnected(false);
        setIsConnecting(false);
    };

    const cancel = () => {
        stop();
        setPartialTranscript('');
        setCommittedTranscripts([]);
        setError(null);
        onCancel?.(getData());
    };

    const value: SpeechInputContextType = {
        isConnected,
        isConnecting,
        transcript,
        partialTranscript,
        committedTranscripts,
        error,
        start,
        stop,
        cancel,
    };

    return (
        <SpeechInputContext.Provider value={value}>
            <div className={cn('flex items-center gap-2', className)}>
                {children}
            </div>
        </SpeechInputContext.Provider>
    );
}

// SpeechInputRecordButton
interface SpeechInputRecordButtonProps extends ComponentPropsWithoutRef<'button'> { }

export function SpeechInputRecordButton({ className, ...props }: SpeechInputRecordButtonProps) {
    const { isConnected, isConnecting, start, stop } = useSpeechInput();

    const handleClick = async () => {
        if (isConnected) {
            stop();
        } else {
            await start();
        }
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={isConnecting}
            className={cn(
                'relative p-2 rounded-full transition-all duration-200',
                'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary',
                isConnected
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-muted hover:bg-muted/80 text-foreground',
                isConnecting && 'opacity-50 cursor-not-allowed',
                className
            )}
            {...props}
        >
            {isConnecting ? (
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                    <Mic className="w-4 h-4" />
                </motion.div>
            ) : isConnected ? (
                <MicOff className="w-4 h-4" />
            ) : (
                <Mic className="w-4 h-4" />
            )}
        </button>
    );
}

// SpeechInputPreview
interface SpeechInputPreviewProps extends ComponentPropsWithoutRef<'div'> {
    placeholder?: string;
}

export function SpeechInputPreview({
    placeholder = 'Listening...',
    className,
    ...props
}: SpeechInputPreviewProps) {
    const { transcript, isConnected } = useSpeechInput();

    return (
        <AnimatePresence>
            {isConnected && (
                <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 'auto', opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                        'flex items-center px-3 py-1.5 rounded-lg bg-muted/50 text-sm overflow-hidden whitespace-nowrap',
                        className
                    )}
                    {...props}
                >
                    <span className="text-muted-foreground">
                        {transcript || placeholder}
                    </span>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

// SpeechInputCancelButton
interface SpeechInputCancelButtonProps extends ComponentPropsWithoutRef<'button'> { }

export function SpeechInputCancelButton({ className, ...props }: SpeechInputCancelButtonProps) {
    const { isConnected, cancel } = useSpeechInput();

    if (!isConnected) return null;

    return (
        <button
            type="button"
            onClick={cancel}
            className={cn(
                'p-1.5 rounded-full hover:bg-muted transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary',
                className
            )}
            {...props}
        >
            <X className="w-4 h-4" />
        </button>
    );
}
