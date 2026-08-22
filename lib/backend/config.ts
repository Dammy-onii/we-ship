export const backendConfig = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '',
  supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '',
  easProjectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() ?? '',
};

export const isBackendConfigured = Boolean(
  backendConfig.supabaseUrl &&
    backendConfig.supabaseKey &&
    !backendConfig.supabaseUrl.includes('YOUR_PROJECT_REF') &&
    !backendConfig.supabaseKey.includes('REPLACE_ME'),
);

