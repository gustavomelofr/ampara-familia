import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppScreen } from '@/src/components/AppScreen';
import { AppText } from '@/src/components/AppText';
import { Field } from '@/src/components/Field';
import { OptionChips } from '@/src/components/OptionChips';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import {
  createCareProfile,
  getActiveCareProfileId,
  listCareProfiles,
  saveCareProfile,
  setActiveCareProfile,
} from '@/src/database/repository';
import type { CareProfile, Relationship } from '@/src/database/models';
import { theme } from '@/src/theme';

type Mode = 'list' | 'edit' | 'add';
const relationshipLabels: Record<Relationship, string> = { mãe: 'Mãe', pai: 'Pai', outro: 'Outro familiar' };

export default function CareProfileScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [profiles, setProfiles] = useState<CareProfile[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>('list');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [personName, setPersonName] = useState('');
  const [relationship, setRelationship] = useState<Relationship>('mãe');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const [nextProfiles, nextActiveId] = await Promise.all([listCareProfiles(db), getActiveCareProfileId(db)]);
    setProfiles(nextProfiles);
    setActiveId(nextActiveId);
  }, [db]);
  useEffect(() => { void refresh().catch(() => setError('Não foi possível carregar os perfis.')); }, [refresh]);

  const startEdit = (profile: CareProfile) => {
    setEditingId(profile.id);
    setPersonName(profile.personName);
    setRelationship(profile.relationship);
    setError('');
    setMode('edit');
  };

  const startAdd = () => {
    setEditingId(null);
    setPersonName('');
    setRelationship('mãe');
    setError('');
    setMode('add');
  };

  const chooseProfile = async (profile: CareProfile) => {
    try {
      await setActiveCareProfile(db, profile.id);
      router.replace('/(tabs)');
    } catch {
      setError('Não foi possível trocar a pessoa acompanhada.');
    }
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      if (mode === 'add') {
        const newId = await createCareProfile(db, { personName, relationship });
        await setActiveCareProfile(db, newId);
        router.replace('/(tabs)');
      } else if (editingId !== null) {
        await saveCareProfile(db, editingId, { personName, relationship });
        await refresh();
        setMode('list');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o perfil.');
    } finally {
      setSaving(false);
    }
  };

  if (mode !== 'list') {
    return (
      <AppScreen bottomInset={24}>
        <AppText accessibilityRole="header" variant="display" style={styles.title}>{mode === 'add' ? 'Adicionar familiar.' : 'Editar familiar.'}</AppText>
        <AppText tone="muted" style={styles.subtitle}>Cada pessoa tem sua própria agenda, tarefas e anotações.</AppText>
        <Field label="Nome como prefere chamar" value={personName} onChangeText={setPersonName} placeholder="Ex.: Lúcia" autoCapitalize="words" />
        <OptionChips label="Vínculo" value={relationship} onChange={setRelationship} options={[
          { value: 'mãe', label: 'Minha mãe' },
          { value: 'pai', label: 'Meu pai' },
          { value: 'outro', label: 'Outro familiar' },
        ]} />
        {error ? <AppText tone="danger" accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}
        <PrimaryButton title={saving ? 'Salvando…' : mode === 'add' ? 'Adicionar e acompanhar' : 'Salvar alterações'} onPress={() => void save()} disabled={saving || personName.trim().length < 2} />
        <Pressable accessibilityRole="button" onPress={() => setMode('list')} style={styles.cancel}>
          <AppText tone="forest" variant="label">Voltar sem salvar</AppText>
        </Pressable>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <AppText accessibilityRole="header" variant="display" style={styles.title}>Quem você acompanha?</AppText>
      <AppText tone="muted" style={styles.subtitle}>Cada familiar tem dados separados neste aparelho.</AppText>
      <View style={styles.profiles}>
        {profiles.map((profile, index) => (
          <View key={profile.id} style={[styles.profileRow, index > 0 && styles.divider]}>
            <Pressable accessibilityRole="button" onPress={() => void chooseProfile(profile)} style={({ pressed }) => [styles.profileMain, pressed && styles.pressed]}>
              <View style={styles.profileCopy}>
                <AppText variant="label">{profile.personName}</AppText>
                <AppText tone="muted" variant="small">{relationshipLabels[profile.relationship]}{activeId === profile.id ? ' · acompanhando agora' : ''}</AppText>
              </View>
              <AppText tone="forest" variant="label">{activeId === profile.id ? 'Atual' : 'Acompanhar'}</AppText>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Editar perfil de ${profile.personName}`} onPress={() => startEdit(profile)} style={styles.editButton}>
              <AppText tone="muted" variant="small">Editar</AppText>
            </Pressable>
          </View>
        ))}
      </View>
      {profiles.length < 2 ? (
        <PrimaryButton title="Adicionar outra pessoa" secondary onPress={startAdd} />
      ) : (
        <AppText tone="muted" variant="small" style={styles.limit}>O protótipo organiza até duas pessoas acompanhadas. Esse limite pode ser revisto antes da primeira versão pública.</AppText>
      )}
      <View style={styles.note}>
        <AppText tone="muted" variant="small">Ao trocar de perfil, a agenda e as tarefas passam a mostrar somente os registros daquela pessoa.</AppText>
      </View>
      {error ? <AppText tone="danger" accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 6 },
  subtitle: { marginTop: 8, marginBottom: 24 },
  profiles: { borderTopWidth: 1, borderTopColor: theme.colors.border, marginBottom: 22 },
  profileRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 10 },
  divider: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  profileMain: { minHeight: 68, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  profileCopy: { gap: 4 },
  editButton: { minHeight: 44, minWidth: 46, alignItems: 'center', justifyContent: 'center' },
  cancel: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  note: { padding: 14, backgroundColor: theme.colors.forestSoft, borderRadius: theme.radius.md, marginTop: 22 },
  limit: { marginTop: 12 },
  error: { marginTop: 14 },
  pressed: { opacity: 0.72 },
});
