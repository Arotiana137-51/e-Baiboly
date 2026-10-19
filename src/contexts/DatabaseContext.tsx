// src/contexts/DatabaseContext.tsx
import React, {createContext, useContext, useEffect, useState} from 'react';
import { bibleDatabaseService, hymnsDatabaseService } from '../services/database/DatabaseService';
import { patchManager } from '../services/database/PatchManager';
import { recordFatalError } from '../services/reporting/crashReporter';

type DatabaseContextType = {
  isInitialized: boolean;
};

const DatabaseContext = createContext<DatabaseContextType>({
  isInitialized: false,
});

export const DatabaseProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const [isInitialized, setIsInitialized] = useState(false);

  const initializeDatabase = async () => {
    try {
      await Promise.all([
        bibleDatabaseService.initDatabase(),
        hymnsDatabaseService.initDatabase(),
      ]);
      // Mark ready BEFORE patches: the OTA channel must never block the UI.
      // PatchManager swallows its own errors, so this `await` is safe; we
      // still keep the call inside the try in case its module load fails.
      setIsInitialized(true);
      if (__DEV__) {
        console.log('Database initialized successfully');
      }
      // Fire-and-forget: patches apply in the background while the user
      // is already reading. Next launch picks up anything that finishes
      // mid-session.
      patchManager.checkAndApply();
    } catch (error) {
      console.error('Failed to initialize database:', error);
      // Persist the real failure for diagnostics, then unblock the UI. Leaving
      // isInitialized false here would trap the app on the splash screen
      // forever; instead we let the app mount so downstream screens can fail
      // loudly (and be caught by the top-level ErrorBoundary) rather than hang.
      recordFatalError(error, 'global', 'DatabaseProvider.initializeDatabase');
      setIsInitialized(true);
    }
  };

  useEffect(() => {
    initializeDatabase();
  }, []);

  return (
    <DatabaseContext.Provider
      value={{isInitialized}}>
      {children}
    </DatabaseContext.Provider>
  );
};

export const useDatabase = () => useContext(DatabaseContext);
