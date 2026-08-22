import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  driveMediaSource,
  type AuthenticatedMediaSource,
  type DriveMediaTarget,
} from '@/lib/backend/media-source';
import { deleteDriveMedia } from '@/lib/backend/drive';
import { useBackendStatus } from '@/lib/store';
import { userFacingError } from '@/lib/user-facing-error';

export default function MediaScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const sync = useBackendStatus();
  const params = useLocalSearchParams<{
    target?: string;
    id?: string;
    type?: string;
    caption?: string;
    canDelete?: string;
  }>();
  const [deleting, setDeleting] = useState(false);
  const [loaded, setLoaded] = useState<{
    key: string;
    source?: AuthenticatedMediaSource;
    error?: string;
  }>({ key: '' });
  const target = params.target === 'memory' || params.target === 'goodie'
    ? params.target as DriveMediaTarget
    : undefined;
  const requestKey = `${target ?? 'invalid'}:${params.id ?? ''}`;
  const inputError = !target || !params.id ? 'This media link is incomplete.' : undefined;
  const source = loaded.key === requestKey ? loaded.source : undefined;
  const error = inputError ?? (loaded.key === requestKey ? loaded.error : undefined);

  const remove = async () => {
    if (!target || !params.id || deleting) return;
    setDeleting(true);
    try {
      await deleteDriveMedia(target, params.id);
      await sync.refresh();
      router.back();
    } catch (reason) {
      Alert.alert('Could not delete media', userFacingError(reason, 'Please try again.'));
      setDeleting(false);
    }
  };

  useEffect(() => {
    let active = true;
    if (!target || !params.id) return () => { active = false; };
    driveMediaSource(target, params.id)
      .then((next) => { if (active) setLoaded({ key: requestKey, source: next }); })
      .catch((reason) => {
        if (active) setLoaded({
          key: requestKey,
          error: userFacingError(reason, 'Could not open this original. Please try again.'),
        });
      });
    return () => { active = false; };
  }, [params.id, requestKey, target]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg, paddingBottom: insets.bottom }]}>
      <View style={[styles.stage, { backgroundColor: theme.bgDeep }]}>
        {source ? (
          params.type === 'video'
            ? <OriginalVideo source={source} />
            : <Image source={source} style={StyleSheet.absoluteFill} contentFit="contain" />
        ) : error ? (
          <View style={styles.message}>
            <Text variant="title">Original unavailable</Text>
            <Text variant="body" color="textSoft" style={styles.center}>{error}</Text>
          </View>
        ) : (
          <ActivityIndicator size="large" color={theme.primary} />
        )}
      </View>
      <View style={styles.copy}>
        {params.caption ? <Text variant="bodyStrong">{params.caption}</Text> : null}
        <Text variant="caption" color="textFaint">
          Streamed securely from the uploader’s Google Drive. The Google token stays on the server.
        </Text>
        {params.canDelete === '1' ? (
          <Button
            label={deleting ? 'Deleting…' : 'Delete from Weship and Drive'}
            variant="ghost"
            tone="partner"
            disabled={deleting}
            onPress={() => Alert.alert(
              'Delete this media?',
              'This removes the original from your Google Drive and the shared preview from Weship. This cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: remove },
              ],
            )}
          />
        ) : null}
      </View>
    </View>
  );
}

function OriginalVideo({ source }: { source: AuthenticatedMediaSource }) {
  const player = useVideoPlayer(source);
  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
      nativeControls
      fullscreenOptions={{ enable: true }}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  message: { alignItems: 'center', gap: Spacing.sm, padding: Spacing.xl },
  center: { textAlign: 'center' },
  copy: { gap: Spacing.xs, padding: Spacing.lg },
});
