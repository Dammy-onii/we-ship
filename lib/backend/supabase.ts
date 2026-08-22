import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import type * as SecureStoreModule from 'expo-secure-store';

import { backendConfig, isBackendConfigured } from './config';
import { loadNativeModule } from '../native-modules';

let secureStoreModule: typeof SecureStoreModule | null = null;

function secureStore() {
  if (!secureStoreModule) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    secureStoreModule = loadNativeModule<typeof SecureStoreModule>(() => require('expo-secure-store'));
  }
  if (!secureStoreModule) throw new Error('Secure session storage is unavailable in this build.');
  return secureStoreModule;
}

/**
 * Native Supabase tokens belong in Keychain/Keystore, not AsyncStorage.
 * `getItem` performs a one-time migration from the previous plaintext store.
 */
const nativeSessionStorage = {
  async getItem(key: string) {
    const existing = await secureStore().getItemAsync(key);
    if (existing !== null) return existing;
    const legacy = await AsyncStorage.getItem(key);
    if (legacy !== null) {
      await secureStore().setItemAsync(key, legacy);
      await AsyncStorage.removeItem(key);
    }
    return legacy;
  },
  async setItem(key: string, value: string) {
    await secureStore().setItemAsync(key, value);
    await AsyncStorage.removeItem(key);
  },
  async removeItem(key: string) {
    await Promise.all([secureStore().deleteItemAsync(key), AsyncStorage.removeItem(key)]);
  },
};

export const supabase = isBackendConfigured
  ? createClient(backendConfig.supabaseUrl, backendConfig.supabaseKey, {
      auth: {
        ...(Platform.OS === 'web' ? {} : { storage: nativeSessionStorage }),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
      },
    })
  : null;

if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Copy .env.example to .env.local and add the project values.');
  }
  return supabase;
}
