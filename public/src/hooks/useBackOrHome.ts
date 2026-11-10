import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Retour arrière avec repli : revient à la page précédente si elle existe dans
 * la session, sinon (arrivée directe par URL) ouvre `fallback` sans historique.
 */
export function useBackOrHome(fallback = '/'): () => void {
  const navigate = useNavigate();
  const { key } = useLocation();
  return () => {
    if (key !== 'default') navigate(-1);
    else navigate(fallback, { replace: true });
  };
}
