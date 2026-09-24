import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/AppText';
import { getCareProfile } from '@/src/database/repository';
import type { CareProfile } from '@/src/database/models';
import { theme } from '@/src/theme';

export function ActivePersonNotice({ interactive = true }: { interactive?: boolean }) {
  const db = useSQLiteContext();
  const router = useRouter();
  const [profile, setProfile] = useState<CareProfile | null>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    void getCareProfile(db).then((next) => { if (active) setProfile(next); });
    return () => { active = false; };
  }, [db]));

  if (!profile) return null;
  if (!interactive) {
    return (
      <View style={[styles.wrap, styles.static]}>
        <AppText tone="muted" variant="small">Registrando para <AppText tone="ink" variant="label">{profile.personName}</AppText></AppText>
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Dados de ${profile.personName}. Trocar pessoa acompanhada.`}
      onPress={() => router.push('/care-profile')}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}>
      <AppText tone="muted" variant="small">Para <AppText tone="ink" variant="label">{profile.personName}</AppText></AppText>
      <AppText tone="forest" variant="label">Trocar</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { minHeight: 44, paddingHorizontal: 12, borderRadius: theme.radius.md, backgroundColor: theme.colors.forestSoft, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  static: { justifyContent: 'flex-start' },
  pressed: { opacity: 0.76 },
});
