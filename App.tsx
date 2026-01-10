import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/ui/navigation/AppNavigator';
import ErrorBoundary from './src/ui/components/ErrorBoundary';
import { ProjectProvider } from './src/core/ProjectContext';
import PermissionScreen from './src/ui/screens/PermissionScreen';
import { checkStoragePermission } from './src/utils/storagePermissions';
import { initializeContainer } from './src/core/DependencyContainer';
import { Platform, View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import theme from './src/ui/theme';

type AppState = 'checking_permission' | 'no_permission' | 'initializing' | 'ready' | 'error';

export default function App() {
  const [appState, setAppState] = useState<AppState>('checking_permission');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    if (Platform.OS !== 'android') {
      await initializeApp();
      return;
    }

    const granted = await checkStoragePermission();
    if (granted) {
      await initializeApp();
    } else {
      setAppState('no_permission');
    }
  };

  const initializeApp = async () => {
    setAppState('initializing');
    try {
      await initializeContainer();
      setAppState('ready');
    } catch (error) {
      console.error('Failed to initialize app:', error);
      setErrorMessage(String(error));
      setAppState('error');
    }
  };

  const handlePermissionGranted = async () => {
    await checkPermissions();
  };

  if (appState === 'checking_permission' || appState === 'initializing') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.accent.primary} />
        {appState === 'initializing' && (
          <Text style={styles.loadingText}>Setting up storage...</Text>
        )}
      </View>
    );
  }

  if (appState === 'error') {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Failed to initialize app</Text>
        <Text style={styles.errorDetail}>{errorMessage}</Text>
      </View>
    );
  }

  if (appState === 'no_permission') {
    return (
      <ErrorBoundary>
        <PermissionScreen onPermissionGranted={handlePermissionGranted} />
        <StatusBar style="light" />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <ProjectProvider>
        <AppNavigator />
        <StatusBar style="light" />
      </ProjectProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background.primary,
  },
  loadingText: {
    marginTop: 16,
    color: theme.text.secondary,
    fontSize: 14,
  },
  errorText: {
    color: theme.accent.error,
    fontSize: 18,
    fontWeight: '600',
  },
  errorDetail: {
    marginTop: 8,
    color: theme.text.secondary,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
