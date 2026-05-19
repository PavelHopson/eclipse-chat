import React, { useState } from 'react';
import ChatShell from './ChatShell';
import AuthScreen from './AuthScreen';
import ErrorScreen from './ErrorScreen';
import { ThemeProvider } from './ThemeContext';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);

  if (fatalError) {
    return <ErrorScreen message={fatalError} onRecover={() => setFatalError(null)} />;
  }

  return (
    <ThemeProvider>
      {!isAuthenticated ? (
        <AuthScreen onLogin={() => setIsAuthenticated(true)} />
      ) : (
        <ChatShell 
          onLogout={() => setIsAuthenticated(false)} 
          onSimulateCrash={() => setFatalError("MEMORY_LEAK_DETECTED")} 
        />
      )}
    </ThemeProvider>
  );
}
