import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppScreen } from '@/src/components/AppScreen';
import { AppText } from '@/src/components/AppText';
import { ActivePersonNotice } from '@/src/components/ActivePersonNotice';
import { PageHeader } from '@/src/components/PageHeader';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { deleteDocument, listDocuments, setDocumentCompleted } from '@/src/database/repository';
import type { CareDocument } from '@/src/database/models';
import { formatDate } from '@/src/utils/date';
import { theme } from '@/src/theme';

export default function DocumentsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [documents, setDocuments] = useState<CareDocument[]>([]);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    try { setDocuments(await listDocuments(db)); setError(''); }
    catch { setError('Não foi possível carregar os documentos.'); }
  }, [db]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const askDelete = (document: CareDocument) => Alert.alert('Excluir registro?', document.title, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Excluir', style: 'destructive', onPress: () => { void deleteDocument(db, document.id).then(refresh); } },
  ]);

  return (
    <AppScreen>
      <PageHeader eyebrow="DOCUMENTOS" title="Saiba onde encontrar." subtitle="O Ampara guarda um checklist e a localização informada, não os arquivos." />
      <ActivePersonNotice />
      <PrimaryButton title="Adicionar documento" onPress={() => router.push('/document/new')} />
      <View style={styles.list}>
        {documents.length ? documents.map((document, index) => (
          <View key={document.id} style={[styles.row, index > 0 && styles.divider]}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: document.completed }}
              accessibilityLabel={`${document.completed ? 'Marcar como pendente' : 'Marcar como localizado'}: ${document.title}`}
              onPress={() => { void setDocumentCompleted(db, document.id, !document.completed).then(refresh); }}
              style={[styles.check, document.completed && styles.checked]}>
              {document.completed ? <AppText tone="surface" variant="label">✓</AppText> : null}
            </Pressable>
            <View style={styles.copy}>
              <AppText variant="label">{document.title}</AppText>
              <AppText tone="muted" variant="small">{document.location || 'Localização não anotada'}{document.expiresOn ? ` · vence ${formatDate(document.expiresOn)}` : ''}</AppText>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={`Excluir ${document.title}`} hitSlop={8} onPress={() => askDelete(document)} style={styles.remove}>
              <AppText tone="muted" variant="small">×</AppText>
            </Pressable>
          </View>
        )) : (
          <View style={styles.empty}>
            <AppText variant="title">Nenhum documento anotado.</AppText>
            <AppText tone="muted">Anote só o que ajuda a encontrar documentos importantes.</AppText>
          </View>
        )}
      </View>
      <View style={styles.notice}>
        <AppText tone="muted" variant="small">Não guarde aqui senha, número completo de documento ou cópia de arquivos. O checklist não substitui um local seguro para os documentos originais.</AppText>
      </View>
      {error ? <AppText tone="danger" accessibilityRole="alert">{error}</AppText> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: 22, borderTopWidth: 1, borderTopColor: theme.colors.border },
  row: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 12 },
  divider: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  check: { width: 26, height: 26, borderRadius: 8, borderWidth: 1.5, borderColor: theme.colors.muted, alignItems: 'center', justifyContent: 'center' },
  checked: { backgroundColor: theme.colors.forest, borderColor: theme.colors.forest },
  copy: { flex: 1, gap: 4 },
  remove: { minWidth: 40, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  empty: { paddingVertical: 28, gap: 8 },
  notice: { marginTop: 20, padding: 14, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface },
});
