import React from 'react';
import { motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import { Check, Undo2 } from 'lucide-react';
import { useHaptics } from '../../hooks/useHaptics';

/** Distance horizontale (px) au-delà de laquelle le geste déclenche le pointage. */
export const SWIPE_THRESHOLD = 80;
/** Durée de maintien (ms) déclenchant l'appui long. */
export const LONG_PRESS_MS = 500;
/** Mouvement (px) au-delà duquel un appui long est annulé (c'est un swipe/scroll). */
const MOVE_CANCEL_PX = 10;

/**
 * Décide de l'état `pointe` cible d'un swipe, ou `null` si le geste ne change
 * rien (glissement trop court, ou déjà dans l'état visé). Fonction pure —
 * testable hors jsdom, indépendamment du drag framer-motion.
 *
 * @param dx      Déplacement horizontal final (droite positif).
 * @param pointed État de pointage courant.
 * @returns Le prochain booléen `pointe`, ou `null` pour ne rien faire.
 */
export const resolveSwipeAction = (dx: number, pointed: boolean): boolean | null => {
  if (dx > SWIPE_THRESHOLD) return pointed ? null : true;
  if (dx < -SWIPE_THRESHOLD) return pointed ? false : null;
  return null;
};

type MSwipeToPointProps = {
  id: string;
  pointed: boolean;
  onTogglePointe: (id: string, pointe: boolean) => void;
  children: React.ReactNode;
};

/**
 * Enveloppe une ligne de transaction pour la pointer/dépointer en PWA, via deux
 * gestes complémentaires :
 *  - swipe : glisser à droite pointe, à gauche dépointe (retour élastique) ;
 *  - appui long : maintenir bascule le pointage.
 * `dragDirectionLock` préserve le scroll vertical, et le démarrage hors zone de
 * bord évite tout conflit avec la navigation par swipe de bord. Après un appui
 * long, le clic est neutralisé pour ne pas ouvrir aussi la modale d'édition.
 */
export const MSwipeToPoint: React.FC<MSwipeToPointProps> = ({
  id,
  pointed,
  onTogglePointe,
  children,
}) => {
  const { success, snap } = useHaptics();
  const x = useMotionValue(0);
  const pointOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const unpointOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);

  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = React.useRef(false);
  const startRef = React.useRef<{ x: number; y: number } | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };
  React.useEffect(() => clearTimer, []);

  const handleDragEnd = (_e: unknown, info: PanInfo) => {
    const next = resolveSwipeAction(info.offset.x, pointed);
    if (next === null) {
      snap();
      return;
    }
    success();
    onTogglePointe(id, next);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    startRef.current = { x: e.clientX, y: e.clientY };
    longPressFiredRef.current = false;
    clearTimer();
    timerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      success();
      onTogglePointe(id, !pointed);
    }, LONG_PRESS_MS);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const start = startRef.current;
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > MOVE_CANCEL_PX) {
      clearTimer();
    }
  };

  // Neutralise le clic qui suit un appui long (sinon la modale s'ouvrirait).
  const handleClickCapture = (e: React.MouseEvent) => {
    if (longPressFiredRef.current) {
      e.stopPropagation();
      e.preventDefault();
      longPressFiredRef.current = false;
    }
  };

  return (
    <div className="relative overflow-hidden">
      {/* Fond révélé au glissement droit → pointer */}
      <motion.div
        style={{ opacity: pointOpacity }}
        className="absolute inset-y-0 left-0 w-32 flex items-center gap-2 px-6 bg-positive/15 text-positive"
        aria-hidden="true"
      >
        <Check size={20} />
        <span className="text-footnote font-semibold">Pointer</span>
      </motion.div>
      {/* Fond révélé au glissement gauche → dépointer */}
      <motion.div
        style={{ opacity: unpointOpacity }}
        className="absolute inset-y-0 right-0 w-32 flex items-center justify-end gap-2 px-6 bg-raised text-label-secondary"
        aria-hidden="true"
      >
        <span className="text-footnote font-semibold">Dépointer</span>
        <Undo2 size={20} />
      </motion.div>

      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.5}
        style={{ x, touchAction: 'pan-y' }}
        onDragEnd={handleDragEnd}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={clearTimer}
        onPointerLeave={clearTimer}
        onPointerCancel={clearTimer}
        onClickCapture={handleClickCapture}
        className="relative bg-bg"
      >
        {children}
      </motion.div>
    </div>
  );
};
