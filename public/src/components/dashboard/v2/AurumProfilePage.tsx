import React from 'react';
import { motion } from 'framer-motion';
import {
  User,
  Shield,
  Bell,
  Settings,
  LogOut,
  ChevronRight,
  Eye,
  EyeOff,
  Smartphone,
  Zap,
  RefreshCw,
  BarChart2,
} from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { usePreferences } from '../../../hooks/usePreferences';

export const AurumProfilePage: React.FC<{ onNavigate?: (tab: string) => void }> = ({
  onNavigate,
}) => {
  const { user, signOut } = useAuth();
  const { privacyMode, setPrivacyMode } = usePreferences();

  const menuItems = [
    {
      id: 'personal',
      icon: <User size={20} />,
      label: 'Informations personnelles',
      desc: 'Nom, email, numéro de téléphone',
      color: 'text-blue-400',
    },
    {
      id: 'insights',
      icon: <BarChart2 size={20} />,
      label: 'Analyses & Tendances',
      desc: 'Évolution des dépenses par catégorie sur 3, 6 ou 12 mois',
      color: 'text-gold',
      action: () => onNavigate?.('insights'),
    },
    {
      id: 'recurring',
      icon: <RefreshCw size={20} />,
      label: 'Récurrences',
      desc: 'Dépenses récurrentes détectées automatiquement',
      color: 'text-gold',
      action: () => onNavigate?.('recurring'),
    },
    {
      id: 'rules',
      icon: <Zap size={20} />,
      label: 'Automatisations',
      desc: 'Protocoles de catégorisation automatique',
      color: 'text-gold',
      action: () => onNavigate?.('rules'),
    },
    {
      id: 'advanced_settings',
      icon: <Settings size={20} />,
      label: 'Réglages Avancés',
      desc: 'API GitHub, Énergie, RAV, Attribution',
      color: 'text-gold',
      action: () => onNavigate?.('advanced_settings'),
    },
    {
      id: 'security',
      icon: <Shield size={20} />,
      label: 'Sécurité & Accès',
      desc: '2FA, Sessions actives, Mot de passe',
      color: 'text-positive',
    },
    {
      id: 'notifications',
      icon: <Bell size={20} />,
      label: 'Notifications',
      desc: 'Alertes de solde, Transactions suspectes',
      color: 'text-gold',
    },
  ];

  return (
    <div className="min-h-screen bg-bg text-white font-sans overflow-x-hidden selection:bg-gold/30 pb-40">
      <div className="fixed top-[-10%] right-[-10%] w-[60%] h-[50%] bg-blue-600/5 blur-[120px] rounded-full -z-10" />
      <nav className="flex items-center justify-between px-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-8">
        <h1 className="text-3xl font-bold tracking-tighter text-white">Profil & Sécurité</h1>
        <div className="w-12 h-12 rounded-lg bg-surface border border-separator flex items-center justify-center text-white/50">
          <Settings size={22} />
        </div>
      </nav>
      <main className="px-6 space-y-10">
        <section className="relative rounded-xl p-10 bg-surface border border-separator backdrop-blur-3xl flex flex-col items-center text-center space-y-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-xl bg-gradient-to-tr from-gold to-gold/20 p-[1.5px] shadow-[0_20px_50px_rgba(212,175,55,0.2)]">
              <div className="w-full h-full rounded-xl bg-bg flex items-center justify-center overflow-hidden border border-separator">
                <User aria-label="Profil" className="h-12 w-12 text-gold" />
              </div>
            </div>
            <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-positive rounded-full border-[5px] border-bg" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">
              {user?.displayName || 'Client Privé'}
            </h2>
            <p className="text-sm font-medium text-label-tertiary mt-1">{user?.email}</p>
          </div>
          <div className="flex gap-4">
            <span className="px-4 py-2 rounded-full bg-gold/10 border border-gold/20 text-caption font-semibold text-gold">
              Membre Aurum
            </span>
            <span className="px-4 py-2 rounded-full bg-white/5 border border-separator text-caption font-semibold text-white/40">
              Vérifié
            </span>
          </div>
        </section>
        <section className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setPrivacyMode((v) => !v)}
            className={`rounded-xl p-6 border transition-all ${privacyMode ? 'bg-gold/10 border-gold/30' : 'bg-surface border-separator'}`}
          >
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${privacyMode ? 'bg-gold text-bg' : 'bg-white/5 text-white/40'}`}
            >
              {privacyMode ? <EyeOff size={20} /> : <Eye size={20} />}
            </div>
            <p className="text-caption font-semibold text-label-tertiary mb-1">Mode Privé</p>
            <p className={`text-sm font-bold ${privacyMode ? 'text-gold' : 'text-white'}`}>
              {privacyMode ? 'Activé' : 'Désactivé'}
            </p>
          </button>
          <div className="rounded-xl p-6 bg-surface border border-separator">
            <div className="w-10 h-10 rounded-lg bg-positive/10 text-positive flex items-center justify-center mb-4">
              <Smartphone size={20} />
            </div>
            <p className="text-caption font-semibold text-label-tertiary mb-1">Authentification</p>
            <p className="text-sm font-bold text-white">Biométrique</p>
          </div>
        </section>
        <section className="space-y-4">
          {menuItems.map((item, i) => (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => (item.action ? item.action() : null)}
              className="w-full flex items-center justify-between p-6 rounded-xl bg-surface border border-separator hover:bg-white/[0.05] transition-all group"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center ${item.color} group-hover:scale-110 transition-transform`}
                >
                  {item.icon}
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-white tracking-tight">{item.label}</p>
                  <p className="text-caption font-medium text-label-tertiary mt-1">{item.desc}</p>
                </div>
              </div>
              <ChevronRight
                size={18}
                className="text-label-tertiary group-hover:text-white transition-colors"
              />
            </motion.button>
          ))}
        </section>
        <section className="pt-6">
          <button
            onClick={() => signOut()}
            className="w-full h-20 rounded-xl bg-negative/5 border border-negative/20 flex items-center justify-center gap-4 text-negative font-semibold text-caption hover:bg-negative/10 transition-all"
          >
            <LogOut size={20} /> Déconnexion du coffre
          </button>
        </section>
      </main>
    </div>
  );
};
