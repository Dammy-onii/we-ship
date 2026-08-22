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

import { parseSlides, slideIndexForNow, widgetTheme, type CarouselWidgetProps } from './shared';

/**
 * The shared carousel: photos, videos and notes, auto-advancing.
 *
 * Used for both the partner space and the friends board — same layout,
 * different source — so the two stay visually identical.
 */
export function CarouselView(props: CarouselWidgetProps, environment: WidgetEnvironment) {
  'widget';
  const theme = widgetTheme(environment);
  const slides = parseSlides(props.slides);
  const slide = slides[slideIndexForNow(slides.length)];

  return (
    <VStack
      alignment="leading"
      spacing={6}
      modifiers={[
        frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' }),
        padding({ all: 14 }),
        containerBackground(theme.background, 'widget'),
        widgetURL(props.deepLink),
      ]}>
      <HStack spacing={6}>
        <Text modifiers={[font({ size: 10, weight: 'bold' }), foregroundStyle(theme.secondary)]}>
          {props.title.toUpperCase()}
        </Text>
        <Spacer />
        {slides.length > 1 ? (
          <Text modifiers={[font({ size: 10 }), foregroundStyle(theme.secondary)]}>
            {`${slideIndexForNow(slides.length) + 1}/${slides.length}`}
          </Text>
        ) : null}
      </HStack>

      <Spacer />

      {!slide ? (
        <Text modifiers={[font({ size: 13 }), foregroundStyle(theme.secondary)]}>
          Nothing shared yet
        </Text>
      ) : slide.imageUri ? (
        // `uiImage` takes a local file path; a widget cannot follow a signed URL.
        <Image
          uiImage={slide.imageUri}
          modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}
        />
      ) : (
        <Text
          modifiers={[
            font({ size: theme.compact ? 14 : 16 }),
            foregroundStyle(theme.text),
            lineLimit(theme.compact ? 4 : 5),
          ]}>
          {slide.text ?? ''}
        </Text>
      )}

      <Spacer />

      <Text modifiers={[font({ size: 10, weight: 'semibold' }), foregroundStyle(theme.secondary)]}>
        {slide ? `${slide.pinned ? '📌 ' : ''}${slide.author.toUpperCase()}` : ''}
      </Text>
    </VStack>
  );
}

export default createWidget<CarouselWidgetProps>('PartnerCarouselWidget', CarouselView);
