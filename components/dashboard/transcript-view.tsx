'use client';

import { useEffect, useRef } from 'react';
import { Transcript  } from "ultravox-client"

interface TranscriptViewProps {
  botId?: string;
  initialTranscripts?: Transcript[] | null
}

export function TranscriptView({ botId ,  initialTranscripts }: TranscriptViewProps) {

  const transcriptContainerRef = useRef<HTMLDivElement>(null);

  if (!botId) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        Select a bot to view transcripts
      </div>
    );
  }

  useEffect(() => {
    if (transcriptContainerRef.current) {
      transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
    }
  }, [initialTranscripts]);

  return (
    <div className="flex-1 flex flex-col">

      <div className="mb-5 relative">
        <div className='h-[300px] p-2.5 overflow-y-auto' ref={transcriptContainerRef}>

        {initialTranscripts && initialTranscripts.map((transcript, index) => (
          <div key={index}>
            <p><span className="text-gray-600">{transcript.speaker === 'agent' ? "Agent" : "User"}</span></p>
            <p className="mb-4"><span>{transcript.text}</span></p>
          </div>
        ))}
          </div>

      </div>
    </div>
  );
}