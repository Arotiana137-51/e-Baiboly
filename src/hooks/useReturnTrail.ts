import {useCallback, useRef, useState} from 'react';
import {pushReturnSpot, type ReaderSpot} from '../utils/returnTrail';

// The places the reader left by tapping a Bible reference, newest last, so
// the user can step back to the text they were reading.
export const useReturnTrail = () => {
  const [trail, setTrail] = useState<ReaderSpot[]>([]);
  // Mirrors `trail` so `pop` can hand back the spot it removes.
  const trailRef = useRef<ReaderSpot[]>([]);

  const commit = useCallback((next: ReaderSpot[]) => {
    trailRef.current = next;
    setTrail(next);
  }, []);

  const push = useCallback(
    (spot: ReaderSpot) => commit(pushReturnSpot(trailRef.current, spot)),
    [commit],
  );

  const pop = useCallback((): ReaderSpot | null => {
    const current = trailRef.current;
    const top = current[current.length - 1];
    if (!top) return null;
    commit(current.slice(0, -1));
    return top;
  }, [commit]);

  const clear = useCallback(() => commit([]), [commit]);

  return {
    top: trail.length > 0 ? trail[trail.length - 1] : null,
    depth: trail.length,
    push,
    pop,
    clear,
  };
};
