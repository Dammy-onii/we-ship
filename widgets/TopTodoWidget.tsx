import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  padding,
  strikethrough,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import { widgetTheme } from './shared';

type TodoRow = {
  id: string;
  label: string;
  routine: string;
  done: boolean;
};

export type TopTodoWidgetProps = {
  /** JSON keeps the widget props plain while allowing a size-aware task list. */
  tasks: string;
  done: number;
  total: number;
};

function parseTasks(raw: string): TodoRow[] {
  try {
    const value = JSON.parse(raw || '[]');
    return Array.isArray(value) ? (value as TodoRow[]) : [];
  } catch {
    return [];
  }
}

function TopTodoWidgetView(props: TopTodoWidgetProps, environment: WidgetEnvironment) {
  'widget';
  const { background, text, secondary, accent, compact } = widgetTheme(environment);
  const tasks = parseTasks(props.tasks);
  // WidgetKit home-screen widgets are static rather than scrollable. The small
  // family keeps three comfortably readable rows; medium has room for four.
  const visible = tasks.slice(0, compact ? 3 : 4);

  return (
    <VStack
      alignment="leading"
      spacing={5}
      modifiers={[
        frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' }),
        padding({ all: compact ? 12 : 14 }),
        containerBackground(background, 'widget'),
        widgetURL('weship://todo'),
      ]}>
      <HStack spacing={6}>
        <Image systemName="checklist" size={15} color={accent} />
        <Text modifiers={[font({ size: 10, weight: 'bold' }), foregroundStyle(secondary)]}>
          WESHIP 2DO
        </Text>
        <Spacer />
        {props.total > 0 ? (
          <Text modifiers={[font({ size: 11, weight: 'bold' }), foregroundStyle(accent)]}>
            {`${props.done}/${props.total}`}
          </Text>
        ) : null}
      </HStack>

      {visible.length ? (
        <VStack alignment="leading" spacing={compact ? 4 : 5} modifiers={[frame({ maxWidth: Infinity })]}>
          {visible.map((task) => (
            <HStack key={task.id} spacing={7} modifiers={[frame({ maxWidth: Infinity, minHeight: 25 })]}>
              <Image
                systemName={task.done ? 'checkmark.circle.fill' : 'circle'}
                size={15}
                color={task.done ? secondary : accent}
              />
              <VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
                <Text
                  modifiers={[
                    font({ size: compact ? 11 : 12, weight: 'semibold' }),
                    foregroundStyle(task.done ? secondary : text),
                    strikethrough({ isActive: task.done, pattern: 'solid' }),
                    lineLimit(1),
                  ]}>
                  {task.label}
                </Text>
                {!compact ? (
                  <Text modifiers={[font({ size: 8, weight: 'medium' }), foregroundStyle(secondary), lineLimit(1)]}>
                    {task.routine.toUpperCase()}
                  </Text>
                ) : null}
              </VStack>
            </HStack>
          ))}
        </VStack>
      ) : (
        <VStack spacing={5} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
          <Image systemName="checkmark.circle.fill" size={28} color={accent} />
          <Text modifiers={[font({ size: 16, weight: 'semibold' }), foregroundStyle(text)]}>
            All caught up
          </Text>
          <Text modifiers={[font({ size: 10 }), foregroundStyle(secondary)]}>Tap to open Weship</Text>
        </VStack>
      )}
    </VStack>
  );
}

export default createWidget<TopTodoWidgetProps>('TopTodoWidget', TopTodoWidgetView);
