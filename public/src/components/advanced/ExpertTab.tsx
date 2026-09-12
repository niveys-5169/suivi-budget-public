import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Car } from 'lucide-react';
import { getGitHubSettings, saveGitHubSettings } from '../../services/firebase-api';
import { settingsToast as toast } from './settingsToast';

export const ExpertTab: React.FC = () => {
  const navigate = useNavigate();
  const [isSavingGithub, setIsSavingGithub] = useState(false);
  const [githubConfig, setGithubConfig] = useState({
    owner: localStorage.getItem('github_owner') || 'niveys-5169',
    repo: localStorage.getItem('github_repo') || 'Suivi-Budget',
  });

  useEffect(() => {
    const loadGithubSettings = async () => {
      try {
        const settings = await getGitHubSettings();
        if (settings) {
          setGithubConfig({
            owner: settings.owner || 'niveys-5169',
            repo: settings.repo || 'Suivi-Budget',
          });
        }
      } catch (err) {
        console.warn('Impossible de charger les paramètres GitHub depuis Firestore:', err);
      }
    };

    loadGithubSettings();
  }, []);

  const saveGithubConfig = async () => {
    setIsSavingGithub(true);
    try {
      await saveGitHubSettings(githubConfig.owner, githubConfig.repo);
      localStorage.setItem('github_owner', githubConfig.owner);
      localStorage.setItem('github_repo', githubConfig.repo);
      toast('success', 'Configuration GitHub sauvegardée ✓ (Synchronisée sur tous vos appareils)');
    } catch (err) {
      console.error('Erreur lors de la sauvegarde:', err);
      toast('error', 'Erreur lors de la sauvegarde. Vérifiez votre connexion.');
    } finally {
      setIsSavingGithub(false);
    }
  };

  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-4">
          <Zap size={20} className="text-gold" />
          Mode Expert & Intégrations
        </h2>
        <p className="text-caption font-medium text-label/40 leading-relaxed max-w-2xl">
          Modules spécifiques et intégrations tierces avancées.
        </p>
      </div>

      <div className="space-y-8">
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-white">GitHub (Synchronisation)</h3>
          <p className="text-caption font-medium text-label/40 leading-relaxed">
            Dépôt utilisé pour déclencher la synchronisation automatique des transactions via GitHub
            Actions.
          </p>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <label
                htmlFor="github-owner"
                className="text-caption font-semibold text-label/30 ml-1"
              >
                Owner GitHub
              </label>
              <input
                id="github-owner"
                type="text"
                value={githubConfig.owner}
                onChange={(e) => setGithubConfig({ ...githubConfig, owner: e.target.value })}
                placeholder="niveys-5169"
                className="w-full bg-white/5 border border-separator rounded-lg px-6 py-4 text-white text-sm focus:outline-none focus:border-gold/50 transition-colors"
              />
            </div>

            <div className="space-y-4">
              <label
                htmlFor="github-repo"
                className="text-caption font-semibold text-label/30 ml-1"
              >
                Repository
              </label>
              <input
                id="github-repo"
                type="text"
                value={githubConfig.repo}
                onChange={(e) => setGithubConfig({ ...githubConfig, repo: e.target.value })}
                placeholder="Suivi-Budget"
                className="w-full bg-white/5 border border-separator rounded-lg px-6 py-4 text-white text-sm focus:outline-none focus:border-gold/50 transition-colors"
              />
            </div>
          </div>

          <button
            onClick={saveGithubConfig}
            disabled={isSavingGithub}
            className="w-full py-4 rounded-lg bg-gold text-bg font-semibold text-caption shadow-lg shadow-gold/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSavingGithub ? '⏳ Synchronisation en cours…' : 'Enregistrer Configuration GitHub'}
          </button>
        </div>
      </div>

      <div className="border-t border-separator pt-8">
        <div className="space-y-6">
          <h3 className="text-sm font-bold text-white">Autres Modules</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                navigate('/tronity');
              }}
              className="p-8 rounded-xl bg-white/5 border border-separator hover:border-gold/20 hover:bg-gold/5 transition-all text-left group"
            >
              <div className="p-4 rounded-lg bg-gold/10 text-gold w-fit mb-6 group-hover:scale-110 transition-transform">
                <Car size={24} />
              </div>
              <h3 className="text-sm font-bold text-white mb-2">Tronity HP/HC</h3>
              <p className="text-caption font-medium text-label/40 leading-relaxed">
                Gestion des tarifs de recharge et import des sessions véhicule.
              </p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
