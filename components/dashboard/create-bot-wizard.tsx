"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, FileText, ArrowLeft, Loader2, Check } from "lucide-react";
import { DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { LEAD_GEN_STRATEGIES, TEMPLATES } from "@/lib/onboarding-data";
import { agentService } from "@/lib/services/agent.service";
import { useBots } from "@/hooks/use-bots";
import { supabase } from "@/lib/supabase";
import { logBotOperation } from "@/lib/utils/api-logger";
import { cn } from "@/lib/utils";
import type { LeadGenStrategy, Template } from "@/types/onboarding";

type Step = "strategy" | "template" | "prompt" | "creating";
type PromptMode = "ai-generate" | "paste-text" | null;

interface CreateBotWizardProps {
    onClose: () => void;
}

export function CreateBotWizard({ onClose }: CreateBotWizardProps) {
    const [step, setStep] = useState<Step>("strategy");
    const [strategy, setStrategy] = useState<LeadGenStrategy | null>(null);
    const [template, setTemplate] = useState<Template | null>(null);
    const [promptMode, setPromptMode] = useState<PromptMode>(null);
    const [promptInput, setPromptInput] = useState("");
    const [botName, setBotName] = useState("");
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    const { toast } = useToast();
    const { addBot } = useBots();

    const handleStrategySelect = (id: LeadGenStrategy) => {
        setStrategy(id);
        setStep("template");
    };

    const handleTemplateSelect = (selectedTemplate: Template) => {
        setTemplate(selectedTemplate);
        setBotName(selectedTemplate.name);
        setStep("prompt");
        // Reset prompt state when template changes
        setPromptMode(null);
        setPromptInput("");
    };

    const handlePromptModeSelect = (mode: PromptMode) => {
        setPromptMode(mode);
        if (mode === "paste-text" && template?.prompt) {
            setPromptInput(template.prompt);
        }
    };

    const enhancePrompt = async () => {
        if (!promptInput.trim()) return;

        setIsEnhancing(true);
        try {
            const { enhancePromptWithAI } = await import("@/app/actions/enhance-prompt");
            const result = await enhancePromptWithAI(
                promptInput,
                template?.name || "AI Agent",
                strategy || "general business"
            );

            if (result.success && result.enhancedPrompt) {
                setPromptInput(result.enhancedPrompt);
                toast({
                    title: "Prompt Enhanced",
                    description: "Your prompt has been optimized by AI.",
                });
            } else {
                throw new Error(result.error || "Failed to enhance prompt");
            }
        } catch (error) {
            console.error("Error enhancing prompt:", error);
            toast({
                title: "Enhancement failed",
                description: "Failed to enhance the prompt. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsEnhancing(false);
        }
    };

    const handleCreate = async () => {
        if (!promptInput.trim()) {
            toast({
                title: "Prompt required",
                description: "Please enter a system prompt for your agent.",
                variant: "destructive",
            });
            return;
        }

        setIsCreating(true);
        setStep("creating");

        try {
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError) throw userError;
            if (!user) throw new Error("User not authenticated");

            const agentResponse = await agentService.createAgent({
                user_id: user.id,
                name: botName || template?.name || "New Agent",
                voice_id: "lily", // Default voice
                system_prompt: promptInput,
                model: "ultravox-v0.7",
                temperature: 7,
                first_speaker: "FIRST_SPEAKER_AGENT",
                selected_tools: ["hangUp"],
            });

            logBotOperation("CREATE_SUCCESS", {
                bot_id: agentResponse.id,
                ultravox_agent_id: agentResponse.ultravox_agent_id,
            });

            addBot(agentResponse as any);

            toast({
                title: "Success",
                description: "Bot created successfully",
            });

            onClose();
        } catch (error: any) {
            console.error("Error creating bot:", error);
            logBotOperation("CREATE_ERROR", { error: error.message });

            toast({
                title: "Error",
                description: error.message || "Failed to create bot",
                variant: "destructive",
            });
            setIsCreating(false);
            setStep("prompt"); // Go back to prompt step on error
        }
    };

    const renderStrategyStep = () => (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto p-1">
                {LEAD_GEN_STRATEGIES.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => handleStrategySelect(item.id)}
                        className={cn(
                            "flex flex-col items-start p-4 rounded-xl border-2 text-left transition-all hover:border-primary/50 hover:bg-muted/50",
                            strategy === item.id ? "border-primary bg-primary/5" : "border-border"
                        )}
                    >
                        <span className="text-2xl mb-2">{item.icon}</span>
                        <span className="font-semibold text-sm">{item.name}</span>
                        <span className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</span>
                    </button>
                ))}
            </div>
        </div>
    );

    const renderTemplateStep = () => {
        const templates = strategy ? TEMPLATES[strategy] : [];
        return (
            <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 max-h-[60vh] overflow-y-auto p-1">
                    {templates.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => handleTemplateSelect(item)}
                            className="flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all hover:border-primary/50 hover:bg-muted/50 border-border"
                        >
                            <span className="text-2xl bg-muted p-2 rounded-lg">{item.icon}</span>
                            <div>
                                <h3 className="font-semibold">{item.name}</h3>
                                <p className="text-sm text-muted-foreground">{item.description}</p>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    const renderPromptStep = () => (
        <div className="space-y-6">
            {!promptMode ? (
                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={() => handlePromptModeSelect("ai-generate")}
                        className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-border hover:border-primary/50 hover:bg-muted/50 transition-all gap-3 text-center"
                    >
                        <div className="p-3 rounded-full bg-primary/10 text-primary">
                            <Sparkles className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-semibold">Generate with AI</h3>
                            <p className="text-xs text-muted-foreground mt-1">Describe what you want and we'll write the prompt</p>
                        </div>
                    </button>
                    <button
                        onClick={() => handlePromptModeSelect("paste-text")}
                        className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-border hover:border-primary/50 hover:bg-muted/50 transition-all gap-3 text-center"
                    >
                        <div className="p-3 rounded-full bg-muted text-foreground">
                            <FileText className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-semibold">Use Template / Manual</h3>
                            <p className="text-xs text-muted-foreground mt-1">Start with the template prompt or write your own</p>
                        </div>
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="grid gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="bot-name">Bot Name</Label>
                            <Input
                                id="bot-name"
                                value={botName}
                                onChange={(e) => setBotName(e.target.value)}
                                placeholder="Name your bot"
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <Label className="text-base font-semibold">
                                {promptMode === "ai-generate" ? "Describe your agent" : "System Prompt"}
                            </Label>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setPromptMode(null)}
                                className="h-8 text-xs"
                            >
                                Change Mode
                            </Button>
                        </div>
                    </div>

                    <Textarea
                        value={promptInput}
                        onChange={(e) => setPromptInput(e.target.value)}
                        placeholder={
                            promptMode === "ai-generate"
                                ? "e.g., I want a friendly real estate agent who helps people schedule viewings..."
                                : "Enter your system prompt here..."
                        }
                        className="min-h-[200px] resize-none text-base"
                    />

                    <div className="flex justify-end gap-2 pt-4">
                        {promptMode === "ai-generate" && (
                            <Button
                                onClick={enhancePrompt}
                                disabled={!promptInput.trim() || isEnhancing}
                                variant="secondary"
                            >
                                {isEnhancing ? (
                                    <>
                                        <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                                        Enhancing...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4 mr-2" />
                                        Generate Prompt
                                    </>
                                )}
                            </Button>
                        )}
                        <Button onClick={handleCreate} disabled={!promptInput.trim() || isCreating}>
                            {isCreating ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                "Create Bot"
                            )}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );

    const renderCreatingStep = () => (
        <div className="flex flex-col items-center justify-center py-12 space-y-6">
            <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-muted border-t-primary animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-primary animate-pulse" />
                </div>
            </div>
            <div className="text-center space-y-2">
                <h3 className="text-xl font-semibold">Creating your agent...</h3>
                <p className="text-muted-foreground">Setting up voice, tools, and personality.</p>
            </div>
        </div>
    );

    const getStepTitle = () => {
        switch (step) {
            case "strategy": return "Select Industry";
            case "template": return "Choose Template";
            case "prompt": return "Configure Prompt";
            case "creating": return "Finalizing";
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto p-6">
            <DialogHeader className="mb-6">
                <div className="flex items-center gap-2">
                    {step !== "strategy" && step !== "creating" && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 -ml-2"
                            onClick={() => {
                                if (step === "template") setStep("strategy");
                                if (step === "prompt") setStep("template");
                            }}
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                    )}
                    <div>
                        <DialogTitle className="text-xl">{getStepTitle()}</DialogTitle>
                        <DialogDescription>
                            Step {step === "strategy" ? 1 : step === "template" ? 2 : step === "prompt" ? 3 : 4} of 4
                        </DialogDescription>
                    </div>
                </div>
            </DialogHeader>

            <div className="min-h-[400px]">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={step}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                    >
                        {step === "strategy" && renderStrategyStep()}
                        {step === "template" && renderTemplateStep()}
                        {step === "prompt" && renderPromptStep()}
                        {step === "creating" && renderCreatingStep()}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}
