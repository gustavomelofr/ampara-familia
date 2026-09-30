import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppScreen } from '@/src/components/AppScreen';
import { AppText } from '@/src/components/AppText';
import { Field } from '@/src/components/Field';
import { OptionChips } from '@/src/components/OptionChips';
import { PageHeader } from '@/src/components/PageHeader';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { createCareProfile } from '@/src/database/repository';
import { useAppDatabase } from '@/src/database/DatabaseProvider';
import type { Relationship } from '@/src/database/models';
import { theme } from '@/src/theme';

export default function OnboardingScreen() {
  const db = useAppDatabase();
  const router = useRouter();
  const [personName, setPersonName] = useState('');
  const [relationship, setRelationship] = useState<Relationship>('mãe');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await createCareProfile(db, { personName, relationship });
      router.replace('/(tabs)');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar agora.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppScreen>
      <View style={styles.mark}><AppText tone="surface" variant="title">A</AppText></View>
      <PageHeader
        eyebrow="AMPARA FAMÍLIA"
        title="Vamos organizar o cuidado, com calma."
        subtitle="Comece pelo nome da pessoa cujas consultas e tarefas você quer acompanhar."
      />
      <Field
        label="Como chamamos seu familiar?"
        testID="onboarding-person-name"
        value={personName}
        onChangeText={setPersonName}
        placeholder="Ex.: Lúcia"
        autoCapitalize="words"
        returnKeyType="done"
      />
      <OptionChips
        label="Qual é o seu vínculo?"
        value={relationship}
        onChange={setRelationship}
        options={[
          { value: 'mãe', label: 'Minha mãe' },
          { value: 'pai', label: 'Meu pai' },
          { value: 'outro', label: 'Outro familiar' },
        ]}
      />
      <View style={styles.note}>
        <AppText variant="label">Sem conta, sem compartilhamento automático</AppText>
        <AppText tone="muted" variant="small">Por enquanto, seus registros ficam somente neste aparelho. Você decide se e o que quer compartilhar.</AppText>
      </View>
      {error ? <AppText tone="danger" accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}
      <PrimaryButton title={saving ? 'Salvando…' : 'Continuar'} onPress={() => void save()} disabled={saving || personName.trim().length < 2} />
      <AppText tone="muted" variant="small" style={styles.disclaimer}>O Ampara ajuda a organizar informações. Não substitui profissionais de saúde nem serviços de emergência.</AppText>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  mark: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.forest, marginBottom: 30 },
  note: { backgroundColor: theme.colors.forestSoft, borderRadius: theme.radius.md, padding: 16, gap: 6, marginBottom: 20 },
  error: { marginBottom: 12 },
  disclaimer: { marginTop: 18, textAlign: 'center', paddingHorizontal: 12 },
});
