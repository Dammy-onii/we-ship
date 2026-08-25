import { HStack, Image, Link, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  background,
  containerBackground,
  clipShape,
  font,
  foregroundStyle,
  frame,
  lineLimit,
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
        alignment="leading"
        spacing={8}
        modifiers={[
          frame({ maxWidth: Infinity, maxHeight: Infinity }),
          padding({ all: 12 }),
          containerBackground(theme.background, 'widget'),
        ]}>
        <HStack spacing={6}>
          <Image systemName="paperplane.fill" size={13} color={theme.accent} />
          <Text modifiers={[font({ size: 9, weight: 'bold' }), foregroundStyle(theme.secondary), lineLimit(1)]}>
            {`SEND TO ${props.partnerName.toUpperCase()}`}
          </Text>
        </HStack>
        <Spacer />
        <Link destination="weship://goodies?composer=photo">
          <HStack
            spacing={8}
            modifiers={[
              frame({ maxWidth: Infinity, minHeight: 62 }),
              padding({ horizontal: 10 }),
              background(theme.photoFill),
              clipShape('roundedRectangle', 16),
            ]}>
            <Image systemName="camera.fill" size={22} color={theme.accent} />
            <VStack alignment="leading" spacing={0}>
              <Text modifiers={[font({ size: 14, weight: 'bold' }), foregroundStyle(theme.text)]}>
                Photo
              </Text>
              <Text modifiers={[font({ size: 9 }), foregroundStyle(theme.secondary)]}>Open camera</Text>
            </VStack>
            <Spacer />
            <Image systemName="chevron.right" size={11} color={theme.secondary} />
          </HStack>
        </Link>
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
      <HStack spacing={7}>
        <Image systemName="paperplane.fill" size={14} color={theme.accent} />
        <Text modifiers={[font({ size: 10, weight: 'bold' }), foregroundStyle(theme.text), lineLimit(1)]}>
          {`SEND TO ${props.partnerName.toUpperCase()}`}
        </Text>
        <Spacer />
        <Text modifiers={[font({ size: 8, weight: 'bold' }), foregroundStyle(theme.secondary)]}>
          OPEN COMPOSER
        </Text>
      </HStack>
      <Spacer />
      <HStack spacing={8}>
        <Action
          icon="camera.fill"
          caption="Photo"
          hint="Camera"
          fill={theme.photoFill}
          destination="weship://goodies?composer=photo"
          theme={theme}
        />
        <Action
          icon="mic.fill"
          caption="Voice"
          hint="Record"
          fill={theme.voiceFill}
          destination={`weship://goodies?composer=voice&record=${recordToken}`}
          theme={theme}
        />
        <Action
          icon="note.text"
          caption="Note"
          hint="Write"
          fill={theme.noteFill}
          destination="weship://goodies?composer=note"
          theme={theme}
        />
      </HStack>
      <Spacer />
    </VStack>
  );
}

function Action({
  icon,
  caption,
  hint,
  fill,
  destination,
  theme,
}: {
  icon: React.ComponentProps<typeof Image>['systemName'];
  caption: string;
  hint: string;
  fill: string;
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
          background(fill),
          clipShape('roundedRectangle', 16),
        ]}>
        <Image systemName={icon} size={22} color={theme.accent} />
        <Text modifiers={[font({ size: 10, weight: 'bold' }), foregroundStyle(theme.text)]}>
          {caption.toUpperCase()}
        </Text>
        <Text modifiers={[font({ size: 8 }), foregroundStyle(theme.secondary)]}>{hint}</Text>
      </VStack>
    </Link>
  );
}

export default createWidget<QuickSendWidgetProps>('QuickSendWidget', QuickSendView);
