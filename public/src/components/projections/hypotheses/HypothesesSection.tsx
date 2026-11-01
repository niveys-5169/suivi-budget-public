import React, { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button, Card, Stack, Text } from '../../../ui';

interface Props {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

/** Section repliable du formulaire (un bloc de l'onglet Hypothèses de l'Excel). */
export const HypothesesSection: React.FC<Props> = ({ title, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  return (
    <Card>
      <Button
        variant="plain"
        block
        className="justify-between"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((o) => !o)}
      >
        <Text variant="title3">{title}</Text>
        <ChevronDown
          size={20}
          aria-hidden="true"
          className={`text-label-secondary transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </Button>
      {open && (
        <Stack id={bodyId} gap="lg" className="pt-4">
          {children}
        </Stack>
      )}
    </Card>
  );
};
