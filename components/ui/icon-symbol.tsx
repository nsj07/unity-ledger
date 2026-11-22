// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { type ColorValue, OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<Extract<SymbolViewProps['name'], string>, ComponentProps<typeof MaterialIcons>['name']>;
export type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'house': 'other-houses',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'arrow.down.left.circle.fill': 'arrow-circle-down',
  'arrow.up.right.circle.fill': 'arrow-circle-up',
  'arrow.left.arrow.right.circle.fill': 'swap-horizontal-circle',
  'chart.line.uptrend.xyaxis.circle.fill': 'trending-up',
  'rectangle.portrait.and.arrow.right': 'logout',
  'creditcard.fill': 'credit-card',
  'chart.pie.fill': 'pie-chart',
  'chart.bar.xaxis': 'bar-chart',
  'gearshape.fill': 'settings',
  'pencil': 'edit',
  'trash.fill': 'delete',
  'plus': 'add',
  'xmark.circle.fill': 'cancel',
  'chevron.left': 'chevron-left',
  'chevron.down': 'keyboard-arrow-down',
  'person.badge.plus': 'person-add',
  'person.2.fill': 'groups',
  'lock.fill': 'lock',
  'doc.on.doc': 'content-copy',
  'square.and.arrow.up': 'share',
  'checkmark': 'check',
  'calendar': 'calendar-today',
  'tag.fill': 'label',
  'note.text': 'notes',
  'line.3.horizontal': 'menu',
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue | ColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color as string | OpaqueColorValue | undefined} size={size} name={MAPPING[name]} style={style} />;
}
