import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  DEFAULT_SERVERS,
  INITIAL_SERVER,
  ServerConfig,
  ServerType,
} from '../config/serverConfig';
import { ApiClient, HealthCheckResult } from '../services/apiClient';

interface ServerContextType {
  activeServer: ServerType;
  setActiveServer: (server: ServerType) => void;
  activeConfig: ServerConfig;
  serverConfigs: Record<ServerType, ServerConfig>;
  updateServerUrl: (server: ServerType, newUrl: string) => void;
  serverStatuses: Record<ServerType, HealthCheckResult>;
  isCheckingHealth: boolean;
  refreshHealth: () => Promise<void>;
}

const ServerContext = createContext<ServerContextType | undefined>(undefined);

export const ServerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeServer, setActiveServer] = useState<ServerType>(INITIAL_SERVER);
  const [serverConfigs, setServerConfigs] = useState<Record<ServerType, ServerConfig>>(DEFAULT_SERVERS);
  const [serverStatuses, setServerStatuses] = useState<Record<ServerType, HealthCheckResult>>({
    server1: { status: 'checking' },
    server2: { status: 'checking' },
  });
  const [isCheckingHealth, setIsCheckingHealth] = useState<boolean>(false);

  const activeConfig = serverConfigs[activeServer];

  const updateServerUrl = (server: ServerType, newUrl: string) => {
    setServerConfigs((prev) => ({
      ...prev,
      [server]: {
        ...prev[server],
        apiUrl: newUrl,
        ...(server === 'server2' && {
          wsUrl: newUrl.replace(/^http/, 'ws').replace(/\/+$/, '') + '/ws',
        }),
      },
    }));
  };

  const refreshHealth = async () => {
    setIsCheckingHealth(true);
    try {
      const [status1, status2] = await Promise.all([
        ApiClient.checkHealth(serverConfigs.server1.apiUrl),
        ApiClient.checkHealth(serverConfigs.server2.apiUrl),
      ]);
      setServerStatuses({
        server1: status1,
        server2: status2,
      });
    } finally {
      setIsCheckingHealth(false);
    }
  };

  useEffect(() => {
    refreshHealth();
  }, [serverConfigs.server1.apiUrl, serverConfigs.server2.apiUrl]);

  return (
    <ServerContext.Provider
      value={{
        activeServer,
        setActiveServer,
        activeConfig,
        serverConfigs,
        updateServerUrl,
        serverStatuses,
        isCheckingHealth,
        refreshHealth,
      }}
    >
      {children}
    </ServerContext.Provider>
  );
};

export const useServer = (): ServerContextType => {
  const context = useContext(ServerContext);
  if (!context) {
    throw new Error('useServer must be used within a ServerProvider');
  }
  return context;
};
