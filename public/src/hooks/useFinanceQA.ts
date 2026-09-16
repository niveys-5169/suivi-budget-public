import { useState, useCallback, useRef } from 'react';
import { useTransactions } from './useTransactions';
import { useBudget } from './useBudget';
import { usePatrimoine } from './usePatrimoine';
import { usePortfolio } from './usePortfolio';
import { readAIConfig } from '../utils/aiConfig';
import {
  buildFinancialSummary,
  buildSystemPrompt,
  tryDirectSpendingAnswer,
  type FinancialSummary,
} from '../utils/financeQAAnalysis';
import { buildWealthSummary } from '../utils/wealthQAAnalysis';
import { callLLM, type ChatMessage } from '../services/llmClient';
import { toast } from '../lib/toast';

/** Résumé financier vide : permet de répondre sur le seul patrimoine, sans transactions. */
const EMPTY_FINANCIAL_SUMMARY: FinancialSummary = {
  resume: { total_transactions: 0, periode: 'inconnue', comptes: [] },
  totaux_par_categorie: {},
  par_mois: {},
  par_annee: {},
  revenus_par_categorie_par_mois: {},
  budgets_par_categorie: {},
  analyse_textuelle: [],
  transactions_detaillees: [],
};

export type { AIProvider } from '../utils/aiConfig';
export type { ChatMessage };

/**
 * Heuristique de troncature : la réponse est suspecte si elle ne finit pas par
 * une ponctuation de fin, si un bloc markdown (gras `**` ou code ```) reste
 * ouvert, ou si elle se termine par un mot de liaison.
 */
export function isAnswerProbablyTruncated(text: string): boolean {
  const t = text.trimEnd();
  if (t.length < 120) return false;
  if (!/[.!?…»)\]"'*)`%€]$/.test(t)) return true;
  if ((t.match(/```/g) ?? []).length % 2 === 1) return true;
  if ((t.match(/\*\*/g) ?? []).length % 2 === 1) return true;
  return /(?:\ble|\bla|\bles|\bde|\bdu|\bdes|\bet|\bou|\bun|\bune|\bpour|\bavec|\bqui|\bque|,)$/i.test(
    t,
  );
}

/** Recolle deux fragments de réponse sans espace si le 1er finit sur un mot coupé. */
function spliceContinuation(first: string, next: string): string {
  const head = first.trimEnd();
  const tail = next.trimStart();
  if (!tail) return head;
  const needsSpace = !/[-–—\s'’]$/.test(head) && !/^[,.;:!?»%€)]/.test(tail);
  return needsSpace ? `${head} ${tail}` : `${head}${tail}`;
}

/** Gère la conversation avec l'assistant IA financier (Gemini/OpenAI/OpenRouter/Nvidia) et l'historique de chat. */
export function useFinanceQA() {
  const { transactions } = useTransactions();
  const { budgets } = useBudget();
  const {
    placements,
    savingsBalances,
    accountBalances,
    placementHistory,
    portfolioValue,
    ownerMapping,
  } = usePatrimoine();
  const { holdings } = usePortfolio();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const historyRef = useRef<ChatMessage[]>([]);

  const send = useCallback(
    async (question: string) => {
      if (!question.trim() || loading) return;
      setMessages((prev) => [...prev, { role: 'user', content: question }]);
      setLoading(true);
      try {
        const config = readAIConfig();

        if (!config.apiKey) throw new Error('Clé API non configurée. Va dans ⚙ pour configurer.');

        const summary = buildFinancialSummary(transactions, budgets);
        const wealth = buildWealthSummary({
          placements,
          savingsBalances,
          accountBalances,
          placementHistory,
          ownerMapping,
          holdings,
          portfolioValue,
        });
        if (!summary && !wealth)
          throw new Error(
            'Aucune donnée disponible. Importe des transactions ou renseigne ton patrimoine.',
          );

        const directAnswer = summary ? tryDirectSpendingAnswer(question, transactions) : null;
        let answer: string;

        if (directAnswer) {
          answer = directAnswer;
        } else {
          const systemPrompt = buildSystemPrompt(summary ?? EMPTY_FINANCIAL_SUMMARY, wealth);
          const recentHistory = historyRef.current.slice(-12);
          answer = await callLLM(config, systemPrompt, question, recentHistory);

          // Garde anti-troncature : une seule relance si la réponse semble
          // coupée en plein milieu (limite de tokens, réseau…). En cas d'échec
          // on garde la réponse d'origine plutôt que de tout perdre.
          if (isAnswerProbablyTruncated(answer)) {
            try {
              const continuation = await callLLM(
                config,
                systemPrompt,
                "Ta réponse précédente a été coupée en plein milieu. Termine-la : reprends la dernière phrase exactement où elle s'est arrêtée, en français, sans rien répéter ni ajouter d'introduction. Réponds en 5 lignes maximum.",
                [
                  ...recentHistory,
                  { role: 'user', content: question },
                  { role: 'assistant', content: answer },
                ],
              );
              answer = spliceContinuation(answer, continuation);
            } catch {
              // On conserve la réponse partielle plutôt que rien.
            }
          }
        }

        const userMsg: ChatMessage = { role: 'user', content: question };
        const assistantMsg: ChatMessage = { role: 'assistant', content: answer };
        historyRef.current = [...historyRef.current, userMsg, assistantMsg].slice(-20);
        setMessages((prev) => {
          const withoutOptimistic = prev.slice(0, -1);
          return [...withoutOptimistic, userMsg, assistantMsg];
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Erreur inconnue';
        toast.error(errorMsg);
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: 'user', content: question },
          { role: 'assistant', content: `⚠ ${errorMsg}` },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [
      loading,
      transactions,
      budgets,
      placements,
      savingsBalances,
      accountBalances,
      placementHistory,
      portfolioValue,
      ownerMapping,
      holdings,
    ],
  );

  const initMessages = useCallback((msgs: ChatMessage[]) => {
    setMessages(msgs);
    historyRef.current = msgs.slice(-20);
  }, []);

  const clearChat = useCallback(() => {
    historyRef.current = [];
    setMessages([]);
  }, []);

  return { messages, loading, send, clearChat, initMessages };
}
