export type ServerType = 'server1' | 'server2';

export interface ServerConfig {
  id: ServerType;
  name: string;
  framework: string;
  badge: string;
  defaultPort: number;
  apiUrl: string;
  wsUrl?: string;
  description: string;
  features: string[];
}

export const DEFAULT_SERVERS: Record<ServerType, ServerConfig> = {
  server1: {
    id: 'server1',
    name: 'Server 1 (NestJS)',
    framework: 'NestJS / TypeScript',
    badge: 'NestJS :3000',
    defaultPort: 3000,
    apiUrl: process.env.EXPO_PUBLIC_SERVER1_API_URL || 'http://localhost:3000',
    description: 'Enterprise TypeScript backend using NestJS and Mongoose',
    features: ['JWT Authentication', 'Mongoose MongoDB', 'Swagger Docs @ /api'],
  },
  server2: {
    id: 'server2',
    name: 'Server 2 (FastAPI)',
    framework: 'FastAPI / Python',
    badge: 'FastAPI :8000',
    defaultPort: 8000,
    apiUrl: process.env.EXPO_PUBLIC_SERVER2_API_URL || 'http://localhost:8000',
    wsUrl: process.env.EXPO_PUBLIC_SERVER2_WS_URL || 'ws://localhost:8000/ws',
    description: 'High-performance async Python backend with real-time WebSockets',
    features: ['Async Motor MongoDB', 'Real-Time WebSockets', 'FastAPI OpenAPI @ /docs', 'Cross-Compatible Auth'],
  },
};

export const INITIAL_SERVER: ServerType =
  (process.env.EXPO_PUBLIC_DEFAULT_SERVER as ServerType) || 'server2';
