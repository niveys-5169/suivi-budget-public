import React, { useId } from 'react';
import { Text } from './Text';

interface FieldProps {
  label: string;
  /** Aide affichée sous le champ. Masquée quand une erreur est présente. */
  hint?: string;
  error?: string;
  required?: boolean;
  /**
   * Reçoit l'`id` et les attributs ARIA à poser sur le contrôle. Passer par une
   * fonction garantit l'association `label[for]` / `aria-describedby`, que la
   * suite a11y (TransactionFormModal.a11y.test.tsx) vérifie.
   */
  children: (props: {
    id: string;
    'aria-describedby': string | undefined;
    'aria-invalid': boolean | undefined;
    required: boolean | undefined;
  }) => React.ReactNode;
  className?: string;
}

export const Field: React.FC<FieldProps> = ({
  label,
  hint,
  error,
  required,
  children,
  className = '',
}) => {
  const id = useId();
  const messageId = `${id}-msg`;
  const message = error ?? hint;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor={id} className="text-footnote text-label-secondary">
        {label}
        {required && (
          <span className="text-negative" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      {children({
        id,
        'aria-describedby': message ? messageId : undefined,
        'aria-invalid': error ? true : undefined,
        required: required || undefined,
      })}
      {message && (
        <Text
          id={messageId}
          variant="footnote"
          tone={error ? 'negative' : 'tertiary'}
          role={error ? 'alert' : undefined}
        >
          {message}
        </Text>
      )}
    </div>
  );
};

/**
 * Base commune aux contrôles de saisie.
 *
 * `text-base` vaut 17 px dans la rampe : au-dessus du seuil de 16 px, donc
 * Safari iOS ne zoome pas au focus.
 */
const CONTROL =
  'w-full min-h-11 rounded-md bg-raised px-4 text-base text-label ' +
  'border border-transparent placeholder:text-label-tertiary ' +
  'transition-colors focus:border-gold focus:outline-none ' +
  'disabled:opacity-40 aria-[invalid=true]:border-negative';

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className = '', type = 'text', ...props }, ref) => (
  <input ref={ref} type={type} className={`${CONTROL} ${className}`} {...props} />
));
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className = '', rows = 4, ...props }, ref) => (
  <textarea ref={ref} rows={rows} className={`${CONTROL} py-2 ${className}`} {...props} />
));
Textarea.displayName = 'Textarea';

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className = '', children, ...props }, ref) => (
  <select ref={ref} className={`${CONTROL} cursor-pointer pr-8 ${className}`} {...props}>
    {children}
  </select>
));
Select.displayName = 'Select';

interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Interrupteur. Remplace le markup dupliqué à l'identique dans ConfigTab et
 * MSettingsModal, qui n'avait aucune primitive commune.
 */
export const Switch: React.FC<SwitchProps> = ({
  checked,
  onChange,
  label,
  disabled,
  className = '',
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={[
      'relative h-8 w-13 shrink-0 rounded-full transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
      'disabled:opacity-40',
      checked ? 'bg-gold' : 'bg-raised',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
  >
    <span
      aria-hidden="true"
      className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-[left] ${checked ? 'left-6' : 'left-1'}`}
    />
  </button>
);
