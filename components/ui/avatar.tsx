import { StyleSheet, View } from 'react-native';

import { Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Photo } from './photo';
import { Text } from './text';

type Props = {
  name: string;
  size?: number;
  /** Presence ring — 'you' (graphite) or 'them' (warm clay). */
  ring?: 'you' | 'them' | 'none';
  /** Stable seed for a portrait; falls back to the initial. */
  seed?: string;
  uri?: string;
  wash?: number;
};

/** Circular portrait with an optional presence ring. */
export function Avatar({ name, size = 44, ring = 'none', seed, uri, wash = 0 }: Props) {
  const theme = useTheme();
  const ringColor = ring === 'you' ? theme.primary : ring === 'them' ? theme.partner : 'transparent';
  const pad = ring === 'none' ? 0 : 2.5;
  const initial = name?.trim()?.[0]?.toUpperCase() ?? '·';

  return (
    <View
      style={[
        styles.ring,
        {
          width: size + pad * 4,
          height: size + pad * 4,
          borderRadius: (size + pad * 4) / 2,
          borderColor: ringColor,
          borderWidth: ring === 'none' ? 0 : 1.75,
          backgroundColor: theme.surface,
        },
      ]}>
      {seed || uri ? (
        <Photo
          uri={uri}
          seed={seed}
          width={size * 2}
          height={size * 2}
          wash={wash}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      ) : (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: ring === 'them' ? theme.partnerSoft : theme.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text
            style={{
              ...Typography.title,
              fontSize: size * 0.4,
              lineHeight: size * 0.5,
              color: ring === 'them' ? theme.partner : theme.primaryDeep,
            }}>
            {initial}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { alignItems: 'center', justifyContent: 'center' },
});
