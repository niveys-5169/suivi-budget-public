import React from 'react';
import { Modal } from '../../components/shared/Modal';
import { AIProvidersForm } from '../../components/advanced/AIProvidersForm';

interface Props {
  onClose: () => void;
  /**
   * Faux pour garder la feuille ouverte après l'enregistrement, et donc le
   * statut de synchro visible (échec Firestore compris).
   */
  closeOnSave?: boolean;
}

export function MAIConfigSheet({ onClose, closeOnSave = true }: Props) {
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
        <AIProvidersForm onSaved={closeOnSave ? onClose : undefined} />
      </div>
    </Modal>
  );
}
