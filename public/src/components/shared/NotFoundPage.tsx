import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState } from '../../ui';

interface NotFoundPageProps {
  title?: string;
  description?: string;
}

/** Route inconnue : rendue dans le shell (sidebar / bottom nav conservées), avec une issue claire. */
export const NotFoundPage: React.FC<NotFoundPageProps> = ({
  title = 'Page introuvable',
  description = "L'adresse demandée n'existe pas ou a été déplacée.",
}) => {
  const navigate = useNavigate();
  return (
    <EmptyState
      icon={<Compass size={24} />}
      title={title}
      description={description}
      action={{ label: 'Retour au tableau de bord', onClick: () => navigate('/') }}
    />
  );
};
