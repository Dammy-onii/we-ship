import { createWidget } from 'expo-widgets';

import { CarouselView } from './PartnerCarouselWidget';
import type { CarouselWidgetProps } from './shared';

/** Same carousel, pointed at the friend board. */
export default createWidget<CarouselWidgetProps>('FriendsCarouselWidget', CarouselView);
