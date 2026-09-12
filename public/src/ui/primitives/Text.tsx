import React from 'react';

/**
 * Rampe typographique unique du système (échelle iOS).
 *
 * `overline` est la SEULE variante en capitales et la seule à porter un
 * letter-spacing élargi. Partout ailleurs la hiérarchie passe par la taille et
 * le poids — c'est ce qui remplace les 623 `uppercase` de l'ancien code.
 */
export type TextVariant =
  | 'display'
  | 'title1'
  | 'title2'
  | 'title3'
  | 'headline'
  | 'body'
  | 'callout'
  | 'subhead'
  | 'footnote'
  | 'caption'
  | 'overline';

export type TextTone =
  'primary' | 'secondary' | 'tertiary' | 'accent' | 'positive' | 'negative' | 'warning';

const VARIANT: Record<TextVariant, string> = {
  display: 'font-serif text-display font-semibold tracking-tight',
  title1: 'text-title1 font-semibold tracking-tight',
  title2: 'text-title2 font-semibold',
  title3: 'text-title3 font-semibold',
  headline: 'text-headline font-semibold',
  body: 'text-body',
  callout: 'text-callout',
  subhead: 'text-subhead',
  footnote: 'text-footnote',
  caption: 'text-caption font-medium',
  overline: 'text-overline font-semibold uppercase',
};

const TONE: Record<TextTone, string> = {
  primary: 'text-label',
  secondary: 'text-label-secondary',
  tertiary: 'text-label-tertiary',
  accent: 'text-gold',
  positive: 'text-positive',
  negative: 'text-negative',
  warning: 'text-warning',
};

/** Élément HTML par défaut pour chaque variante, pour garder un DOM sémantique. */
const DEFAULT_TAG: Record<TextVariant, React.ElementType> = {
  display: 'p',
  title1: 'h1',
  title2: 'h2',
  title3: 'h3',
  headline: 'p',
  body: 'p',
  callout: 'p',
  subhead: 'p',
  footnote: 'p',
  caption: 'p',
  overline: 'p',
};

interface TextProps extends React.HTMLAttributes<HTMLElement> {
  variant?: TextVariant;
  tone?: TextTone;
  /** Aligne les chiffres en colonne (montants, tableaux). */
  numeric?: boolean;
  /**
   * Tronque sur une ligne. Pose automatiquement `title` avec le texte complet
   * quand `children` est une chaîne — une troncature sans `title` rend la
   * donnée inaccessible.
   */
  truncate?: boolean;
  as?: React.ElementType;
}

export const Text = React.forwardRef<HTMLElement, TextProps>(
  (
    {
      variant = 'body',
      tone = 'primary',
      numeric = false,
      truncate = false,
      as,
      className = '',
      children,
      title,
      ...props
    },
    ref,
  ) => {
    const Tag = as ?? DEFAULT_TAG[variant];
    const cls = [
      VARIANT[variant],
      TONE[tone],
      numeric ? '[font-variant-numeric:tabular-nums]' : '',
      truncate ? 'truncate' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <Tag
        ref={ref}
        className={cls}
        title={title ?? (truncate && typeof children === 'string' ? children : undefined)}
        {...props}
      >
        {children}
      </Tag>
    );
  },
);

Text.displayName = 'Text';
