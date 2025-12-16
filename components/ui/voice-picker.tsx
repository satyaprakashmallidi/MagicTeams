'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Search, Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import type { VoiceResponse } from '@/lib/services/voice.service';

export interface VoicePickerProps {
    voices: VoiceResponse[];
    value?: string;
    onValueChange?: (value: string) => void;
    placeholder?: string;
    className?: string;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function VoicePicker({
    voices,
    value,
    onValueChange,
    placeholder = 'Select a voice...',
    className,
    open: controlledOpen,
    onOpenChange: setControlledOpen,
}: VoicePickerProps) {
    const [internalOpen, setInternalOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [playingVoiceId, setPlayingVoiceId] = React.useState<string | null>(null);
    const [audioElement, setAudioElement] = React.useState<HTMLAudioElement | null>(null);
    const triggerRef = React.useRef<HTMLButtonElement>(null);
    const [triggerWidth, setTriggerWidth] = React.useState(0);

    const open = controlledOpen ?? internalOpen;
    const setOpen = setControlledOpen ?? setInternalOpen;

    const selectedVoice = voices.find((voice) => voice.voiceId === value);

    // Measure trigger width when it opens
    React.useEffect(() => {
        if (open && triggerRef.current) {
            setTriggerWidth(triggerRef.current.offsetWidth);
        }
    }, [open]);

    // Clean up audio on unmount
    React.useEffect(() => {
        return () => {
            if (audioElement) {
                audioElement.pause();
                audioElement.src = '';
            }
        };
    }, [audioElement]);

    const handlePlayVoice = (voice: VoiceResponse, e: React.MouseEvent) => {
        e.stopPropagation();

        if (!voice.previewUrl) return;

        if (playingVoiceId === voice.voiceId) {
            audioElement?.pause();
            setPlayingVoiceId(null);
        } else {
            if (audioElement) {
                audioElement.pause();
            }
            const audio = new Audio(voice.previewUrl);
            audio.play();
            audio.onended = () => setPlayingVoiceId(null);
            setAudioElement(audio);
            setPlayingVoiceId(voice.voiceId);
        }
    };

    const filteredVoices = voices.filter((voice) =>
        voice.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    ref={triggerRef}
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-full justify-between h-12 text-base", className)}
                >
                    {selectedVoice ? selectedVoice.name : placeholder}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="p-0"
                align="start"
                style={{ width: triggerWidth > 0 ? `${triggerWidth}px` : 'auto' }}
            >
                <div className="flex flex-col">
                    <div className="p-3 border-b">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search voices..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 h-10"
                            />
                        </div>
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                        {filteredVoices.length === 0 ? (
                            <div className="py-6 text-center text-sm text-muted-foreground">
                                No voice found.
                            </div>
                        ) : (
                            <div className="p-1">
                                {filteredVoices.map((voice) => {
                                    const isPlaying = playingVoiceId === voice.voiceId;
                                    const isSelected = value === voice.voiceId;

                                    return (
                                        <button
                                            key={voice.voiceId}
                                            onClick={() => {
                                                onValueChange?.(voice.voiceId);
                                                setOpen(false);
                                            }}
                                            className="flex items-center justify-between gap-2 w-full px-3 py-3 rounded-md hover:bg-muted transition-colors text-left"
                                        >
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <Check
                                                    className={cn(
                                                        "h-4 w-4 flex-shrink-0",
                                                        isSelected ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                                <span className="flex-1 truncate">{voice.name}</span>
                                            </div>

                                            {voice.previewUrl && (
                                                <button
                                                    onClick={(e) => handlePlayVoice(voice, e)}
                                                    className="flex-shrink-0 w-8 h-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
                                                >
                                                    {isPlaying ? (
                                                        <Pause className="w-3 h-3" />
                                                    ) : (
                                                        <Play className="w-3 h-3 ml-0.5" />
                                                    )}
                                                </button>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
