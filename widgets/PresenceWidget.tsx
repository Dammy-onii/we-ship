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
  lastExchange: string;
  pendingTask: string;
  /** Carried here after the standalone streak widget was retired. */
  streak: number;
};

/**
 * Their mood, and one useful line beneath it.
 *
 * Long distance gets their clock, which is the thing you genuinely cannot see
 * for yourself. Sharing a timezone, that line would just be your own time
 * echoed back, so it becomes the last thing you sent each other — and, where
 * there is room, the next unfinished shared 2do.
 */
function PresenceView(props: PresenceWidgetProps, environment: WidgetEnvironment) {
  'widget';
  const theme = widgetTheme(environment);
  const line = props.statusText || props.mood;
  // Falls back through: their clock → last exchange → when they were last around.
  const meta = props.localTime || props.lastExchange || props.lastSeen;
  // The task needs a line of its own, which the small family does not have.
  const showTask = Boolean(props.pendingTask) && !theme.compact;

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
      <HStack spacing={6}>
        <Text
          modifiers={[
            font({ size: theme.compact ? 17 : 20, weight: 'bold' }),
            foregroundStyle(theme.text),
            lineLimit(1),
          ]}>
          {props.name}
        </Text>
        <Spacer />
        {props.streak > 0 ? (
          <Text
            modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle(theme.secondary)]}>
            {`🔥 ${props.streak}`}
          </Text>
        ) : null}
      </HStack>
      <HStack spacing={5}>
        <Text modifiers={[font({ size: 14 })]}>{props.moodEmoji}</Text>
        <Text
          modifiers={[font({ size: 14 }), foregroundStyle(theme.text), lineLimit(2)]}>
          {line}
        </Text>
        <Spacer />
      </HStack>
      <Spacer />
      {showTask ? (
        <HStack spacing={5}>
          <Text modifiers={[font({ size: 11 }), foregroundStyle(theme.secondary)]}>○</Text>
          <Text
            modifiers={[font({ size: 12 }), foregroundStyle(theme.text), lineLimit(1)]}>
            {props.pendingTask}
          </Text>
          <Spacer />
        </HStack>
      ) : null}
      <Text modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle(theme.secondary)]}>
        {meta.toUpperCase()}
      </Text>
    </VStack>
  );
}

export default createWidget<PresenceWidgetProps>('PresenceWidget', PresenceView);
