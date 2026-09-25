import * as LocalAuthentication from 'expo-local-authentication';
import * as ScreenCapture from 'expo-screen-capture';
import * as SplashScreen from 'expo-splash-screen';
import type { PropsWithChildren } from 'react';
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';

import { AppScreen } from '@/src/components/AppScreen';
import { AppText } from '@/src/components/AppText';
import { PageHeader } from '@/src/components/PageHeader';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { theme } from '@/src/theme';

export function DeviceLock({ children }: PropsWithChildren) {
  const [unlocked, setUnlocked] = useState(false);
  const [openedOnce, setOpenedOnce] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [protectionStatus, setProtectionStatus] = useState<'preparing' | 'ready' | 'failed'>('preparing');
  const [protectionAttempt, setProtectionAttempt] = useState(0);
  const authenticating = useRef(false);
  const mounted = useRef(true);
  const appIsActive = useRef(true);

  useEffect(() => {
    mounted.current = true;
    // The root navigator is not mounted until authentication. Show the lock screen instead of the splash.
    void SplashScreen.hideAsync();
    const subscription = AppState.addEventListener('change', (state) => {
      appIsActive.current = state === 'active';
      if (state !== 'active' && !authenticating.current) {
        setUnlocked(false);
      }
    });
    return () => {
      mounted.current = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      setProtectionStatus('ready');
      return;
    }
    let active = true;
    setProtectionStatus('preparing');
    void (async () => {
      try {
        await ScreenCapture.preventScreenCaptureAsync('ampara-private-data');
        if (Platform.OS === 'ios') await ScreenCapture.enableAppSwitcherProtectionAsync(0.85);
        if (active) setProtectionStatus('ready');
      } catch {
        if (active) setProtectionStatus('failed');
      }
    })();
    return () => {
      active = false;
      void ScreenCapture.allowScreenCaptureAsync('ampara-private-data').catch(() => undefined);
      if (Platform.OS === 'ios') {
        void ScreenCapture.disableAppSwitcherProtectionAsync().catch(() => undefined);
      }
    };
  }, [protectionAttempt]);

  const unlock = async () => {
    if (authenticating.current || Platform.OS === 'web') return;
    authenticating.current = true;
    setBusy(true);
    setMessage('');
    try {
      const level = await LocalAuthentication.getEnrolledLevelAsync();
      if (level === LocalAuthentication.SecurityLevel.NONE) {
        setMessage('Ative o código de desbloqueio do aparelho nos Ajustes para proteger os registros e tente novamente.');
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Desbloquear Ampara Família',
        fallbackLabel: 'Usar código do aparelho',
        cancelLabel: 'Cancelar',
        disableDeviceFallback: false,
        biometricsSecurityLevel: 'strong',
      });
      if (!mounted.current) return;
      if (result.success) {
        if (appIsActive.current) {
          setOpenedOnce(true);
          setUnlocked(true);
        } else {
          setUnlocked(false);
          setMessage('Volte ao Ampara e autentique novamente para ver os registros.');
        }
      } else if (result.error === 'passcode_not_set' || result.error === 'not_enrolled') {
        setMessage('Configure o código do aparelho e tente novamente.');
      } else if (result.error === 'user_cancel' || result.error === 'system_cancel' || result.error === 'app_cancel') {
        setMessage('O Ampara continua bloqueado. Toque em Desbloquear quando estiver pronto.');
      } else {
        setMessage('Não foi possível confirmar o desbloqueio. Tente novamente.');
      }
    } catch {
      if (mounted.current) setMessage('Não foi possível verificar a proteção do aparelho. Tente novamente.');
    } finally {
      authenticating.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  if (Platform.OS === 'web') {
    return (
      <AppScreen>
        <PageHeader eyebrow="AMPARA FAMÍLIA" title="Use o aplicativo no celular." subtitle="O acesso aos registros é protegido pelo desbloqueio do aparelho no iOS ou Android." />
      </AppScreen>
    );
  }

  return (
    <View style={styles.root}>
      {openedOnce ? <View style={[styles.root, !unlocked && styles.hidden]}>{children}</View> : null}
      {!unlocked ? <View style={styles.overlay}>
        <AppScreen scroll={false} bottomInset={24}>
          <View style={styles.content}>
            <View style={styles.mark}><AppText tone="surface" variant="title">A</AppText></View>
            <PageHeader eyebrow="AMPARA FAMÍLIA" title="Seus registros estão protegidos." subtitle="Use Face ID, Touch ID ou o código do aparelho para abrir o Ampara." />
            {protectionStatus === 'failed' ? <AppText tone="danger" accessibilityRole="alert" style={styles.message}>Não foi possível iniciar a proteção de captura e prévia. Seus registros continuam fechados; tente novamente.</AppText> : null}
            {message ? <AppText tone="danger" accessibilityRole="alert" style={styles.message}>{message}</AppText> : null}
            <PrimaryButton
              title={protectionStatus === 'preparing' ? 'Preparando proteção…' : protectionStatus === 'failed' ? 'Tentar novamente' : busy ? 'Verificando…' : 'Desbloquear'}
              onPress={() => protectionStatus === 'failed' ? setProtectionAttempt((value) => value + 1) : void unlock()}
              disabled={busy || protectionStatus !== 'ready'}
            />
            <AppText tone="muted" variant="small" style={styles.note}>O app bloqueia capturas e protege a prévia nas telas recentes quando o sistema permite. Mantenha o bloqueio de tela do aparelho ativo.</AppText>
          </View>
        </AppScreen>
      </View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hidden: { display: 'none' },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: theme.colors.paper },
  content: { flex: 1, justifyContent: 'center', gap: 12 },
  mark: { width: 54, height: 54, borderRadius: 18, backgroundColor: theme.colors.forest, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  message: { marginBottom: 4 },
  note: { marginTop: 8 },
});
