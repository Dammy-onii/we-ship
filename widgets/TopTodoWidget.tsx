import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
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

export type TopTodoWidgetProps = {
  title: string;
  routine: string;
  empty: boolean;
};

function TopTodoWidgetView(props: TopTodoWidgetProps, environment: WidgetEnvironment) {
  'widget';
  // Was a private copy of the palette, and had been left behind on the old
  // grey accent while every other widget moved on. One source now.
  const { background, text, secondary, accent, compact } = widgetTheme(environment);

  return (
    <VStack
      alignment="leading"
      spacing={8}
      modifiers={[
        frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' }),
        padding({ all: compact ? 14 : 16 }),
        containerBackground(background, 'widget'),
        widgetURL('weship://todo'),
      ]}>
      <HStack spacing={6}>
        <Image systemName={props.empty ? 'checkmark.circle.fill' : 'circle'} size={17} color={accent} />
        <Text modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle(secondary)]}>
          WESHIP 2DO
        </Text>
        <Spacer />
      </HStack>
      <Spacer />
      <Text
        modifiers={[
          font({ size: compact ? 18 : 20, weight: 'semibold' }),
          foregroundStyle(text),
          lineLimit(compact ? 3 : 2),
        ]}>
        {props.title}
      </Text>
      <Text modifiers={[font({ size: 11, weight: 'medium' }), foregroundStyle(secondary)]}>
        {props.empty ? 'OPEN WESHIP' : props.routine.toUpperCase()}
      </Text>
    </VStack>
  );
}

export default createWidget<TopTodoWidgetProps>('TopTodoWidget', TopTodoWidgetView);

