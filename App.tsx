import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/ui/navigation/AppNavigator';
import ErrorBoundary from './src/ui/components/ErrorBoundary';
import { ProjectProvider } from './src/core/ProjectContext';
import PermissionScreen from './src/ui/screens/PermissionScreen';
import { checkStoragePermission } from './src/utils/storagePermissions';
import { initializeContainer, setInitializationProgressCallback } from './src/core/DependencyContainer';
import { Platform, View, ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import theme from './src/ui/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

type AppState = 'checking_permission' | 'no_permission' | 'initializing' | 'ready' | 'error';

export default function App() {
  const [appState, setAppState] = useState<AppState>('checking_permission');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [initStep, setInitStep] = useState<string>('Setting up storage...');

  useEffect(() => {
    setInitializationProgressCallback((step: string) => {
      setInitStep(step);
    });
    
    checkPermissions();

    return () => {
      setInitializationProgressCallback(null);
    };
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
    setInitStep('Setting up storage...');
    try {
      await initializeContainer();
      setAppState('ready');
    } catch (error) {
      console.error('Failed to initialize app:', error);
      setErrorMessage(String(error));
      setAppState('error');
    }
  };

  const handleRetry = async () => {
    setErrorMessage('');
    await initializeApp();
  };

  const handleResetStorage = async () => {
    try {
      setInitStep('Resetting storage configuration...');
      await AsyncStorage.clear();
      console.log('AsyncStorage cleared');
      setErrorMessage('');
      await initializeApp();
    } catch (error) {
      console.error('Failed to reset storage:', error);
      setErrorMessage(`Failed to reset storage: ${error}`);
    }
  };

  const handlePermissionGranted = async () => {
    await checkPermissions();
  };

  if (appState === 'checking_permission' || appState === 'initializing') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.accent.primary} />
        <Text style={styles.loadingText}>{initStep}</Text>
      </View>
    );
  }

  if (appState === 'error') {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Failed to initialize app</Text>
        <Text style={styles.errorDetail}>{errorMessage}</Text>
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.button} onPress={handleRetry}>
            <Text style={styles.buttonText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.button, styles.buttonSecondary]} 
            onPress={handleResetStorage}
          >
            <Text style={styles.buttonTextSecondary}>Reset Storage Config</Text>
          </TouchableOpacity>
        </View>
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
    paddingHorizontal: 32,
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
    marginBottom: 8,
  },
  errorDetail: {
    marginTop: 8,
    color: theme.text.secondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  button: {
    backgroundColor: theme.accent.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.accent.primary,
  },
  buttonText: {
    color: theme.text.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextSecondary: {
    color: theme.accent.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});
