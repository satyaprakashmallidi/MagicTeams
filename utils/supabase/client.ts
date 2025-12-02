import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = 'https://usjdmsieclzehogkqlag.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzamRtc2llY2x6ZWhvZ2txbGFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzMxMTIxOTQsImV4cCI6MjA0ODY4ODE5NH0.xZ8JFUjQ0hSprKpZLLPbe3gneRlCx5tTN_ed_5QZai0';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzamRtc2llY2x6ZWhvZ2txbGFnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzExMjE5NCwiZXhwIjoyMDQ4Njg4MTk0fQ.zMcR9bMMw4zOdV1hvwtIdCfdyNM9rmOatN2zeKgenUw';


export function createClient() {
  return createBrowserClient(
    supabaseUrl,
    supabaseAnonKey
  )
}