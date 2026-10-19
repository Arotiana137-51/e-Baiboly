import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import {View} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getTutorial,
  ONBOARDING_ID,
  type CoachStep,
  type DriveVerb,
  type TargetId,
  type Tutorial,
} from '../tutorials/registry';
import {APP_VERSION} from '../services/appVersion';

// Persistence — same try/catch idiom as utils/primaryColorStorage.ts.
const ONBOARDING_DONE_KEY = '@onboarding_done';
const statusKey = (id: string) => `@tutorial_status:${id}`;

export type TutorialStatus = 'available' | 'done';

// A measured rectangle in window coordinates, or null while unmeasured.

// The engine asks the host app to perform a real side-effect (open a modal,
// switch mode). MainScreen registers a single handler; the engine calls it.
export type DriveHandler = (verb: DriveVerb) => void;

type TutorialContextValue = {
  activeTutorial: Tutorial | null;
  step: CoachStep | null;
  stepIndex: number;
  stepCount: number;
  // target registration — components call useTutorialTarget(id) instead.
  registerTarget: (id: TargetId, ref: React.RefObject<View | null>) => void;
  unregisterTarget: (id: TargetId) => void;
  // drive handler registration (MainScreen).
  setDriveHandler: (h: DriveHandler | null) => void;
  // lifecycle
  start: (tutorialId: string) => void;
  next: () => void;
  skip: () => void;
  // called by real UI (BibleSelectionModal.onProgressChange etc.) so a
  // 'targetEvent' step advances when the genuine control reaches its milestone.
  notifyProgress: (key: string) => void;
  // status for the quest log
  getStatus: (id: string) => Promise<TutorialStatus>;
};

const TutorialContext = createContext<TutorialContextValue | null>(null);

export const TutorialProvider = ({children}: {children: React.ReactNode}) => {
  const targets = useRef(new Map<TargetId, React.RefObject<View | null>>());
  const driveHandler = useRef<DriveHandler | null>(null);

  const [activeTutorial, setActiveTutorial] = useState<Tutorial | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  // Mirror active state in refs so next()/notifyProgress() read fresh values
  // without depending on the state (which would churn every callback identity).
  const activeRef = useRef<Tutorial | null>(null);
  const indexRef = useRef(0);
  activeRef.current = activeTutorial;
  indexRef.current = stepIndex;

  const step = activeTutorial ? activeTutorial.steps[stepIndex] ?? null : null;

  const registerTarget = useCallback(
    (id: TargetId, ref: React.RefObject<View | null>) => {
      targets.current.set(id, ref);
    },
    [],
  );
  const unregisterTarget = useCallback((id: TargetId) => {
    targets.current.delete(id);
  }, []);

  const setDriveHandler = useCallback((h: DriveHandler | null) => {
    driveHandler.current = h;
  }, []);

  // Run a step's drive verb (if any) against the host handler.
  const runDrive = useCallback((s: CoachStep | null) => {
    if (s?.drive && driveHandler.current) {
      driveHandler.current(s.drive);
    }
  }, []);

  const finish = useCallback(async (tutorialId: string) => {
    setActiveTutorial(null);
    setStepIndex(0);
    try {
      await AsyncStorage.multiSet([
        [statusKey(tutorialId), 'done'],
        // Stamp the version that completed onboarding; a later version bump
        // makes this stale so the flow replays once on the new release.
        ...(tutorialId === ONBOARDING_ID ? [[ONBOARDING_DONE_KEY, APP_VERSION] as [string, string]] : []),
      ]);
    } catch {
      // ignore persistence errors
    }
  }, []);

  const start = useCallback(
    (tutorialId: string) => {
      const tu = getTutorial(tutorialId);
      if (!tu || tu.steps.length === 0) return;
      setActiveTutorial(tu);
      setStepIndex(0);
      runDrive(tu.steps[0]);
    },
    [runDrive],
  );

  const next = useCallback(() => {
    const current = activeRef.current;
    if (!current) return;
    const nextIndex = indexRef.current + 1;
    if (nextIndex >= current.steps.length) {
      finish(current.id);
      return;
    }
    setStepIndex(nextIndex);
    runDrive(current.steps[nextIndex]);
  }, [finish, runDrive]);

  const skip = useCallback(() => {
    if (activeTutorial) finish(activeTutorial.id);
  }, [activeTutorial, finish]);

  // The genuine control reached a milestone. If the current step waits for it,
  // advance. 'open' is emitted by MainScreen when the driven modal shows.
  const notifyProgress = useCallback(
    (key: string) => {
      const current = activeRef.current;
      const s = current ? current.steps[indexRef.current] : null;
      if (!current || !s || s.advanceOn !== 'targetEvent') return;
      // A forking step (e.g. modeToggle): this progress key picks which
      // steps come next, replacing everything after this one so the
      // immediately-following steps always match what the user just did.
      const branch = s.branches?.[key];
      if (branch) {
        const idx = indexRef.current;
        const newSteps = [...current.steps.slice(0, idx + 1), ...branch];
        setActiveTutorial({...current, steps: newSteps});
        setStepIndex(idx + 1);
        runDrive(newSteps[idx + 1]);
        return;
      }
      if (s.awaitProgress && s.awaitProgress !== key) return;
      next();
    },
    [next, runDrive],
  );

  const getStatus = useCallback(async (id: string): Promise<TutorialStatus> => {
    try {
      const v = await AsyncStorage.getItem(statusKey(id));
      return v === 'done' ? 'done' : 'available';
    } catch {
      return 'available';
    }
  }, []);

  const value = useMemo<TutorialContextValue>(
    () => ({
      activeTutorial,
      step,
      stepIndex,
      stepCount: activeTutorial?.steps.length ?? 0,
      registerTarget,
      unregisterTarget,
      setDriveHandler,
      start,
      next,
      skip,
      notifyProgress,
      getStatus,
      // exposed for the overlay to measure the active target
      _targets: targets,
    }),
    [
      activeTutorial,
      step,
      stepIndex,
      registerTarget,
      unregisterTarget,
      setDriveHandler,
      start,
      next,
      skip,
      notifyProgress,
      getStatus,
    ],
  ) as TutorialContextValue & {_targets: typeof targets};

  return <TutorialContext.Provider value={value}>{children}</TutorialContext.Provider>;
};

