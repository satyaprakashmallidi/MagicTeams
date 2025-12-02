import { useLogs } from '@/store/use-logs';

export function useKnowledgeBaseLogger(component: string) {
  return {
    info: (message: string, data?: any) => {
      console.log(`ℹ️ [${component}]`, message, data || '');
    },
    warn: (message: string, data?: any) => {
      console.warn(`⚠️ [${component}]`, message, data || '');
    },
    error: (message: string, data?: any) => {
      console.error(`❌ [${component}]`, message, data || '');
    },
    debug: (message: string, data?: any) => {
      console.debug(`🔍 [${component}]`, message, data || '');
    },
  };
}
