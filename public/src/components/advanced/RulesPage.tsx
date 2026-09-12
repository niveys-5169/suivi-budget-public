import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AurumRulesPage } from '../dashboard/v2/AurumRulesPage';

export const RulesPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-bg text-white">
      <AurumRulesPage onBack={() => navigate('/advanced')} />
    </div>
  );
};
