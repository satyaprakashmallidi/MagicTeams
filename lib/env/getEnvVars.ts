import { z } from 'zod';

// Define the environment variables schema
const envSchema = z.object({
  // Supabase configuration
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),

  // Application configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  NEXT_PUBLIC_APP_URL: z.string().url(),

  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),

  ULTRAVOX_API_KEY: z.string().min(1),

  NEXT_PUBLIC_BACKEND_URL_WORKER: z.string().url(),

});

// Create a type from the schema
export type EnvVars = z.infer<typeof envSchema>;

// Function to validate and get environment variables
export function getEnvVars(): EnvVars {
  try {
    // Validate environment variables
    const env = envSchema.parse({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET,
      ULTRAVOX_API_KEY: process.env.NEXT_PUBLIC_ULTRAVOX_API_KEY,
      NEXT_PUBLIC_BACKEND_URL_WORKER:
        process.env.NEXT_PUBLIC_BACKEND_URL_WORKER,
    });

    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map((err) => err.path.join('.')).join(', ');
      throw new Error(
        `❌ Invalid environment variables: ${missingVars}\n${JSON.stringify(error.errors, null, 2)}`
      );
    }
    throw new Error('❌ Failed to validate environment variables');
  }
}

// Export a validated env object
export const env = getEnvVars();