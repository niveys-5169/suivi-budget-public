/**
 * AURUM v3 — Design System.
 *
 * Point d'entrée unique des primitives, consommé par les deux arbres d'écrans
 * (`components/` desktop et `mobile/` PWA). Un composant applicatif ne doit
 * jamais réécrire à la main ce qui vit ici.
 *
 * Voir DESIGN_SYSTEM.md pour les règles d'usage.
 */

export { color, radius, space, size, font, categoryColor, chartSeries } from './tokens';
export { seriesColorFor, amountColor, gaugeColor } from './tokens';
export type { CategoryColorKey } from './tokens';

export { Text } from './primitives/Text';
export type { TextVariant, TextTone } from './primitives/Text';

export { Amount } from './primitives/Amount';

export { Card, Surface } from './primitives/Card';
export type { CardPadding } from './primitives/Card';

export { Stack, Separator } from './primitives/Stack';
export type { Gap } from './primitives/Stack';

export { Button, IconButton } from './primitives/Button';
export type { ButtonVariant, ControlSize } from './primitives/Button';

export { Badge, Chip, ProgressBar } from './primitives/Badge';
export type { BadgeTone } from './primitives/Badge';

export { List, ListItem, Tile } from './primitives/List';

export { Field, Input, Textarea, Select, Switch } from './primitives/Field';

export { NavBar, Toolbar } from './primitives/NavBar';

export { SegmentedControl } from './primitives/SegmentedControl';
export type { Segment } from './primitives/SegmentedControl';

export { Sheet, Modal } from './primitives/Sheet';
export type { SheetSize, SheetVariant } from './primitives/Sheet';

export { EmptyState, Skeleton, Section } from './primitives/Feedback';

export { Screen } from './primitives/Screen';
export { TabBar } from './primitives/TabBar';
export type { TabItem } from './primitives/TabBar';
