import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

// Default key from clore-store-portal (public anon key - safe to have as default)
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFra29mdXhmdWx1ZWt2YXlwd3F3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUyNTA3NTIsImV4cCI6MjA2MDgyNjc1Mn0.qocKPOEo6V_S-klVF2BfMk_bmMOeUxRQvqjJLIbEpG0';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qkkofuxfuluekvaypwqw.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

interface AuthResult {
  success: boolean;
  token?: string;
  error?: string;
}

/**
 * Authenticates with Supabase using email and password
 * Returns JWT token for use in GraphQL queries
 */
export async function authenticateWithSupabase(
  email: string,
  password: string
): Promise<AuthResult> {
  try {
    logger.info(`🔐 Authenticating with Supabase: ${email}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      logger.error(`❌ Supabase authentication failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }

    if (!data.session?.access_token) {
      logger.error('❌ No access token received from Supabase');
      return {
        success: false,
        error: 'No access token received',
      };
    }

    logger.success('✅ Supabase authentication successful');
    logger.debug(`Token: ${data.session.access_token.substring(0, 50)}...`);

    return {
      success: true,
      token: data.session.access_token,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`❌ Supabase auth error: ${message}`);
    return {
      success: false,
      error: message,
    };
  }
}
