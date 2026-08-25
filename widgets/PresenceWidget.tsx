import { HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  background,
  clipShape,
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
  /** Used when there is no pending 2do, so the lower card never becomes dead space. */
  questionProgress: string;
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
  const detailLabel = showTask ? 'NEXT 2DO' : 'DAILY QUESTION';
  const detail = showTask ? props.pendingTask : props.questionProgress;
  const metaLabel = props.localTime ? 'THEIR TIME' : 'LATEST BETWEEN YOU';

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
      spacing={8}
      modifiers={[
        frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'leading' }),
        padding({ all: 12 }),
        containerBackground(theme.background, 'widget'),
        widgetURL('weship://'),
      ]}>
      <HStack spacing={9}>
        <Text
          modifiers={[
            frame({ width: 38, height: 38 }),
            background(theme.moodFill),
            clipShape('circle'),
            font({ size: 20 }),
          ]}>
          {props.moodEmoji}
        </Text>
        <VStack alignment="leading" spacing={0}>
          <Text
            modifiers={[
              font({ size: theme.compact ? 16 : 18, weight: 'bold' }),
              foregroundStyle(theme.text),
              lineLimit(1),
            ]}>
            {props.name}
          </Text>
          <Text modifiers={[font({ size: 8, weight: 'bold' }), foregroundStyle(theme.accent)]}>
            RIGHT NOW
          </Text>
        </VStack>
        <Spacer />
        {props.streak > 0 ? (
          <Text
            modifiers={[
              padding({ horizontal: 8, vertical: 5 }),
              background(theme.accent),
              clipShape('capsule'),
              font({ size: 11, weight: 'bold' }),
              foregroundStyle(theme.onPhoto),
            ]}>
            {`🔥 ${props.streak}`}
          </Text>
        ) : null}
      </HStack>
      <Text
        modifiers={[
          frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'leading' }),
          padding({ horizontal: 10, vertical: 8 }),
          background(theme.surface),
          clipShape('roundedRectangle', 14),
          font({ size: 14, weight: 'medium' }),
          foregroundStyle(theme.text),
          lineLimit(2),
        ]}>
        {line}
      </Text>
      <HStack spacing={12}>
        <InfoBlock label={metaLabel} value={meta} theme={theme} />
        <InfoBlock label={detailLabel} value={detail} theme={theme} />
      </HStack>
    </VStack>
  );
}

function InfoBlock({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof widgetTheme>;
}) {
  'widget';
  return (
    <VStack alignment="leading" spacing={1} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
      <Text modifiers={[font({ size: 8, weight: 'bold' }), foregroundStyle(theme.secondary), lineLimit(1)]}>
        {label}
      </Text>
      <Text modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle(theme.text), lineLimit(1)]}>
        {value}
      </Text>
    </VStack>
  );
}

export default createWidget<PresenceWidgetProps>('PresenceWidget', PresenceView);
