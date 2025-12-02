"use client"

import { useEffect, useState, useRef } from "react"
import { Transcript } from "ultravox-client"
import {
  BarVisualizer,
  type AgentState,
} from "@/components/ui/bar-visualizer"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface VoiceBarProps {
  agentStatus?: string
  transcripts?: Transcript[] | null
  className?: string
}

export function VoiceBar({ agentStatus, transcripts, className }: VoiceBarProps) {
  const [visualState, setVisualState] = useState<AgentState>("listening")
  const [currentSpeaker, setCurrentSpeaker] = useState<"user" | "agent" | null>(null)
  const lastTranscriptRef = useRef<Transcript | null>(null)
  const thinkingTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Map Ultravox status to AgentState
  useEffect(() => {
    if (!agentStatus) return

    // Handle connection states
    if (agentStatus === "disconnected" || agentStatus === "disconnecting") {
      setVisualState("listening")
      setCurrentSpeaker(null)
      return
    }

    if (agentStatus === "connecting") {
      setVisualState("connecting")
      setCurrentSpeaker(null)
      return
    }

    if (agentStatus === "idle") {
      setVisualState("initializing")
      setCurrentSpeaker(null)
      return
    }
  }, [agentStatus])

  // Detect speaker from transcripts and update visual state
  useEffect(() => {
    if (!transcripts || transcripts.length === 0) {
      return
    }

    // Get the most recent transcript
    const latestTranscript = transcripts[transcripts.length - 1]

    // Check if this is a new transcript
    if (lastTranscriptRef.current?.text === latestTranscript.text &&
        lastTranscriptRef.current?.speaker === latestTranscript.speaker) {
      return
    }

    lastTranscriptRef.current = latestTranscript

    // Determine who's speaking
    const speaker = latestTranscript.speaker?.toLowerCase() || ""

    // Clear any pending thinking timer
    if (thinkingTimerRef.current) {
      clearTimeout(thinkingTimerRef.current)
      thinkingTimerRef.current = null
    }

    if (speaker === "user") {
      setCurrentSpeaker("user")
      // When user is speaking, AI is listening
      setVisualState("listening")

      // When user finishes speaking, show thinking state briefly
      if (latestTranscript.final) {
        thinkingTimerRef.current = setTimeout(() => {
          setVisualState("thinking")
          setCurrentSpeaker(null)
        }, 300)
      }
    } else if (speaker === "agent") {
      setCurrentSpeaker("agent")
      // When agent has any transcript (interim or final), it's actively speaking
      setVisualState("speaking")
    }

    // Auto-reset to listening after agent finishes speaking
    if (latestTranscript.isFinal && speaker === "agent") {
      const timer = setTimeout(() => {
        setVisualState("listening")
        setCurrentSpeaker(null)
      }, 800)
      return () => clearTimeout(timer)
    }

    // Cleanup thinking timer
    return () => {
      if (thinkingTimerRef.current) {
        clearTimeout(thinkingTimerRef.current)
      }
    }
  }, [transcripts])

  // Determine speaker label
  const getSpeakerLabel = () => {
    if (!currentSpeaker) return "Ready to assist"
    if (currentSpeaker === "user") return "Listening to you..."
    if (visualState === "thinking") return "AI thinking..."
    if (visualState === "speaking") return "AI speaking..."
    return "Ready to assist"
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Voice Visualizer</span>
          <span className="text-sm font-normal text-muted-foreground">
            {getSpeakerLabel()}
          </span>
        </CardTitle>
        <CardDescription>
          Real-time audio visualization during your conversation
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-4">
          {/* User Speaking - Show dual visualization */}
          {currentSpeaker === "user" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>You're Speaking</span>
                <span className="flex items-center gap-1">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  Recording
                </span>
              </div>
              {/* User input bars - more active */}
              <BarVisualizer
                state="speaking"
                demo={true}
                barCount={20}
                minHeight={20}
                maxHeight={85}
                className="h-24 max-w-full bg-green-500/5 rounded-lg"
              />

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>AI Listening</span>
                <span className="flex items-center gap-1">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                  </span>
                  Processing
                </span>
              </div>
              {/* AI listening visualization */}
              <BarVisualizer
                state="listening"
                demo={true}
                barCount={20}
                minHeight={8}
                maxHeight={40}
                className="h-20 max-w-full bg-blue-500/5 rounded-lg"
              />
            </div>
          )}

          {/* AI Speaking/Thinking - Show agent response */}
          {currentSpeaker === "agent" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>AI Response</span>
                <span className="flex items-center gap-1">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                  </span>
                  Speaking
                </span>
              </div>
              <BarVisualizer
                state={visualState}
                demo={true}
                barCount={20}
                minHeight={20}
                maxHeight={90}
                className="h-32 max-w-full bg-purple-500/5 rounded-lg"
              />
            </div>
          )}

          {/* Default state - Idle/Ready */}
          {!currentSpeaker && (
            <div className="space-y-2">
              <div className="text-xs text-center text-muted-foreground">
                {visualState === "thinking" ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
                    </span>
                    Processing your message...
                  </span>
                ) : visualState === "connecting" ? (
                  "Establishing connection..."
                ) : visualState === "initializing" ? (
                  "Setting up session..."
                ) : (
                  "Ready - Start speaking"
                )}
              </div>
              <BarVisualizer
                state={visualState}
                demo={agentStatus !== "disconnected" && visualState !== "listening"}
                barCount={20}
                minHeight={15}
                maxHeight={70}
                className="h-32 max-w-full rounded-lg"
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
