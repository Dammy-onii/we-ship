import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Variant = keyof typeof Typography;
type ColorKey =
  | 'text'
  | 'textSoft'
  | 'textFaint'
  | 'primary'
  | 'primaryDeep'
  | 'partner'
  | 'onPrimary'
  | 'gold'
  | 'accent'
  | 'bloom';

export type TextProps = RNTextProps & {
  variant?: Variant;
  color?: ColorKey;
  center?: boolean;
  /** Renders on top of photography — switches to light ink. */
  onPhoto?: boolean;
};

/** Themed text. Display variants use Fraunces; UI variants use Inter. */
export function Text({
  variant = 'body',
  color = 'text',
  center,
  onPhoto,
  style,
  ...rest
}: TextProps) {
  const theme = useTheme();
  return (
    <RNText
      style={[
        Typography[variant],
        { color: onPhoto ? '#FFFCF7' : theme[color] },
        center && { textAlign: 'center' },
        style,
      ]}
      {...rest}
    />
  );
}
