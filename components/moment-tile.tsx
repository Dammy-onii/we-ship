import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Photo } from '@/components/ui/photo';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import type { Moment } from '@/lib/types';

type Props = {
  moment: Moment;
  index: number;
  width: number;
  height?: number;
  /** Shows the caption over a scrim — used for larger tiles. */
  showCaption?: boolean;
  onPress?: () => void;
};

export function MomentTile({ moment, index, width, height, showCaption, onPress }: Props) {
  const h = height ?? width;
  const tile = (
    <Photo
      uri={moment.uri || undefined}
      seed={moment.seed}
      width={width * 2}
      height={h * 2}
      wash={index}
      scrim={showCaption}
      style={{ width, height: h, borderRadius: Radius.tile }}>
      {showCaption && moment.caption ? (
        <View style={styles.caption}>
          <Text variant="captionStrong" onPhoto numberOfLines={1}>
            {moment.caption}
          </Text>
        </View>
      ) : null}
      {moment.type === 'video' && (
        <View style={styles.play}>
          <Ionicons name="play" size={12} color="#FFFCF7" />
        </View>
      )}
    </Photo>
  );
  if (!onPress) return tile;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${moment.type}${moment.caption ? `: ${moment.caption}` : ''}`}>
      {tile}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  caption: { position: 'absolute', left: Spacing.md, right: Spacing.md, bottom: Spacing.md },
  play: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(20,28,22,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
