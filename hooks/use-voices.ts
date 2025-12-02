import { useEffect, useRef } from 'react';
import { useVoiceStore } from '@/store/use-voice-store';
import { Voice } from '@/lib/types';
import { TwilioCredentials } from '@/types/twilio';

interface UseVoicesReturn {
  voices: Voice[];
  selectedVoice: Voice | null;
  isLoading: boolean;
  error: string | null;
  twilioInfo: TwilioCredentials[] | [];
  setSelectedVoice: (voice: Voice | null) => void;
}

export const useVoices = (): UseVoicesReturn => {
  const mounted = useRef(false);
  const { 
    voices, 
    selectedVoice,
    isLoading, 
    error,
    twilioInfo,
    fetchVoices,
    loadTwilioInfo,
    setSelectedVoice
  } = useVoiceStore();

  useEffect(() => {
    mounted.current = true;

    const initializeData = async () => {
      try {
        await Promise.all([
          loadTwilioInfo(),
          fetchVoices()
        ]);
      } catch (error) {
        console.error('Error initializing voice data:', error);
      }
    };

    initializeData();

    return () => {
      mounted.current = false;
    };
  }, [fetchVoices, loadTwilioInfo]);

  return {
    voices,
    selectedVoice,
    isLoading,
    error,
    twilioInfo,
    setSelectedVoice
  };
};
