import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { Gradients, Spacing } from '@/constants/theme';
import { ensureCachedMedia } from '@/lib/media-cache';
import type { Goodie } from '@/lib/types';

const ADVANCE_MS = 5200;
const MAX_SLIDES = 8;

/**
 * The Home hero backdrop: a slow slideshow of what has recently been shared.
 *
 * Photos and videos show their preview; notes render as type on a wash, so a
 * space with no imagery still feels alive rather than empty. Slides cross-fade
 * rather than slide, so the presence text layered above stays readable.
 */
export function HeroSlideshow({ goodies, height }: { goodies: Goodie[]; height: number }) {
  const slides = useMemo(
    () =>
      goodies
        .filter((g) => (g.kind === 'photo' || g.kind === 'video') && g.uri) 
        .concat(goodies.filter((g) => g.kind === 'note' && g.text))
        .slice(0, MAX_SLIDES),
    [goodies],
  );

  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % slides.length), ADVANCE_MS);
    return () => clearInterval(timer);
  }, [slides.length]);

  // Derive rather than correct in an effect: the set can shrink between renders.
  const safeIndex = slides.length ? index % slides.length : 0;
  const current = slides[safeIndex];

  return (
    <View style={[styles.root, { height }]}>
      {current ? (
        <Animated.View key={current.id} entering={FadeIn.duration(700)} exiting={FadeOut.duration(700)} style={StyleSheet.absoluteFill}>
          <Slide goodie={current} />
        </Animated.View>
      ) : (
        <LinearGradient colors={Gradients.dawn} style={StyleSheet.absoluteFill} />
      )}

      {slides.length > 1 ? (
        <View style={styles.dots}>
          {slides.map((slide, i) => (
            <View
              key={slide.id}
              style={[styles.dot, { opacity: i === safeIndex ? 0.95 : 0.35 }]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Slide({ goodie }: { goodie: Goodie }) {
  const isMedia = goodie.kind === 'photo' || goodie.kind === 'video';
  const [uri, setUri] = useState<string | undefined>(goodie.uri);

  useEffect(() => {
    let cancelled = false;
    if (!isMedia || !goodie.uri) return;
    ensureCachedMedia(goodie.id, goodie.kind, goodie.uri).then((next) => {
      if (!cancelled) setUri(next);
    });
    return () => {
      cancelled = true;
    };
  }, [goodie.id, goodie.kind, goodie.uri, isMedia]);

  if (isMedia && uri) {
    return <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={400} />;
  }

  return (
    <LinearGradient colors={Gradients.dawn} style={[StyleSheet.absoluteFill, styles.note]}>
      <Text variant="display" numberOfLines={4} style={{ opacity: 0.9 }}>
        {goodie.text ?? ''}
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  note: { justifyContent: 'center', paddingHorizontal: Spacing.xl },
  dots: {
    position: 'absolute',
    top: Spacing['3xl'],
    right: Spacing.lg,
    flexDirection: 'row',
    gap: 5,
  },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#FFFCF7' },
});
