'use client';

import { motion } from 'framer-motion';
import { Phone, PhoneOutgoing } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useOnboardingState } from '@/hooks/use-onboarding-state';
import { toast } from '@/hooks/use-toast';
import { startCall, startTwilioCall } from '@/lib/callFunctions';
import type { CallConfig, TwilioConfig } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function AssistantPage() {
    const { agentConfig } = useOnboardingState();
    const [isLoadingDemo, setIsLoadingDemo] = useState(false);
    const [isLoadingPhone, setIsLoadingPhone] = useState(false);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [callStatus, setCallStatus] = useState<string | undefined>();
    const [transcript, setTranscript] = useState<any[]>([]);

    const handleDemoCall = async () => {
        try {
            setIsLoadingDemo(true);

            const callConfig: CallConfig = {
                systemPrompt: agentConfig.personality || 'You are a helpful assistant.',
                voice: agentConfig.voice?.id || '',
                model: 'fixie-ai/ultravox',
                temperature: 5,
                botId: '', // Add your bot ID here
                firstSpeaker: 'FIRST_SPEAKER_USER',
            };

            const result = await startCall(
                callConfig,
                (status) => setCallStatus(status),
                (transcripts) => setTranscript(transcripts || []),
                false
            );

            if (result === 'success') {
                toast({
                    title: 'Demo call started!',
                });
            } else {
                toast({
                    title: 'Failed to start demo call',
                    variant: 'destructive',
                });
            }
        } catch (error) {
            console.error('Demo call error:', error);
            toast({
                title: 'Failed to start demo call',
                variant: 'destructive',
            });
        } finally {
            setIsLoadingDemo(false);
        }
    };

    const handlePhoneCall = async () => {
        if (!phoneNumber) {
            toast({
                title: 'Please enter a phone number',
                variant: 'destructive',
            });
            return;
        }

        try {
            setIsLoadingPhone(true);

            const callConfig: CallConfig = {
                systemPrompt: agentConfig.personality || 'You are a helpful assistant.',
                voice: agentConfig.voice?.id || '',
                model: 'fixie-ai/ultravox',
                temperature: 5,
                botId: '', // Add your bot ID here
            };

            const twilioConfig: TwilioConfig = {
                to_number: phoneNumber,
                from_number: '', // Add your Twilio number here
                account_sid: '',
                auth_token: '',
            };

            const result = await startTwilioCall(
                twilioConfig,
                callConfig,
                (status) => setCallStatus(status),
                (transcripts) => setTranscript(transcripts || []),
                false
            );

            if (result) {
                toast({
                    title: 'Phone call initiated!',
                });
            } else {
                toast({
                    title: 'Failed to start phone call',
                    variant: 'destructive',
                });
            }
        } catch (error) {
            console.error('Phone call error:', error);
            toast({
                title: 'Failed to start phone call',
                variant: 'destructive',
            });
        } finally {
            setIsLoadingPhone(false);
        }
    };

    return (
        <div className="min-h-screen p-6 bg-background">
            <div className="max-w-5xl mx-auto pt-20">
                {/* Header */}
                <motion.div
                    className="text-center mb-8"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    <h1 className="text-5xl md:text-6xl font-bold mb-4">
                        {agentConfig.name || 'Voice AI Agent'}
                    </h1>
                    <p className="text-xl text-muted-foreground">
                        Your agent is ready to use
                    </p>
                </motion.div>

                {/* Agent Info Card */}
                <motion.div
                    className="rounded-2xl p-8 bg-card border border-border mb-8"
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.6 }}
                >
                    <div className="grid md:grid-cols-2 gap-8">
                        {/* Left Column */}
                        <div className="space-y-6">
                            <div>
                                <div className="text-sm text-muted-foreground mb-2">Voice</div>
                                <div className="text-lg font-semibold">
                                    {agentConfig.voice?.name || 'Not selected'}
                                </div>
                                {agentConfig.voice && (
                                    <div className="text-sm text-muted-foreground">
                                        {agentConfig.voice.gender} • {agentConfig.voice.accent}
                                    </div>
                                )}
                            </div>

                            <div>
                                <div className="text-sm text-muted-foreground mb-2">Language</div>
                                <div className="text-lg font-semibold">
                                    {agentConfig.language || 'English'}
                                </div>
                            </div>

                            <div>
                                <div className="text-sm text-muted-foreground mb-2">Greeting</div>
                                <div className="text-sm text-muted-foreground italic">
                                    "{agentConfig.greeting || 'Hi! How can I help you today?'}"
                                </div>
                            </div>
                        </div>

                        {/* Right Column */}
                        <div className="space-y-6">
                            <div>
                                <div className="text-sm text-muted-foreground mb-2">Strategy</div>
                                <div className="text-lg font-semibold capitalize">
                                    {agentConfig.strategy?.replace('-', ' ') || 'Not set'}
                                </div>
                            </div>

                            <div>
                                <div className="text-sm text-muted-foreground mb-2">Template</div>
                                <div className="text-lg font-semibold">
                                    {agentConfig.template?.name || 'Custom'}
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Call Actions */}
                <motion.div
                    className="space-y-6"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                >
                    {/* Demo Call Section */}
                    <div className="rounded-2xl p-6 bg-card border border-border">
                        <h2 className="text-2xl font-semibold mb-4">Demo Call (Browser)</h2>
                        <p className="text-sm text-muted-foreground mb-6">
                            Start a test call directly in your browser to try out the agent
                        </p>
                        <Button
                            size="lg"
                            onClick={handleDemoCall}
                            disabled={isLoadingDemo || callStatus === 'idle'}
                            className="w-full md:w-auto"
                        >
                            <Phone className="w-5 h-5 mr-2" />
                            {isLoadingDemo ? 'Starting...' : 'Start Demo Call'}
                        </Button>
                        {callStatus && (
                            <div className="mt-4 text-sm">
                                <span className="text-muted-foreground">Status: </span>
                                <span className="font-medium">{callStatus}</span>
                            </div>
                        )}
                    </div>

                    {/* Phone Call Section */}
                    <div className="rounded-2xl p-6 bg-card border border-border">
                        <h2 className="text-2xl font-semibold mb-4">Phone Call</h2>
                        <p className="text-sm text-muted-foreground mb-6">
                            Call a phone number using your Twilio integration
                        </p>
                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="phone">Phone Number</Label>
                                <Input
                                    id="phone"
                                    type="tel"
                                    placeholder="+1234567890"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    className="mt-2"
                                />
                            </div>
                            <Button
                                size="lg"
                                onClick={handlePhoneCall}
                                disabled={isLoadingPhone || !phoneNumber}
                                className="w-full md:w-auto"
                            >
                                <PhoneOutgoing className="w-5 h-5 mr-2" />
                                {isLoadingPhone ? 'Calling...' : 'Start Phone Call'}
                            </Button>
                        </div>
                    </div>
                </motion.div>

                {/* Transcript */}
                {transcript.length > 0 && (
                    <motion.div
                        className="mt-8 rounded-2xl p-6 bg-card border border-border"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <h3 className="font-semibold mb-4">Live Transcript</h3>
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {transcript.map((msg, idx) => (
                                <div key={idx} className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                                        {msg.role === 'agent' ? 'AI' : 'You'}
                                    </div>
                                    <div className="flex-1 bg-muted/50 rounded-xl p-3 text-sm">
                                        {msg.text}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
