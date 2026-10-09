import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useBankingData } from '../../hooks/useBankingData';
import { computeBankingAlerts } from '../../utils/computeBankingAlerts';
import { Button, Text } from '../../ui';

export const BankingBanner: React.FC = () => {
  const { connections, reports, now } = useBankingData();
  const navigate = useNavigate();
  const alerts = computeBankingAlerts(connections, reports, now);
  const first = alerts[0];
  if (!first) return null;
  return (
    <aside className="px-4 py-4 space-y-2" aria-label="Alertes bancaires">
      <Text>{first.title}</Text>
      <Text variant="caption" tone="secondary">
        {first.desc}
      </Text>
      <Button variant="plain" onClick={() => navigate('/connexions')}>
        Voir les connexions et contrôles ({alerts.length})
      </Button>
      <Button variant="plain" onClick={() => navigate('/notifications')}>
        Centre d’alertes
      </Button>
    </aside>
  );
};
