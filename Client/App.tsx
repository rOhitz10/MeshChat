import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ServerProvider, useServer } from './src/context/ServerContext';
import { ApiClient } from './src/services/apiClient';

interface LogEntry {
  id: string;
  time: string;
  type: 'info' | 'success' | 'error';
  message: string;
}

function MainDashboard() {
  const {
    activeServer,
    setActiveServer,
    activeConfig,
    serverConfigs,
    serverStatuses,
    isCheckingHealth,
    refreshHealth,
    updateServerUrl,
  } = useServer();

  const [activeTab, setActiveTab] = useState<'overview' | 'auth' | 'chat'>('overview');
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: '1',
      time: new Date().toLocaleTimeString(),
      type: 'info',
      message: `Initialized. Default server: ${activeConfig.name}`,
    },
  ]);

  // Auth test inputs
  const [email, setEmail] = useState('user@meshchat.io');
  const [password, setPassword] = useState('password123');
  const [name, setName] = useState('Demo User');
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Chat test inputs
  const [chatMessage, setChatMessage] = useState('Hello from MeshChat frontend!');
  const [chatMessagesList, setChatMessagesList] = useState<string[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsSocket, setWsSocket] = useState<WebSocket | null>(null);

  // URL Editing
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [editedUrl, setEditedUrl] = useState(activeConfig.apiUrl);

  const addLog = (type: 'info' | 'success' | 'error', message: string) => {
    setLogs((prev) => [
      {
        id: Math.random().toString(36).substring(7),
        time: new Date().toLocaleTimeString(),
        type,
        message,
      },
      ...prev.slice(0, 49),
    ]);
  };

  const currentStatus = serverStatuses[activeServer];

  // Quick Registration Test
  const handleTestRegister = async () => {
    setAuthLoading(true);
    addLog('info', `[${activeConfig.name}] Testing Registration for ${email}...`);
    try {
      const res = await ApiClient.register(activeConfig.apiUrl, { name, email, password });
      setAuthToken(res.access_token);
      addLog('success', `User registered! Token issued for ID: ${res.userId}`);
    } catch (err: any) {
      addLog('error', `Registration failed: ${err.message}`);
    } finally {
      setAuthLoading(false);
    }
  };

  // Quick Login Test
  const handleTestLogin = async () => {
    setAuthLoading(true);
    addLog('info', `[${activeConfig.name}] Testing Login for ${email}...`);
    try {
      const res = await ApiClient.login(activeConfig.apiUrl, { email, password });
      setAuthToken(res.access_token);
      addLog('success', `Login successful! Welcome ${res.username} (Token stored)`);
    } catch (err: any) {
      addLog('error', `Login failed: ${err.message}`);
    } finally {
      setAuthLoading(false);
    }
  };

  // WebSocket connection test (Server 2)
  const handleToggleWebSocket = () => {
    if (wsConnected && wsSocket) {
      wsSocket.close();
      setWsSocket(null);
      setWsConnected(false);
      addLog('info', 'WebSocket closed manually.');
      return;
    }

    if (!activeConfig.wsUrl) {
      addLog('error', 'Active server does not support WebSocket.');
      return;
    }

    const tokenParam = authToken ? `?token=${encodeURIComponent(authToken)}` : '';
    const wsUrl = `${activeConfig.wsUrl}${tokenParam}`;
    addLog('info', `Connecting to WebSocket: ${wsUrl}...`);

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setWsConnected(true);
        addLog('success', 'WebSocket connected successfully to Server 2!');
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          addLog('info', `[WS Event] ${parsed.event}: ${JSON.stringify(parsed.data || parsed)}`);
          if (parsed.event === 'new_message' && parsed.data?.content) {
            setChatMessagesList((prev) => [...prev, `${parsed.data.sender_name}: ${parsed.data.content}`]);
          }
        } catch {
          addLog('info', `[WS Raw] ${event.data}`);
        }
      };

      ws.onerror = (e: any) => {
        addLog('error', `WebSocket Error: ${e.message || 'Connection failed'}`);
      };

      ws.onclose = () => {
        setWsConnected(false);
        setWsSocket(null);
        addLog('info', 'WebSocket disconnected.');
      };

      setWsSocket(ws);
    } catch (err: any) {
      addLog('error', `Could not initiate WebSocket: ${err.message}`);
    }
  };

  const handleSendWsMessage = () => {
    if (!wsSocket || !wsConnected) {
      addLog('error', 'WebSocket is not connected. Connect first.');
      return;
    }

    const payload = {
      event: 'ping',
      timestamp: Date.now(),
    };
    wsSocket.send(JSON.stringify(payload));
    addLog('info', 'Sent WS ping packet.');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <View style={styles.badgeRow}>
            <View style={styles.topPill}>
              <Text style={styles.topPillText}>MeshChat Multi-Backend Hub</Text>
            </View>
          </View>
          <Text style={styles.appTitle}>MeshChat</Text>
          <Text style={styles.appSubtitle}>Switch between NestJS (Server 1) & FastAPI (Server 2)</Text>
        </View>

        {/* Server Selector Segmented Control */}
        <View style={styles.selectorCard}>
          <Text style={styles.sectionLabel}>SELECT ACTIVE BACKEND</Text>
          <View style={styles.tabBar}>
            {/* Server 1 Button */}
            <TouchableOpacity
              style={[
                styles.serverButton,
                activeServer === 'server1' && styles.serverButtonActive,
              ]}
              onPress={() => {
                setActiveServer('server1');
                setEditedUrl(serverConfigs.server1.apiUrl);
                addLog('info', 'Switched active backend to Server 1 (NestJS)');
              }}
            >
              <View style={styles.serverButtonHeader}>
                <View
                  style={[
                    styles.statusDot,
                    serverStatuses.server1.status === 'online'
                      ? styles.statusDotGreen
                      : serverStatuses.server1.status === 'checking'
                      ? styles.statusDotYellow
                      : styles.statusDotRed,
                  ]}
                />
                <Text
                  style={[
                    styles.serverButtonTitle,
                    activeServer === 'server1' && styles.serverButtonTitleActive,
                  ]}
                >
                  Server 1
                </Text>
              </View>
              <Text style={styles.serverButtonSub}>NestJS (:3000)</Text>
              {serverStatuses.server1.latencyMs !== undefined && (
                <Text style={styles.latencyText}>
                  {serverStatuses.server1.status === 'online'
                    ? `${serverStatuses.server1.latencyMs}ms`
                    : 'Offline'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Server 2 Button */}
            <TouchableOpacity
              style={[
                styles.serverButton,
                activeServer === 'server2' && styles.serverButtonActive,
              ]}
              onPress={() => {
                setActiveServer('server2');
                setEditedUrl(serverConfigs.server2.apiUrl);
                addLog('info', 'Switched active backend to Server 2 (FastAPI)');
              }}
            >
              <View style={styles.serverButtonHeader}>
                <View
                  style={[
                    styles.statusDot,
                    serverStatuses.server2.status === 'online'
                      ? styles.statusDotGreen
                      : serverStatuses.server2.status === 'checking'
                      ? styles.statusDotYellow
                      : styles.statusDotRed,
                  ]}
                />
                <Text
                  style={[
                    styles.serverButtonTitle,
                    activeServer === 'server2' && styles.serverButtonTitleActive,
                  ]}
                >
                  Server 2
                </Text>
              </View>
              <Text style={styles.serverButtonSub}>FastAPI (:8000)</Text>
              {serverStatuses.server2.latencyMs !== undefined && (
                <Text style={styles.latencyText}>
                  {serverStatuses.server2.status === 'online'
                    ? `${serverStatuses.server2.latencyMs}ms`
                    : 'Offline'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Server Diagnostic Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>{activeConfig.name}</Text>
              <Text style={styles.cardFramework}>{activeConfig.framework}</Text>
            </View>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={refreshHealth}
              disabled={isCheckingHealth}
            >
              {isCheckingHealth ? (
                <ActivityIndicator size="small" color="#6366F1" />
              ) : (
                <Text style={styles.refreshButtonText}>Ping</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.cardDesc}>{activeConfig.description}</Text>

          {/* URL & Endpoint Info */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>HTTP API Base:</Text>
            {isEditingUrl ? (
              <View style={styles.urlEditRow}>
                <TextInput
                  style={styles.urlInput}
                  value={editedUrl}
                  onChangeText={setEditedUrl}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.urlSaveBtn}
                  onPress={() => {
                    updateServerUrl(activeServer, editedUrl);
                    setIsEditingUrl(false);
                    addLog('info', `Updated ${activeConfig.name} URL to ${editedUrl}`);
                  }}
                >
                  <Text style={styles.urlSaveBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.urlDisplayRow}>
                <Text style={styles.infoValue}>{activeConfig.apiUrl}</Text>
                <TouchableOpacity onPress={() => setIsEditingUrl(true)}>
                  <Text style={styles.editLink}>Edit</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {activeConfig.wsUrl && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>WebSocket URL:</Text>
              <Text style={styles.infoValue}>{activeConfig.wsUrl}</Text>
            </View>
          )}

          <View style={styles.statusBadgeRow}>
            <View
              style={[
                styles.statusPill,
                currentStatus.status === 'online'
                  ? styles.statusPillGreen
                  : currentStatus.status === 'checking'
                  ? styles.statusPillYellow
                  : styles.statusPillRed,
              ]}
            >
              <Text style={styles.statusPillText}>
                {currentStatus.status === 'online'
                  ? `ONLINE (${currentStatus.latencyMs}ms)`
                  : currentStatus.status === 'checking'
                  ? 'CHECKING...'
                  : 'OFFLINE / NOT RUNNING'}
              </Text>
            </View>
            <View style={styles.portPill}>
              <Text style={styles.portPillText}>Port {activeConfig.defaultPort}</Text>
            </View>
          </View>

          {/* Features pills */}
          <View style={styles.featuresContainer}>
            {activeConfig.features.map((feat, idx) => (
              <View key={idx} style={styles.featPill}>
                <Text style={styles.featPillText}>{feat}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Feature Navigation Tabs */}
        <View style={styles.featureTabs}>
          <TouchableOpacity
            style={[styles.featureTabBtn, activeTab === 'overview' && styles.featureTabBtnActive]}
            onPress={() => setActiveTab('overview')}
          >
            <Text
              style={[
                styles.featureTabBtnText,
                activeTab === 'overview' && styles.featureTabBtnTextActive,
              ]}
            >
              Diagnostic
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.featureTabBtn, activeTab === 'auth' && styles.featureTabBtnActive]}
            onPress={() => setActiveTab('auth')}
          >
            <Text
              style={[
                styles.featureTabBtnText,
                activeTab === 'auth' && styles.featureTabBtnTextActive,
              ]}
            >
              Auth Test
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.featureTabBtn, activeTab === 'chat' && styles.featureTabBtnActive]}
            onPress={() => setActiveTab('chat')}
          >
            <Text
              style={[
                styles.featureTabBtnText,
                activeTab === 'chat' && styles.featureTabBtnTextActive,
              ]}
            >
              Chat & WS Test
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab 1: Diagnostic */}
        {activeTab === 'overview' && (
          <View style={styles.card}>
            <Text style={styles.subCardTitle}>Quick Connectivity Verification</Text>
            <Text style={styles.helperText}>
              Verify that the frontend can successfully communicate with {activeConfig.name}.
            </Text>
            <View style={styles.buttonGroup}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={async () => {
                  addLog('info', `Testing health ping to ${activeConfig.apiUrl}...`);
                  const res = await ApiClient.checkHealth(activeConfig.apiUrl);
                  if (res.status === 'online') {
                    addLog('success', `Health response OK (${res.latencyMs}ms): ${JSON.stringify(res.serverInfo)}`);
                  } else {
                    addLog('error', `Server unreachable: ${res.error}`);
                  }
                }}
              >
                <Text style={styles.primaryButtonText}>Ping Current Server</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Tab 2: Auth Flow Test */}
        {activeTab === 'auth' && (
          <View style={styles.card}>
            <Text style={styles.subCardTitle}>Cross-Compatible Auth Tester</Text>
            <Text style={styles.helperText}>
              Both Server 1 and Server 2 support the identical `/auth/register` and `/auth/login` contract.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Name"
              placeholderTextColor="#6B7280"
              value={name}
              onChangeText={setName}
            />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#6B7280"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#6B7280"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnSecondary]}
                onPress={handleTestRegister}
                disabled={authLoading}
              >
                <Text style={styles.actionBtnText}>Register</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnPrimary]}
                onPress={handleTestLogin}
                disabled={authLoading}
              >
                <Text style={styles.actionBtnText}>Login</Text>
              </TouchableOpacity>
            </View>

            {authToken && (
              <View style={styles.tokenBox}>
                <Text style={styles.tokenBoxLabel}>Active JWT Token:</Text>
                <Text style={styles.tokenBoxText} numberOfLines={2}>
                  {authToken}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Tab 3: Chat & WS Test */}
        {activeTab === 'chat' && (
          <View style={styles.card}>
            <Text style={styles.subCardTitle}>Real-Time WebSocket Tester (Server 2)</Text>
            <Text style={styles.helperText}>
              Test bidirectional live messaging and heartbeat ping on FastAPI.
            </Text>

            <View style={styles.wsControlRow}>
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  wsConnected ? styles.actionBtnDanger : styles.actionBtnPrimary,
                ]}
                onPress={handleToggleWebSocket}
              >
                <Text style={styles.actionBtnText}>
                  {wsConnected ? 'Disconnect WS' : 'Connect WebSocket'}
                </Text>
              </TouchableOpacity>

              {wsConnected && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnSecondary]}
                  onPress={handleSendWsMessage}
                >
                  <Text style={styles.actionBtnText}>Ping WS</Text>
                </TouchableOpacity>
              )}
            </View>

            {chatMessagesList.length > 0 && (
              <View style={styles.messagesBox}>
                <Text style={styles.tokenBoxLabel}>Live Incoming Messages:</Text>
                {chatMessagesList.map((m, i) => (
                  <Text key={i} style={styles.msgItem}>
                    • {m}
                  </Text>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Logs Console */}
        <View style={styles.logCard}>
          <View style={styles.logHeader}>
            <Text style={styles.logTitle}>Activity & Response Log</Text>
            <TouchableOpacity onPress={() => setLogs([])}>
              <Text style={styles.clearLogsText}>Clear</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.logContainer}>
            {logs.map((log) => (
              <View key={log.id} style={styles.logRow}>
                <Text style={styles.logTime}>{log.time}</Text>
                <Text
                  style={[
                    styles.logMsg,
                    log.type === 'success'
                      ? styles.logMsgSuccess
                      : log.type === 'error'
                      ? styles.logMsgError
                      : styles.logMsgInfo,
                  ]}
                >
                  {log.message}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <ServerProvider>
      <MainDashboard />
    </ServerProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginTop: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  badgeRow: {
    marginBottom: 8,
  },
  topPill: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  topPillText: {
    color: '#818CF8',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.5,
  },
  appSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
  },
  selectorCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 1,
    marginBottom: 10,
  },
  tabBar: {
    flexDirection: 'row',
    gap: 10,
  },
  serverButton: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: '#334155',
  },
  serverButtonActive: {
    borderColor: '#6366F1',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  serverButtonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotGreen: {
    backgroundColor: '#10B981',
  },
  statusDotYellow: {
    backgroundColor: '#F59E0B',
  },
  statusDotRed: {
    backgroundColor: '#EF4444',
  },
  serverButtonTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94A3B8',
  },
  serverButtonTitleActive: {
    color: '#F8FAFC',
  },
  serverButtonSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  latencyText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#38BDF8',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  cardFramework: {
    fontSize: 12,
    color: '#818CF8',
    fontWeight: '600',
  },
  refreshButton: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '600',
  },
  cardDesc: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
    marginBottom: 14,
    lineHeight: 18,
  },
  infoRow: {
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 13,
    color: '#E2E8F0',
    fontFamily: 'monospace',
  },
  urlDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editLink: {
    color: '#818CF8',
    fontSize: 12,
    fontWeight: '600',
  },
  urlEditRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  urlInput: {
    flex: 1,
    backgroundColor: '#0F172A',
    color: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
    fontSize: 13,
    fontFamily: 'monospace',
  },
  urlSaveBtn: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRadius: 8,
  },
  urlSaveBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
  statusBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    marginBottom: 12,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusPillGreen: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  statusPillYellow: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  statusPillRed: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
  },
  portPill: {
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  portPillText: {
    fontSize: 11,
    color: '#CBD5E1',
    fontWeight: '600',
  },
  featuresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  featPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  featPillText: {
    color: '#94A3B8',
    fontSize: 11,
  },
  featureTabs: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  featureTabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  featureTabBtnActive: {
    backgroundColor: '#6366F1',
  },
  featureTabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  featureTabBtnTextActive: {
    color: '#FFFFFF',
  },
  subCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  helperText: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 12,
  },
  buttonGroup: {
    marginTop: 4,
  },
  primaryButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  input: {
    backgroundColor: '#0F172A',
    color: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
    fontSize: 13,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionBtnPrimary: {
    backgroundColor: '#6366F1',
  },
  actionBtnSecondary: {
    backgroundColor: '#334155',
  },
  actionBtnDanger: {
    backgroundColor: '#EF4444',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  tokenBox: {
    backgroundColor: '#0F172A',
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  tokenBoxLabel: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '700',
    marginBottom: 4,
  },
  tokenBoxText: {
    fontSize: 10,
    color: '#94A3B8',
    fontFamily: 'monospace',
  },
  wsControlRow: {
    flexDirection: 'row',
    gap: 10,
  },
  messagesBox: {
    backgroundColor: '#0F172A',
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  msgItem: {
    color: '#E2E8F0',
    fontSize: 12,
    marginTop: 2,
  },
  logCard: {
    backgroundColor: '#0B1120',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  logTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  clearLogsText: {
    fontSize: 11,
    color: '#818CF8',
  },
  logContainer: {
    maxHeight: 180,
  },
  logRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  logTime: {
    fontSize: 11,
    color: '#475569',
    fontFamily: 'monospace',
  },
  logMsg: {
    fontSize: 11,
    flex: 1,
  },
  logMsgInfo: {
    color: '#94A3B8',
  },
  logMsgSuccess: {
    color: '#34D399',
  },
  logMsgError: {
    color: '#F87171',
  },
});
