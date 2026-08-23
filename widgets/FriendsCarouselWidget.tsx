import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import { CarouselView } from './PartnerCarouselWidget';
import type { CarouselWidgetProps } from './shared';

/**
 * Same carousel, pointed at the friend board.
 *
 * Wrapped rather than passed directly so the paging buttons carry the
 * `friends` surface — otherwise both widgets would page the partner carousel.
 */
function FriendsCarouselView(props: CarouselWidgetProps, environment: WidgetEnvironment) {
  'widget';
  return CarouselView(props, environment, 'friends');
}

export default createWidget<CarouselWidgetProps>('FriendsCarouselWidget', FriendsCarouselView);
