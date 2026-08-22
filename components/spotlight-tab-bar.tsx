import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Rect, Stop } from 'react-native-svg';

import { Radius } from '@/constants/theme';
import { useIsDark } from '@/hooks/use-theme';

const BAR_HEIGHT = 68;
const BAR_MAX_WIDTH = 420;

export function SpotlightTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const isDark = useIsDark();
  const { width } = useWindowDimensions();
  const barWidth = Math.min(Math.max(width - 32, 240), BAR_MAX_WIDTH);
  const itemWidth = barWidth / state.routes.length;
  const position = useSharedValue(state.index);

  useEffect(() => {
    position.set(withSpring(state.index, { damping: 19, stiffness: 170, mass: 0.72 }));
  }, [position, state.index]);

  const spotlightStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: position.get() * itemWidth }],
  }));

  const colors = isDark
    ? {
        surface: 'rgba(24, 24, 25, 0.94)',
        border: 'rgba(255, 255, 255, 0.10)',
        active: '#F2EFE9',
        inactive: '#858382',
        beam: '#D8D4CD',
        cap: '#C8C2B9',
        shadow: '#000000',
      }
    : {
        surface: 'rgba(65, 65, 68, 0.90)',
        border: 'rgba(255, 255, 255, 0.20)',
        active: '#FBF8F2',
        inactive: '#B8B7B6',
        beam: '#F1EEE8',
        cap: '#D8D2C8',
        shadow: '#282828',
      };

  const content = (
    <>
      <Animated.View
        pointerEvents="none"
        style={[styles.spotlight, { width: itemWidth }, spotlightStyle]}>
        <Spotlight width={itemWidth} beam={colors.beam} cap={colors.cap} />
      </Animated.View>

      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const label =
          typeof options.tabBarAccessibilityLabel === 'string'
            ? options.tabBarAccessibilityLabel
            : typeof options.title === 'string'
              ? options.title
              : route.name;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!focused && !event.defaultPrevented) {
            Haptics.selectionAsync().catch(() => {});
            navigation.navigate(route.name, route.params);
          }
        };

        const onLongPress = () => {
          navigation.emit({ type: 'tabLongPress', target: route.key });
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={focused ? { selected: true } : {}}
            onLongPress={onLongPress}
            onPress={onPress}
            style={({ pressed }) => [
              styles.item,
              { width: itemWidth },
              pressed && styles.itemPressed,
            ]}>
            {options.tabBarIcon?.({
              focused,
              color: focused ? colors.active : colors.inactive,
              size: 25,
            })}
          </Pressable>
        );
      })}
    </>
  );

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.positioner,
        {
          bottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 16),
          width: barWidth,
        },
      ]}>
      <View
        style={[
          styles.shadow,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            shadowColor: colors.shadow,
          },
        ]}>
        {Platform.OS === 'ios' ? (
          <BlurView
            tint="dark"
            intensity={56}
            style={[styles.surface, { backgroundColor: colors.surface }]}>
            {content}
          </BlurView>
        ) : (
          <View style={[styles.surface, { backgroundColor: colors.surface }]}>{content}</View>
        )}
      </View>
    </View>
  );
}

function Spotlight({ width, beam, cap }: { width: number; beam: string; cap: string }) {
  const center = width / 2;
  const topHalf = Math.min(24, width * 0.2);
  const bottomHalf = Math.min(48, width * 0.42);

  return (
    <Svg width={width} height={BAR_HEIGHT}>
      <Defs>
        <SvgGradient id="spotlight" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={beam} stopOpacity={0.28} />
          <Stop offset="0.58" stopColor={beam} stopOpacity={0.11} />
          <Stop offset="1" stopColor={beam} stopOpacity={0} />
        </SvgGradient>
      </Defs>
      <Path
        d={`M ${center - topHalf} 0 L ${center + topHalf} 0 L ${center + bottomHalf} 62 L ${center - bottomHalf} 62 Z`}
        fill="url(#spotlight)"
      />
      <Rect x={center - 25} y={0} width={50} height={5} rx={2.5} fill={cap} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  positioner: {
    position: 'absolute',
    alignSelf: 'center',
    height: BAR_HEIGHT,
  },
  shadow: {
    height: BAR_HEIGHT,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  surface: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: Radius.card,
    overflow: 'hidden',
  },
  spotlight: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: BAR_HEIGHT,
  },
  item: {
    height: BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  itemPressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
});
