import { HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  padding,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import { widgetTheme } from './shared';

export type PresenceWidgetProps = {
  name: string;
  mood: string;
  moodEmoji: string;
  statusText: string;
  /** Empty when you share a timezone — their clock would just be yours. */
  localTime: string;
  lastSeen: string;
};

function PresenceView(props: PresenceWidgetProps, environment: WidgetEnvironment) {
  'widget';
  const theme = widgetTheme(environment);
  const line = props.statusText || props.mood;
  const meta = props.localTime || props.lastSeen;

  // Lock-screen families are tiny and monochrome — one line only.
  if (theme.lockScreen) {
    return (
      <Text modifiers={[font({ size: 13, weight: 'semibold' }), lineLimit(1)]}>
        {`${props.moodEmoji} ${props.name} · ${meta}`}
      </Text>
    );
  }

  return (
    <VStack
      alignment="leading"
      spacing={6}
      modifiers={[
        frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'leading' }),
        padding({ all: 14 }),
        containerBackground(theme.background, 'widget'),
        widgetURL('weship://'),
      ]}>
      <Text
        modifiers={[
          font({ size: theme.compact ? 17 : 20, weight: 'bold' }),
          foregroundStyle(theme.text),
          lineLimit(1),
        ]}>
        {props.name}
      </Text>
      <HStack spacing={5}>
        <Text modifiers={[font({ size: 14 })]}>{props.moodEmoji}</Text>
        <Text
          modifiers={[font({ size: 14 }), foregroundStyle(theme.text), lineLimit(2)]}>
          {line}
        </Text>
        <Spacer />
      </HStack>
      <Spacer />
      <Text modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle(theme.secondary)]}>
        {meta.toUpperCase()}
      </Text>
    </VStack>
  );
}

export default createWidget<PresenceWidgetProps>('PresenceWidget', PresenceView);