export const useTutorial = (): TutorialContextValue => {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error('useTutorial must be used within TutorialProvider');
  return ctx;
};

// Overlay-only accessor for the raw target ref map (measurement).
export const useTutorialTargets = () => {
  const ctx = useContext(TutorialContext) as
    | (TutorialContextValue & {_targets: React.MutableRefObject<Map<TargetId, React.RefObject<View | null>>>})
    | null;
  if (!ctx) throw new Error('useTutorialTargets must be used within TutorialProvider');
  return ctx._targets;
};

// Component-side hook: attach the returned ref to a spotlightable View.
// `collapsable={false}` is required on Android or the View won't measure.
export const useTutorialTarget = (id: TargetId) => {
  const ref = useRef<View | null>(null);
  const {registerTarget, unregisterTarget} = useTutorial();
  React.useEffect(() => {
    registerTarget(id, ref);
    return () => unregisterTarget(id);
  }, [id, registerTarget, unregisterTarget]);
  return ref;
};

// Onboarding is "done" only if it was completed on the CURRENT app version.
// First install (no value) and first launch after a version bump (stale value)
// both return false, so the flow replays exactly once per release. Accepts the
// legacy 'true' marker as done for the current version, so users mid-upgrade
// from the old scheme don't get onboarding re-shown on this same version.
export const isOnboardingDone = async (): Promise<boolean> => {
  try {
    const v = await AsyncStorage.getItem(ONBOARDING_DONE_KEY);
    return v === APP_VERSION || v === 'true';
  } catch {
    return false;
  }
};

// Marks a tutorial done WITHOUT running it — same persistence as finish()
// above. Used when the user tells the "already know the app?" prompt yes, so
// neither the main onboarding tutorial nor a chained one (e.g. Fotoam-
// pivavahana) auto-starts.
export const markTutorialDone = async (tutorialId: string): Promise<void> => {
  try {
    await AsyncStorage.multiSet([
      [statusKey(tutorialId), 'done'],
      ...(tutorialId === ONBOARDING_ID
        ? [[ONBOARDING_DONE_KEY, APP_VERSION] as [string, string]]
        : []),
    ]);
  } catch {
    // ignore persistence errors
  }
};
