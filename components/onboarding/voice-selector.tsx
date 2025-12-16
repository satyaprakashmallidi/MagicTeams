'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Volume2 } from 'lucide-react';
import { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { VoiceOption } from '@/types/onboarding';

interface VoiceSelectorProps {
    voices: VoiceOption[];
    selectedVoice: VoiceOption | null;
    onSelect: (voice: VoiceOption) => void;
}

export function VoiceSelector({ voices, selectedVoice, onSelect }: VoiceSelectorProps) {
    const [playingId, setPlayingId] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const handlePlayPause = (voice: VoiceOption, e: React.MouseEvent) => {
        e.stopPropagation();

        if (!voice.previewUrl) return;

        if (playingId === voice.id) {
            audioRef.current?.pause();
            setPlayingId(null);
        } else {
            if (audioRef.current) {
                audioRef.current.pause();
            }
            audioRef.current = new Audio(voice.previewUrl);
            audioRef.current.play();
            audioRef.current.onended = () => setPlayingId(null);
            setPlayingId(voice.id);
        }
    };

    return (
        <div className="space-y-3">
            <AnimatePresence mode="popLayout">
                {voices.map((voice, index) => {
                    const isSelected = selectedVoice?.id === voice.id;
                    const isPlaying = playingId === voice.id;

                    return (
                        <motion.div
                            key={voice.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ delay: index * 0.05, duration: 0.3 }}
                            className={cn(
                                'relative group cursor-pointer rounded-xl p-4 transition-all duration-300',
                                'bg-card/30 backdrop-blur-sm border border-border/40',
                                'hover:border-purple-500/50 hover:bg-card/50',
                                isSelected && 'border-purple-500 bg-purple-500/5 shadow-lg shadow-purple-500/20'
                            )}
                            onClick={() => onSelect(voice)}
                            whileHover={{ x: 4 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <div className="flex items-center gap-4">
                                {/* Voice Icon */}
                                <motion.div
                                    className={cn(
                                        'flex items-center justify-center w-12 h-12 rounded-lg transition-all duration-300',
                                        isSelected
                                            ? 'bg-gradient-to-br from-purple-500 to-blue-500 text-white shadow-lg shadow-purple-500/30'
                                            : 'bg-muted/50 text-muted-foreground group-hover:bg-muted'
                                    )}
                                    animate={isPlaying ? { scale: [1, 1.1, 1] } : {}}
                                    transition={{ duration: 0.6, repeat: isPlaying ? Infinity : 0 }}
                                >
                                    <Volume2 className="w-5 h-5" />
                                </motion.div>

                                {/* Voice Info */}
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-sm mb-0.5">{voice.name}</h4>
                                    <p className="text-xs text-muted-foreground">
                                        {voice.gender} • {voice.accent}
                                    </p>
                                </div>

                                {/* Play Button */}
                                {voice.previewUrl && (
                                    <motion.button
                                        className={cn(
                                            'flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300',
                                            isPlaying
                                                ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/40'
                                                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                                        )}
                                        onClick={(e) => handlePlayPause(voice, e)}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                    >
                                        {isPlaying ? (
                                            <Pause className="w-4 h-4" />
                                        ) : (
                                            <Play className="w-4 h-4 ml-0.5" />
                                        )}
                                    </motion.button>
                                )}

                                {/* Selection Indicator */}
                                {isSelected && (
                                    <motion.div
                                        className="absolute -right-1 -top-1 w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/40"
                                        initial={{ scale: 0, rotate: -180 }}
                                        animate={{ scale: 1, rotate: 0 }}
                                        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                                    >
                                        <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                                            <path
                                                d="M2 6L5 9L10 3"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        </svg>
                                    </motion.div>
                                )}
                            </div>

                            {/* Description */}
                            {voice.description && (
                                <motion.p
                                    className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border/40"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: isSelected ? 1 : 0, height: isSelected ? 'auto' : 0 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    {voice.description}
                                </motion.p>
                            )}
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
}
