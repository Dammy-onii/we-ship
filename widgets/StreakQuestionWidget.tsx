import { Spacer, Text, VStack } from '@expo/ui/swift-ui';
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

export type StreakWidgetProps = {
  count: number;
  questionText: string;
  youAnswered: boolean;
  partnerAnswered: boolean;
};

function StreakView(props: StreakWidgetProps, environment: WidgetEnvironment) {
  'widget';
  const theme = widgetTheme(environment);
  const status = props.youAnswered
    ? props.partnerAnswered
      ? 'BOTH ANSWERED'
      : 'WAITING ON THEM'
    : 'YOUR TURN';

  if (theme.lockScreen) {
    return (
      <Text modifiers={[font({ size: 13, weight: 'semibold' }), lineLimit(1)]}>
        {`🔥 ${props.count} · ${status}`}
      </Text>
    );
  }

  return (
    <VStack
      alignment="leading"
      spacing={7}
      modifiers={[
        frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' }),
        padding({ all: 14 }),
        containerBackground(theme.background, 'widget'),
        widgetURL('weship://play/question'),
      ]}>
      <Text modifiers={[font({ size: 15, weight: 'bold' }), foregroundStyle(theme.text)]}>
        {`${props.count} day streak`}
      </Text>
      <Text
        modifiers={[
          font({ size: theme.compact ? 13 : 15 }),
          foregroundStyle(theme.text),
          lineLimit(theme.compact ? 3 : 4),
        ]}>
        {props.questionText}
      </Text>
      <Spacer />
      <Text modifiers={[font({ size: 10, weight: 'bold' }), foregroundStyle(theme.secondary)]}>
        {status}
      </Text>
    </VStack>
  );
}

export default createWidget<StreakWidgetProps>('StreakQuestionWidget', StreakView);
