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

export type TopTodoWidgetProps = {
  title: string;
  routine: string;
  empty: boolean;
};

function TopTodoWidgetView(props: TopTodoWidgetProps, environment: WidgetEnvironment) {
  'widget';
  const dark = environment.colorScheme === 'dark';
  const background = dark ? '#1C1C1C' : '#F3F1EC';
  const text = dark ? '#F2F0EB' : '#252321';
  const secondary = dark ? '#AAA7A2' : '#706C67';
  const accent = dark ? '#CBC6BE' : '#5F5B57';
  const compact = environment.widgetFamily === 'systemSmall';

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

