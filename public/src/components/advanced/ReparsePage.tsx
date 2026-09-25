import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { toMillis } from '../../utils/firestoreDate';
import type { FirestoreDateLike } from '../../types/banking.types';
import { PageShell, BackButton } from './PageShell';
import { withRetry } from '../../utils/withRetry';
import { triggerGitHubWorkflow } from '../../services/firebase-api';
import { settingsToast as toast } from './settingsToast';

interface GmailMessage {
  id: string;
  snippet?: string;
  date?: string;
  receivedAt?: FirestoreDateLike;
  subject?: string;
  lastStatus?: string;
}

interface GmailReparseJob {
  id: string;
  status?: string;
  createdAt?: FirestoreDateLike;
  messageId?: string;
  progressPct?: number;
  resultMessage?: string;
}

export const ReparsePage: React.FC = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<GmailMessage[]>([]);
  const [jobs, setJobs] = useState<GmailReparseJob[]>([]);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const messagesQuery = query(
      collection(db, 'gmail_messages'),
      orderBy('receivedAt', 'desc'),
      limit(200),
    );
    const jobsQuery = query(
      collection(db, 'reparse_jobs'),
      orderBy('requestedAt', 'desc'),
      limit(100),
    );
    const excludedQuery = collection(db, 'gmail_excluded');

    const unsubMessages = onSnapshot(messagesQuery, (snapshot) => {
      setMessages(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
    });
    const unsubJobs = onSnapshot(jobsQuery, (snapshot) => {
      setJobs(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
    });
    const unsubExcluded = onSnapshot(excludedQuery, (snapshot) => {
      setExcludedIds(new Set(snapshot.docs.map((docSnap) => docSnap.id)));
      setLoading(false);
    });

    return () => {
      unsubMessages();
      unsubJobs();
      unsubExcluded();
    };
  }, []);

  // Le job n'est consommé que par src/importer.py (workflow GitHub import-linxo) :
  // sans dispatch, il attendrait le prochain cron quotidien.
  const requestJob = async (messageId: string, subject: string) => {
    setActionLoading(true);
    try {
      await withRetry(() =>
        setDoc(
          doc(db, 'reparse_jobs', messageId),
          {
            messageId,
            subject,
            status: 'requested',
            requestedBy: 'user',
            requestedAt: serverTimestamp(),
          },
          { merge: true },
        ),
      );
      const result = (await triggerGitHubWorkflow('import-linxo')) as { status?: string } | null;
      if (result?.status === 'success') {
        toast('info', 'Reparse lancé — résultat dans ~1 minute.');
      } else {
        toast(
          'error',
          'Demande enregistrée, mais le lancement a échoué : traitement au prochain import.',
        );
      }
    } finally {
      setActionLoading(false);
    }
  };

  const excludeEmail = async (messageId: string, subject: string) => {
    setActionLoading(true);
    try {
      await withRetry(() =>
        setDoc(doc(db, 'gmail_excluded', messageId), {
          subject,
          excludedAt: serverTimestamp(),
        }),
      );
    } finally {
      setActionLoading(false);
    }
  };

  const removeExcluded = async (messageId: string) => {
    setActionLoading(true);
    try {
      await withRetry(() => deleteDoc(doc(db, 'gmail_excluded', messageId)));
    } finally {
      setActionLoading(false);
    }
  };

  const submitFullScan = () => requestJob('full_scan_request', 'Scan complet');

  const fullScan = useMemo(
    () =>
      jobs.find((job) => job.messageId === 'full_scan_request' || job.id === 'full_scan_request'),
    [jobs],
  );

  const jobsById = useMemo(() => new Map(jobs.map((job) => [job.id, job])), [jobs]);

  return (
    <PageShell
      title="Reparse Gmail"
      description="Visualisez les emails Linxo, déclenchez un reparse ou lancez un scan complet."
    >
      <BackButton onBack={() => navigate('/advanced')} />
      <div className="mt-8 space-y-8">
        <div className="rounded-xl bg-white/5 border border-separator p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Scan complet Gmail</h2>
              <p className="text-sm text-label/70">
                Suivez l&apos;état de la demande de reparse de tous les emails.
              </p>
            </div>
            <button
              type="button"
              onClick={submitFullScan}
              disabled={actionLoading}
              className="h-14 rounded-lg bg-gold text-bg font-semibold px-6 hover:bg-gold-light transition"
            >
              {actionLoading ? 'Envoi...' : 'Scanner tout'}
            </button>
          </div>
          {fullScan ? (
            <div className="mt-6 rounded-lg bg-white/5 border border-separator p-4 text-sm text-label/80">
              <p>
                <span className="font-semibold">Statut :</span>{' '}
                {String(fullScan.status || 'requested')}
              </p>
              <p>
                <span className="font-semibold">Progression :</span>{' '}
                {Math.round(Number(fullScan.progressPct || 0))}%
              </p>
              <p>
                <span className="font-semibold">Message :</span>{' '}
                {String(fullScan.resultMessage || 'Aucune information')}
              </p>
            </div>
          ) : null}
        </div>

        <div className="rounded-xl bg-white/5 border border-separator p-8">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold">Emails Linxo récents</h2>
              <p className="text-sm text-label/70">
                Les 200 derniers emails détectés pour reparse.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm text-left">
              <thead>
                <tr className="bg-white/5 text-label/70 text-caption">
                  <th className="px-6 py-4">Réception</th>
                  <th className="px-6 py-4">Sujet</th>
                  <th className="px-6 py-4">Statut</th>
                  <th className="px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-label/50">
                      Chargement...
                    </td>
                  </tr>
                ) : messages.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-label/50">
                      Aucun email détecté.
                    </td>
                  </tr>
                ) : (
                  messages.map((message) => {
                    const ms = toMillis(message.receivedAt);
                    const date = ms
                      ? new Date(ms).toLocaleString('fr-FR')
                      : message.receivedAt
                        ? String(message.receivedAt)
                        : '—';
                    const isExcluded = excludedIds.has(message.id);
                    const job = jobsById.get(message.id);
                    return (
                      <tr key={message.id} className="border-t border-separator">
                        <td className="px-6 py-4">{date}</td>
                        <td className="px-6 py-4 max-w-[340px] truncate">
                          {message.subject || 'Sans objet'}
                        </td>
                        <td className="px-6 py-4 text-label/70">
                          {job ? (
                            <>
                              <span className="font-semibold">
                                Reparse : {job.status || 'requested'}
                              </span>
                              {job.resultMessage ? (
                                <span className="block text-caption">{job.resultMessage}</span>
                              ) : null}
                            </>
                          ) : (
                            message.lastStatus || '—'
                          )}
                        </td>
                        <td className="px-6 py-4 flex flex-wrap gap-4">
                          {!isExcluded && (
                            <button
                              type="button"
                              onClick={() => requestJob(message.id, message.subject || '')}
                              disabled={actionLoading}
                              className="rounded-lg bg-gold text-bg px-4 py-2 text-caption font-semibold hover:bg-gold-light transition"
                            >
                              Reparser
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              isExcluded
                                ? removeExcluded(message.id)
                                : excludeEmail(message.id, message.subject || '')
                            }
                            disabled={actionLoading}
                            className={`rounded-lg px-4 py-2 text-caption font-semibold transition ${isExcluded ? 'bg-white/5 border border-separator text-label hover:bg-white/10' : 'bg-white/10 text-white hover:bg-white/20'}`}
                          >
                            {isExcluded ? 'Réintégrer' : 'Exclure'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageShell>
  );
};
