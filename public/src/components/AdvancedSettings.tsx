import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Settings2, Key, RefreshCcw, Zap, Shapes } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AISettingsForm } from './advanced/AISettingsForm';
import { CategoryIconEditor } from './CategoryIconEditor';
import { MaintenanceTab } from './advanced/MaintenanceTab';
import { ConfigTab } from './advanced/ConfigTab';
import { ExpertTab } from './advanced/ExpertTab';

type SettingsTab = 'api' | 'categories' | 'maintenance' | 'config' | 'expert';

export const AdvancedSettings: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as SettingsTab) || 'api';
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && tab !== activeTab) {
      setActiveTab(tab as SettingsTab);
    }
  }, [searchParams, activeTab]);

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const tabs: {
    id: SettingsTab;
    label: string;
    icon: React.ElementType;
  }[] = [
    { id: 'api', label: 'IA & API', icon: Key },
    { id: 'categories', label: 'Catégories', icon: Shapes },
    { id: 'maintenance', label: 'Maintenance', icon: RefreshCcw },
    { id: 'config', label: 'Configuration', icon: Settings2 },
    { id: 'expert', label: 'Expert', icon: Zap },
  ];

  return (
    <div className="flex flex-col gap-8 py-8">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-4">
          <div className="w-2 h-2 rounded-full bg-gold/40" />
          <span className="text-caption font-semibold text-gold/40">LABORATOIRE</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Paramètres <span className="text-gold">Avancés</span>
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Navigation */}
        <div className="flex flex-col gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-4 px-6 py-4 rounded-lg border transition-all text-left ${
                activeTab === tab.id
                  ? 'bg-gold/10 border-gold/20 text-gold'
                  : 'bg-white/5 border-separator text-label/40 hover:bg-white/10 hover:text-white'
              }`}
            >
              <tab.icon size={18} />
              <span className="text-caption font-semibold">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-surface p-8 md:p-12 rounded-xl min-h-[500px]"
            >
              {activeTab === 'api' && <AISettingsForm />}
              {activeTab === 'categories' && <CategoryIconEditor />}
              {activeTab === 'maintenance' && <MaintenanceTab />}
              {activeTab === 'config' && <ConfigTab />}
              {activeTab === 'expert' && <ExpertTab />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
