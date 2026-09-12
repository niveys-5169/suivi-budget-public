import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { XCircle } from 'lucide-react';
import { collection, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { toMillis } from '../../utils/firestoreDate';
import type { FirestoreDateLike } from '../../types/banking.types';
import { PageShell, BackButton } from './PageShell';
import { withRetry } from '../../utils/withRetry';

interface ExcludedEmail {
  id?: string;
  email?: string;
  addedAt?: FirestoreDateLike;
  excludedAt?: FirestoreDateLike;
  subject?: string;
}

export const ExcludedEmailsPage: React.FC = () => {
  const navigate = useNavigate();
  const [excluded, setExcluded] = useState<ExcludedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const excludedQuery = collection(db, 'gmail_excluded');
    const unsubscribe = onSnapshot(
      excludedQuery,
      (snapshot) => {
        setExcluded(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
        setLoading(false);
      },
      (error) => {
        console.error('Gmail excluded snapshot failed', error);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, []);

  const removeExcluded = async (id: string) => {
    setActionLoading(true);
    try {
      await withRetry(() => deleteDoc(doc(db, 'gmail_excluded', id)));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <PageShell title="Emails exclus" description="Gérez les messages exclus du reparse Gmail.">
      <BackButton onBack={() => navigate('/advanced')} />
      <div className="mt-8 overflow-hidden rounded-xl bg-white/5 border border-separator">
        <table className="min-w-full border-collapse text-sm text-left">
          <thead>
            <tr className="bg-white/5 text-label/70 text-caption">
              <th className="px-6 py-4">ID Message</th>
              <th className="px-6 py-4">Sujet</th>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4 w-28">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-label/50">
                  Chargement...
                </td>
              </tr>
            ) : excluded.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-label/50">
                  Aucun email exclus.
                </td>
              </tr>
            ) : (
              excluded.map((email) => {
                const ms = toMillis(email.excludedAt);
                const date = ms ? new Date(ms).toLocaleString('fr-FR') : '—';
                return (
                  <tr key={email.id} className="border-t border-separator">
                    <td className="px-6 py-4 font-mono text-caption">{email.id}</td>
                    <td className="px-6 py-4 max-w-[320px] truncate">
                      {email.subject || 'Sans objet'}
                    </td>
                    <td className="px-6 py-4 text-label/70">{date}</td>
                    <td className="px-6 py-4">
                      <button
                        type="button"
                        onClick={() => email.id && removeExcluded(email.id)}
                        disabled={actionLoading}
                        className="inline-flex items-center justify-center h-11 w-full rounded-lg bg-white/5 border border-separator text-white/80 hover:bg-white/10 transition"
                      >
                        <XCircle size={16} className="mr-2" /> Retirer
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
};
