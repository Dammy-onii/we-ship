import { Button, HStack, Image, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  aspectRatio,
  clipped,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  padding,
  resizable,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import { parseSlides, slideIndexForNow, widgetTheme, type CarouselWidgetProps } from './shared';

/**
 * The shared carousel: one item at a time, filling the whole widget.
 *
 * Deliberately a slideshow rather than a laid-out card — the photo runs
 * edge to edge and the only chrome is a thin label track over it. An earlier
 * version stacked a header, the image and a byline as separate rows, which left
 * the picture as a small panel in the middle of a mostly-empty tile.
 *
 * Used for both the partner space and the friends board so the two stay
 * visually identical and can be stacked together on the Home Screen — the only
 * way iOS lets someone swipe between them.
 *
 * `target` on each button is namespaced by surface (`carousel:partner:next`)
 * because both widgets share this view.
 */
export function CarouselView(
  props: CarouselWidgetProps,
  environment: WidgetEnvironment,
  surface: 'partner' | 'friends' = 'partner',
) {
  'widget';
  const theme = widgetTheme(environment);
  const slides = parseSlides(props.slides);
  const index = slideIndexForNow(slides.length, props.offset);
  const slide = slides[index];
  // Chrome sits over the photo, so it is light there and inked on a note.
  const chrome = slide?.imageUri ? theme.onPhoto : theme.secondary;

  if (!slide) {
    return (
      <VStack
        spacing={4}
        modifiers={[
          frame({ maxWidth: Infinity, maxHeight: Infinity }),
          padding({ all: 14 }),
          containerBackground(theme.background, 'widget'),
          widgetURL(props.emptyLink || props.deepLink),
        ]}>
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(theme.text)]}>
          {props.emptyTitle}
        </Text>
        <Text modifiers={[font({ size: 11 }), foregroundStyle(theme.secondary), lineLimit(3)]}>
          {props.emptyBody}
        </Text>
      </VStack>
    );
  }

  return (
    <ZStack
      modifiers={[
        frame({ maxWidth: Infinity, maxHeight: Infinity }),
        containerBackground(theme.background, 'widget'),
        widgetURL(slide.route || props.deepLink),
      ]}>
      {slide.imageUri ? (
        // `uiImage` takes a local file path; a widget cannot follow a signed URL.
        <Image
          uiImage={slide.imageUri}
          modifiers={[
            resizable(),
            aspectRatio({ contentMode: 'fill' }),
            frame({ maxWidth: Infinity, maxHeight: Infinity }),
            clipped(),
          ]}
        />
      ) : (
        <VStack
          modifiers={[
            frame({ maxWidth: Infinity, maxHeight: Infinity }),
            padding({ all: 14 }),
          ]}>
          <Spacer />
          <Text
            modifiers={[
              font({ size: theme.compact ? 15 : 17 }),
              foregroundStyle(theme.text),
              lineLimit(theme.compact ? 4 : 6),
            ]}>
            {slide.text ?? ''}
          </Text>
          <Spacer />
        </VStack>
      )}

      {/* Thin label track, held to the bottom so it never covers a face. */}
      <VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
        <Spacer />
        <HStack spacing={6} modifiers={[padding({ horizontal: 12, vertical: 9 })]}>
          <Text modifiers={[font({ size: 10, weight: 'semibold' }), foregroundStyle(chrome)]}>
            {`${slide.favourite ? '★ ' : ''}${slide.author.toUpperCase()}`}
          </Text>
          <Spacer />
          {slides.length > 1 ? (
            <Text modifiers={[font({ size: 10 }), foregroundStyle(chrome)]}>
              {`${index + 1}/${slides.length}`}
            </Text>
          ) : null}
          {/* iOS has no swipe inside a widget, so paging is explicit. Hidden on
              the lock screen, which has neither the room nor interactivity. */}
          {slides.length > 1 && !theme.lockScreen ? (
            <HStack spacing={2}>
              <Button target={`carousel:${surface}:prev`} label="‹" />
              <Button target={`carousel:${surface}:next`} label="›" />
            </HStack>
          ) : null}
        </HStack>
      </VStack>
    </ZStack>
  );
}

export default createWidget<CarouselWidgetProps>('PartnerCarouselWidget', CarouselView);
