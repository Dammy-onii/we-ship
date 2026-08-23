import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { VoicePlayer } from '@/components/voice-player';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { driveMediaSource, type AuthenticatedMediaSource } from '@/lib/backend/media-source';
import { ensureCachedMedia } from '@/lib/media-cache';
import { cacheScopeFor } from '@/lib/spotlight-item';
import { relativeDay } from '@/lib/time';
import type { SpotlightItem } from '@/lib/spotlight-item';

const DISMISS_DISTANCE = 140;

type Props = {
  items: SpotlightItem[];
  startIndex: number;
  onClose: () => void;
};

/**
 * Full-screen gallery presented as a pop-out over the current screen.
 *
 * Deliberately a `Modal` rather than a route: opening media should not push a
 * page or lose the Spotlight scroll position, and dismissing is a swipe rather
 * than a back navigation.
 */
export function MediaViewer({ items, startIndex, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(startIndex);

  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  const dismiss = () => {
    onClose();
  };

  // Vertical drag dismisses; horizontal is left to the pager underneath.
  const swipeDown = Gesture.Pan()
    .activeOffsetY([-24, 24])
    .failOffsetX([-20, 20])
    .onUpdate((event) => {
      translateY.set(event.translationY);
      opacity.set(Math.max(0.25, 1 - Math.abs(event.translationY) / (height * 0.7)));
    })
    .onEnd((event) => {
      const shouldDismiss =
        Math.abs(event.translationY) > DISMISS_DISTANCE || Math.abs(event.velocityY) > 900;
      if (shouldDismiss) {
        translateY.set(withTiming(event.translationY > 0 ? height : -height, { duration: 180 }));
        opacity.set(withTiming(0, { duration: 160 }));
        runOnJS(dismiss)();
        return;
      }
      translateY.set(withSpring(0, { damping: 20, stiffness: 200 }));
      opacity.set(withSpring(1));
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.get() }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  useEffect(() => {
    // Jump to the tapped item once the pager has laid out.
    const id = setTimeout(() => scrollRef.current?.scrollTo({ x: startIndex * width, animated: false }), 0);
    return () => clearTimeout(id);
  }, [startIndex, width]);

  const current = items[index];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss} statusBarTranslucent>
      {/*
        A Modal renders in its own native view hierarchy, outside the app's
        root GestureHandlerRootView — so gestures inside it are dead unless the
        modal content provides its own root. This is why swipe-to-dismiss did
        nothing.
      */}
      <GestureHandlerRootView style={styles.sheet}>
      <Animated.View style={[styles.backdrop, backdropStyle]} />
      <GestureDetector gesture={swipeDown}>
        <Animated.View style={[styles.sheet, sheetStyle]}>
          <View style={[styles.topBar, { paddingTop: insets.top + Spacing.sm }]}>
            <Pressable onPress={dismiss} hitSlop={12} accessibilityLabel="Close" style={styles.close}>
              <Ionicons name="close" size={24} color="#FFFCF7" />
            </Pressable>
            <Text variant="captionStrong" onPhoto>
              {index + 1} / {items.length}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) =>
              setIndex(Math.round(event.nativeEvent.contentOffset.x / width))
            }>
            {items.map((item, i) => (
              <View key={item.id} style={{ width, height }}>
                {Math.abs(i - index) <= 1 ? <Slide item={item} active={i === index} /> : null}
              </View>
            ))}
          </ScrollView>

          {current ? (
            <View style={[styles.caption, { paddingBottom: insets.bottom + Spacing.lg }]}>
              <Byline item={current} />
            </View>
          ) : null}
        </Animated.View>
      </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

function Byline({ item }: { item: SpotlightItem }) {
  return (
    <View style={styles.byline}>
      <Avatar
        name={item.authorName}
        seed={item.authorPhotoSeed}
        uri={item.authorPhotoUri}
        ring={item.mine ? 'you' : 'them'}
        size={28}
      />
      <View style={{ flex: 1 }}>
        <Text variant="captionStrong" onPhoto>
          {item.mine ? 'You' : item.authorName}
        </Text>
        <Text variant="micro" onPhoto style={{ opacity: 0.75 }}>
          {relativeDay(item.createdAt.slice(0, 10)).toUpperCase()}
        </Text>
      </View>
    </View>
  );
}

function Slide({ item, active }: { item: SpotlightItem; active: boolean }) {
  const [localUri, setLocalUri] = useState<string | undefined>(item.uri);
  const [original, setOriginal] = useState<AuthenticatedMediaSource | null>(null);

  // Prefer an on-device copy so revisiting works offline and without re-fetching.
  useEffect(() => {
    let cancelled = false;
    if (!item.uri) return;
    const scope = cacheScopeFor(item);
    ensureCachedMedia(item.id, item.kind, item.uri, scope).then((uri) => {
      if (!cancelled) setLocalUri(uri);
    });
    return () => {
      cancelled = true;
    };
    // `item` is stable for a given id; the primitive deps are what actually change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, item.kind, item.uri, item.source]);

  // `item.uri` is only the small stored preview (JPEG ~0.62 quality, <=2MB), so
  // showing it full-screen looks visibly degraded. When the Drive original is
  // ready, upgrade to it — the preview stays visible underneath until it loads.
  useEffect(() => {
    let cancelled = false;
    // Only Goodies have a Drive original to upgrade to. Friend-board media is
    // stored whole in Supabase, so what is already on screen is the best copy.
    if (!active || item.source !== 'goodie' || !item.originalAvailable) return;
    if (item.kind !== 'photo' && item.kind !== 'video') return;
    driveMediaSource('goodie', item.id)
      .then((source) => {
        if (!cancelled) setOriginal(source);
      })
      .catch(() => {
        // Offline or not yet finalized — the preview remains a valid fallback.
      });
    return () => {
      cancelled = true;
    };
  }, [active, item.id, item.kind, item.originalAvailable, item.source]);

  if (item.kind === 'photo') {
    return (
      <Image
        source={original ? { uri: original.uri, headers: original.headers } : { uri: localUri }}
        placeholder={localUri ? { uri: localUri } : undefined}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        transition={180}
      />
    );
  }
  if (item.kind === 'video') return <VideoSlide uri={original?.uri ?? localUri} headers={original?.headers} active={active} />;
  if (item.kind === 'voice') return <VoiceSlide uri={localUri} seconds={item.durationSeconds} />;
  return <NoteSlide text={item.text} />;
}

function VideoSlide({
  uri,
  headers,
  active,
}: {
  uri?: string;
  headers?: Record<string, string>;
  active: boolean;
}) {
  const player = useVideoPlayer(uri ? { uri, headers } : null, (p) => {
    p.loop = true;
  });

  useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [active, player]);

  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls />;
}

function VoiceSlide({ uri, seconds }: { uri?: string; seconds?: number }) {
  return (
    <View style={[styles.centered, { paddingHorizontal: Spacing.xl }]}>
      <View style={styles.voicePanel}>
        <VoicePlayer uri={uri} seconds={seconds} tone="photo" />
      </View>
      <Text variant="captionStrong" onPhoto>
        Voice note
      </Text>
    </View>
  );
}

function NoteSlide({ text }: { text?: string }) {
  return (
    <View style={[styles.centered, { paddingHorizontal: Spacing.xl }]}>
      <Text variant="display" onPhoto center>
        {text ?? '—'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(12,12,11,0.96)' },
  sheet: { flex: 1 },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
  },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg },
  voicePanel: { alignSelf: 'stretch', maxWidth: 460, width: '100%' },
  caption: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    backgroundColor: 'rgba(12,12,11,0.55)',
  },
  byline: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
});
