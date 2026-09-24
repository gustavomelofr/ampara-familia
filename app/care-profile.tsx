import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppScreen } from '@/src/components/AppScreen';
import { AppText } from '@/src/components/AppText';
import { Field } from '@/src/components/Field';
import { OptionChips } from '@/src/components/OptionChips';
import { PageHeader } from '@/src/components/PageHeader';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenMessage } from '@/src/components/ScreenMessage';
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
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [nextProfiles, nextActiveId] = await Promise.all([listCareProfiles(db), getActiveCareProfileId(db)]);
      setProfiles(nextProfiles);
      setActiveId(nextActiveId);
      setError('');
    } catch {
      setError('Não foi possível carregar os perfis. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [db]);
  useEffect(() => { void refresh(); }, [refresh]);

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
        <PageHeader eyebrow="PESSOAS ACOMPANHADAS" title={mode === 'add' ? 'Adicionar familiar.' : 'Editar familiar.'} subtitle="Cada pessoa tem sua própria agenda, tarefas e anotações." onBack={() => setMode('list')} backLabel="Cancelar" />
        <Field label="Nome como prefere chamar" value={personName} onChangeText={setPersonName} placeholder="Ex.: Lúcia" autoCapitalize="words" />
        <OptionChips label="Vínculo" value={relationship} onChange={setRelationship} options={[
          { value: 'mãe', label: 'Minha mãe' },
          { value: 'pai', label: 'Meu pai' },
          { value: 'outro', label: 'Outro familiar' },
        ]} />
        {error ? <AppText tone="danger" accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}
        <PrimaryButton title={saving ? 'Salvando…' : mode === 'add' ? 'Adicionar e acompanhar' : 'Salvar alterações'} onPress={() => void save()} disabled={saving || personName.trim().length < 2} />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <PageHeader eyebrow="PESSOAS ACOMPANHADAS" title="Quem você acompanha?" subtitle="Cada familiar tem dados separados neste aparelho." onBack={() => router.back()} />
      {loading ? <ScreenMessage title="Carregando perfis" message="As informações ficam neste aparelho." /> : null}
      {!loading && error ? <ScreenMessage tone="error" title="Os perfis não foram carregados" message={error} actionLabel="Tentar novamente" onAction={() => void refresh()} /> : null}
      {!loading && !error ? <View style={styles.profiles}>
        {profiles.map((profile, index) => (
          <View key={profile.id} style={[styles.profileRow, activeId === profile.id && styles.activeProfile, index > 0 && styles.divider]}>
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
      </View> : null}
      {!loading && !error && profiles.length < 2 ? (
        <PrimaryButton title="Adicionar outra pessoa" secondary onPress={startAdd} />
      ) : !loading && !error ? (
        <AppText tone="muted" variant="small" style={styles.limit}>O protótipo organiza até duas pessoas acompanhadas. Esse limite pode ser revisto antes da primeira versão pública.</AppText>
      ) : null}
      {!loading && !error ? <View style={styles.note}>
        <AppText tone="muted" variant="small">Ao trocar de perfil, a agenda e as tarefas passam a mostrar somente os registros daquela pessoa.</AppText>
      </View> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  profiles: { borderTopWidth: 1, borderTopColor: theme.colors.border, marginBottom: 22 },
  profileRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8 },
  activeProfile: { backgroundColor: theme.colors.forestSoft },
  divider: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  profileMain: { minHeight: 68, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  profileCopy: { gap: 4 },
  editButton: { minHeight: 44, minWidth: 46, alignItems: 'center', justifyContent: 'center' },
  note: { padding: 14, backgroundColor: theme.colors.forestSoft, borderRadius: theme.radius.md, marginTop: 22 },
  limit: { marginTop: 12 },
  error: { marginTop: 14 },
  pressed: { opacity: 0.72 },
});
