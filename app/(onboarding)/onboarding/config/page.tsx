'use client';

import { motion } from 'framer-motion';
import { Globe } from 'lucide-react';
import { useState, useEffect } from 'react';
import { ProgressIndicator } from '@/components/onboarding/progress-indicator';
import { useRouter } from 'next/navigation';
import { useOnboardingState } from '@/hooks/use-onboarding-state';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { agentService } from '@/lib/services/agent.service';
import { voiceService, type VoiceResponse } from '@/lib/services/voice.service';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { VoicePicker } from '@/components/ui/voice-picker';
import { useBots } from '@/hooks/use-bots';
import type { Bot } from '@/types/database';

export default function ConfigPage() {
    const router = useRouter();
    const { strategy, template, currentStep, updateAgentConfig } = useOnboardingState();
    const { addBot } = useBots();

    const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
    const [agentName, setAgentName] = useState(template?.name || 'My Voice Agent');
    const [personality, setPersonality] = useState(template?.prompt || '');
    const [language, setLanguage] = useState('English');
    const [greeting, setGreeting] = useState(template?.defaultGreeting || '');
    const [isCreating, setIsCreating] = useState(false);
    const [voices, setVoices] = useState<VoiceResponse[]>([]);
    const [isLoadingVoices, setIsLoadingVoices] = useState(true);

    // Fetch voices from backend on mount
    useEffect(() => {
        const fetchVoices = async () => {
            try {
                setIsLoadingVoices(true);
                const voicesData = await voiceService.getVoices();
                setVoices(voicesData);
            } catch (error) {
                console.error('Failed to fetch voices:', error);
                toast({
                    title: 'Failed to load voices',
                    variant: 'destructive',
                });
                setVoices([]);
            } finally {
                setIsLoadingVoices(false);
            }
        };

        fetchVoices();
    }, []);

    if (!template) {
        router.push('/onboarding/template');
        return null;
    }

    const handleContinue = async () => {
        if (!selectedVoiceId) {
            toast({
                title: 'Please select a voice',
                variant: 'destructive',
            });
            return;
        }

        try {
            setIsCreating(true);

            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError) throw userError;
            if (!user) throw new Error('User not authenticated');

            const agentResponse = await agentService.createAgent({
                user_id: user.id,
                name: agentName,
                voice_id: selectedVoiceId,
                system_prompt: personality || 'You are a helpful AI assistant.',
                model: 'ultravox-v0.7',
                temperature: 7,
                first_speaker: 'FIRST_SPEAKER_AGENT',
                selected_tools: ['hangUp'],
            });

            console.log('=== AGENT CREATION DEBUG ===');
            console.log('Full Response:', agentResponse);
            console.log('Data object:', agentResponse.data);
            console.log('ID from response.data.id:', agentResponse.data.id);
            console.log('===========================');

            const selectedVoice = voices.find(v => v.voiceId === selectedVoiceId);

            // Create bot object for the store - API wraps data in .data field
            const newBot: Bot = {
                id: agentResponse.data.id,
                name: agentName,
                phone_number: '',
                voice: selectedVoiceId,
                system_prompt: personality || 'You are a helpful AI assistant.',
                user_id: user.id,
                created_at: new Date().toISOString(),
                is_deleted: false,
                temperature: 7,
                model: 'ultravox-v0.7',
                first_speaker: 'FIRST_SPEAKER_AGENT',
                selected_tools: ['hangUp'],
                is_agent: true,
                ultravox_agent_id: agentResponse.data.ultravox_agent_id,
                is_enabled: true,
            };

            // Add to bot store (this will auto-select it via selectedBotId)
            await addBot(newBot);

            updateAgentConfig({
                name: agentName,
                voice: selectedVoice ? {
                    id: selectedVoice.voiceId,
                    name: selectedVoice.name,
                    gender: 'neutral' as const,
                    accent: '',
                    previewUrl: selectedVoice.previewUrl,
                    description: '',
                } : undefined,
                personality,
                language,
                greeting,
                strategy,
                template,
                botId: agentResponse.data.id,
                ultravoxAgentId: agentResponse.data.ultravox_agent_id,
            });

            toast({
                title: 'Agent created successfully!',
            });

            // Mark onboarding as completed
            localStorage.setItem('onboarding_completed', 'true');

            // Redirect to dashboard with botId query parameter
            router.push(`/dashboard/aiassistant?botId=${agentResponse.data.id}`);
        } catch (error: any) {
            console.error('Failed to create agent:', error);
            toast({
                title: 'Failed to create agent',
                description: error.message || 'Something went wrong',
                variant: 'destructive',
            });
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <>
            <ProgressIndicator currentStep={currentStep} />

            <div className="min-h-screen p-6 pt-32 pb-20 bg-background">
                <div className="max-w-4xl mx-auto w-full">
                    {/* Header */}
                    <motion.div
                        className="text-center mb-12"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <h1 className="text-4xl md:text-5xl font-bold mb-4">
                            Configure Your Agent
                        </h1>
                        <p className="text-lg text-muted-foreground">
                            Customize the voice, personality, and behavior
                        </p>
                    </motion.div>

                    {/* Form */}
                    <div className="space-y-8">
                        {/* Agent Name */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="space-y-2"
                        >
                            <Label htmlFor="agent-name" className="text-base font-semibold">
                                Agent Name
                            </Label>
                            <Input
                                id="agent-name"
                                value={agentName}
                                onChange={(e) => setAgentName(e.target.value)}
                                placeholder="My Voice Agent"
                                className="h-12 text-base"
                            />
                        </motion.div>

                        {/* Voice Selection */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="space-y-3"
                        >
                            <Label className="text-base font-semibold">Select Voice</Label>

                            {isLoadingVoices ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    Loading voices...
                                </div>
                            ) : (
                                <VoicePicker
                                    voices={voices}
                                    value={selectedVoiceId}
                                    onValueChange={setSelectedVoiceId}
                                    placeholder="Choose your voice..."
                                />
                            )}
                        </motion.div>

                        {/* Language */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="space-y-2"
                        >
                            <Label htmlFor="language" className="text-base font-semibold flex items-center gap-2">
                                <Globe className="w-4 h-4" />
                                Language
                            </Label>
                            <Input
                                id="language"
                                value={language}
                                onChange={(e) => setLanguage(e.target.value)}
                                placeholder="English"
                                className="h-12 text-base"
                            />
                        </motion.div>

                        {/* Greeting */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="space-y-2"
                        >
                            <Label htmlFor="greeting" className="text-base font-semibold">
                                Welcome Greeting (Optional)
                            </Label>
                            <Textarea
                                id="greeting"
                                value={greeting}
                                onChange={(e) => setGreeting(e.target.value)}
                                placeholder="Hi! How can I help you today?"
                                rows={3}
                                className="text-base resize-none"
                            />
                        </motion.div>

                        {/* Personality */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className="space-y-2"
                        >
                            <Label htmlFor="personality" className="text-base font-semibold">
                                Agent Goal & Personality
                            </Label>
                            <Textarea
                                id="personality"
                                value={personality}
                                onChange={(e) => setPersonality(e.target.value)}
                                placeholder="Describe what your agent should do and how it should behave..."
                                rows={5}
                                className="text-base resize-none"
                            />
                        </motion.div>
                    </div>

                    {/* Continue Button */}
                    <motion.div
                        className="flex justify-center mt-12"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                    >
                        <button
                            onClick={handleContinue}
                            disabled={!selectedVoiceId || isCreating || isLoadingVoices}
                            className="group relative inline-flex items-center justify-center px-12 py-4 text-lg font-medium rounded-full overflow-hidden border-2 border-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
                        >
                            <div className="absolute inset-0 bg-foreground -translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-out" />
                            <span className="relative z-10 text-foreground group-hover:text-background transition-colors duration-300">
                                {isCreating ? 'Creating Agent...' : 'Create Agent'}
                            </span>
                        </button>
                    </motion.div>
                </div>
            </div>
        </>
    );
}
