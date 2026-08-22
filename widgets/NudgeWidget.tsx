import { Button, HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  padding,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import { widgetTheme } from './shared';

export type NudgeWidgetProps = {
  partnerName: string;
  /** Set briefly after a send so the widget can acknowledge the tap. */
  justSent: boolean;
};

/**
 * Real in-widget buttons.
 *
 * `target` identifies which button was pressed; the app receives it through
 * `addUserInteractionListener` and performs the send. Requires iOS 17+ — on
 * older versions the buttons fall back to opening the app.
 */
function NudgeView(props: NudgeWidgetProps, environment: WidgetEnvironment) {
  'widget';
  const theme = widgetTheme(environment);

  return (
    <VStack
      spacing={8}
      modifiers={[
        frame({ maxWidth: Infinity, maxHeight: Infinity }),
        padding({ all: 12 }),
        containerBackground(theme.background, 'widget'),
      ]}>
      <Text modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle(theme.secondary)]}>
        {props.justSent ? 'Sent ✓' : props.partnerName}
      </Text>
      <Spacer />
      <HStack spacing={10}>
        <Button target="nudge:heart" label="❤️" />
        <Button target="nudge:thinkingOfYou" label="💭" />
      </HStack>
      <Spacer />
    </VStack>
  );
}

export default createWidget<NudgeWidgetProps>('NudgeWidget', NudgeView);
