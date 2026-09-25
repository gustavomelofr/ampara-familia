import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/AppText';
import { useAppDatabase } from '@/src/database/DatabaseProvider';
import { getCareProfile } from '@/src/database/repository';
import type { CareProfile } from '@/src/database/models';
import { theme } from '@/src/theme';

export function ActivePersonNotice({ interactive = true }: { interactive?: boolean }) {
  const db = useAppDatabase();
  const router = useRouter();
  const [profile, setProfile] = useState<CareProfile | null>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    void getCareProfile(db).then((next) => { if (active) setProfile(next); }).catch(() => {
      if (active) setProfile(null);
    });
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
      accessibilityLabel={`Pessoa acompanhada: ${profile.personName}. Trocar pessoa.`}
      accessibilityHint="Abre a lista de pessoas acompanhadas"
      onPress={() => router.push('/care-profile')}
      hitSlop={4}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}>
      <View style={styles.copy}>
        <AppText tone="muted" variant="small">PESSOA ACOMPANHADA</AppText>
        <AppText tone="ink" variant="label" numberOfLines={1}>{profile.personName}</AppText>
      </View>
      <AppText tone="forest" variant="label">Trocar</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { minHeight: 54, paddingHorizontal: 14, paddingVertical: 7, borderRadius: theme.radius.md, backgroundColor: theme.colors.forestSoft, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, gap: 12 },
  copy: { flex: 1, gap: 1 },
  static: { justifyContent: 'flex-start' },
  pressed: { opacity: 0.76 },
});
