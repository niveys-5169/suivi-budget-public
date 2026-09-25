import React from 'react';
import { Modal } from '../../components/shared/Modal';
import { AIProvidersForm } from '../../components/advanced/AIProvidersForm';

interface Props {
  onClose: () => void;
}

export function MAIConfigSheet({ onClose }: Props) {
  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Configuration IA"
      variant="sheet"
      size="sm"
      fullHeight={false}
    >
      <div className="px-6 py-4 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
        <AIProvidersForm onSaved={onClose} />
      </div>
    </Modal>
  );
}
