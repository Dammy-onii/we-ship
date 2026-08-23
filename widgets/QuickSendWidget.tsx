import { HStack, Link, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  background,
  containerBackground,
  clipShape,
  font,
  foregroundStyle,
  frame,
  padding,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import { widgetTheme } from './shared';

export type QuickSendWidgetProps = {
  partnerName: string;
  /** Empty when unpaired, so the widget can say why the buttons will not help. */
  paired: boolean;
};

/**
 * One tap from the home screen to sending something.
 *
 * `Link`, not `Button`: an iOS 17 widget Button runs an App Intent *without*
 * opening the app, which is right for a nudge but wrong here — every one of
 * these needs the camera, the microphone or the keyboard. Each region opens the
 * composer already switched to the right kind, and the voice link carries a
 * timestamp that makes the app start recording on arrival.
 *
 * Small widgets only honour a single tap target, so that size shows one primary
 * action rather than three regions that would all do the same thing.
 */
function QuickSendView(props: QuickSendWidgetProps, environment: WidgetEnvironment) {
  'widget';
  const theme = widgetTheme(environment);
  // Changes per render so the app treats each arrival as a fresh request
  // rather than ignoring a repeat of the last one.
  const recordToken = Date.now();

  if (!props.paired) {
    return (
      <VStack
        spacing={4}
        modifiers={[
          frame({ maxWidth: Infinity, maxHeight: Infinity }),
          padding({ all: 14 }),
          containerBackground(theme.background, 'widget'),
        ]}>
        <Link
          label="Pair with your partner"
          destination="weship://pairing"
          modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(theme.text)]}
        />
        <Text modifiers={[font({ size: 11 }), foregroundStyle(theme.secondary)]}>
          Then this becomes one tap to send.
        </Text>
      </VStack>
    );
  }

  if (theme.compact) {
    return (
      <VStack
        modifiers={[
          frame({ maxWidth: Infinity, maxHeight: Infinity }),
          padding({ all: 12 }),
          containerBackground(theme.background, 'widget'),
        ]}>
        <Text modifiers={[font({ size: 10, weight: 'semibold' }), foregroundStyle(theme.secondary)]}>
          {`SEND TO ${props.partnerName.toUpperCase()}`}
        </Text>
        <Spacer />
        <Link
          label="📷  Photo"
          destination="weship://goodies?composer=photo"
          modifiers={[font({ size: 15, weight: 'semibold' }), foregroundStyle(theme.text)]}
        />
        <Spacer />
      </VStack>
    );
  }

  return (
    <VStack
      alignment="leading"
      spacing={10}
      modifiers={[
        frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'leading' }),
        padding({ all: 14 }),
        containerBackground(theme.background, 'widget'),
      ]}>
      <Text modifiers={[font({ size: 10, weight: 'semibold' }), foregroundStyle(theme.secondary)]}>
        {`SEND TO ${props.partnerName.toUpperCase()}`}
      </Text>
      <Spacer />
      <HStack spacing={8}>
        <Action label="📷" caption="Photo" destination="weship://goodies?composer=photo" theme={theme} />
        <Action
          label="🎙"
          caption="Voice"
          destination={`weship://goodies?composer=voice&record=${recordToken}`}
          theme={theme}
        />
        <Action label="✎" caption="Note" destination="weship://goodies?composer=note" theme={theme} />
      </HStack>
      <Spacer />
    </VStack>
  );
}

function Action({
  label,
  caption,
  destination,
  theme,
}: {
  label: string;
  caption: string;
  destination: string;
  theme: ReturnType<typeof widgetTheme>;
}) {
  'widget';
  return (
    <Link destination={destination}>
      <VStack
        spacing={3}
        modifiers={[
          frame({ maxWidth: Infinity, minHeight: 58 }),
          background(theme.surface),
          clipShape('roundedRectangle'),
        ]}>
        <Text modifiers={[font({ size: 20 })]}>{label}</Text>
        <Text modifiers={[font({ size: 10, weight: 'semibold' }), foregroundStyle(theme.secondary)]}>
          {caption.toUpperCase()}
        </Text>
      </VStack>
    </Link>
  );
}

export default createWidget<QuickSendWidgetProps>('QuickSendWidget', QuickSendView);
