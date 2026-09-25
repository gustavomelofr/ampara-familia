import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppScreen } from '@/src/components/AppScreen';
import { AppText } from '@/src/components/AppText';
import { ActivePersonNotice } from '@/src/components/ActivePersonNotice';
import { ConfirmPanel } from '@/src/components/ConfirmPanel';
import { PageHeader } from '@/src/components/PageHeader';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenMessage } from '@/src/components/ScreenMessage';
import { deleteDocument, listDocuments, setDocumentCompleted } from '@/src/database/repository';
import { useAppDatabase } from '@/src/database/DatabaseProvider';
import type { CareDocument } from '@/src/database/models';
import { formatDate, toLocalIsoDate } from '@/src/utils/date';
import { theme } from '@/src/theme';

export default function DocumentsScreen() {
  const db = useAppDatabase();
  const router = useRouter();
  const [documents, setDocuments] = useState<CareDocument[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const refresh = useCallback(async () => {
    try { setDocuments(await listDocuments(db)); setError(''); }
    catch { setError('Não foi possível carregar os documentos.'); }
    finally { setLoading(false); }
  }, [db]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const removeDocument = async (document: CareDocument) => {
    try {
      await deleteDocument(db, document.id);
      setConfirmingId(null);
      await refresh();
    } catch {
      setError('Não foi possível excluir o registro. Tente novamente.');
    }
  };

  return (
    <AppScreen>
      <PageHeader eyebrow="DOCUMENTOS" title="Saiba onde encontrar." subtitle="O Ampara guarda um checklist e a localização informada, não os arquivos." onBack={() => router.back()} />
      <ActivePersonNotice />
      <PrimaryButton title="Adicionar documento" onPress={() => router.push('/document/new')} />
      <View style={styles.list}>
        {loading ? <ScreenMessage title="Carregando documentos" message="A lista fica salva neste aparelho." /> : error && documents.length === 0 ? <ScreenMessage tone="error" title="Os documentos não foram carregados" message={error} actionLabel="Tentar novamente" onAction={() => void refresh()} /> : documents.length ? documents.map((document, index) => (
          <View key={document.id} style={[styles.row, index > 0 && styles.divider]}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: document.completed }}
              accessibilityLabel={`${document.completed ? 'Marcar como pendente' : 'Marcar como localizado'}: ${document.title}`}
              aria-checked={document.completed}
              onPress={() => { void setDocumentCompleted(db, document.id, !document.completed).then(refresh).catch(() => setError('Não foi possível atualizar o documento.')); }}
              hitSlop={4}
              style={styles.checkTarget}>
              <View style={[styles.check, document.completed && styles.checked]}>
                {document.completed ? <AppText tone="surface" variant="label">✓</AppText> : null}
              </View>
            </Pressable>
            <View style={styles.copy}>
              <AppText variant="label">{document.title}</AppText>
              <AppText tone="muted" variant="small">{document.completed ? 'Localizado' : 'Pendente'} · {document.location || 'Localização não anotada'}</AppText>
              {document.expiresOn ? <AppText tone={document.expiresOn < toLocalIsoDate(new Date()) ? 'danger' : 'muted'} variant="small">{document.expiresOn < toLocalIsoDate(new Date()) ? 'Vencido' : 'Validade'} · {formatDate(document.expiresOn)}</AppText> : null}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={`Excluir ${document.title}`} onPress={() => setConfirmingId(document.id)} style={styles.remove}>
              <AppText tone="danger" variant="small">Excluir</AppText>
            </Pressable>
            {confirmingId === document.id ? <View style={styles.confirmWrap}>
              <ConfirmPanel
                title="Excluir registro?"
                message={`“${document.title}” será removido deste aparelho.`}
                onCancel={() => setConfirmingId(null)}
                onConfirm={() => void removeDocument(document)}
              />
            </View> : null}
          </View>
        )) : (
          <ScreenMessage title="Nenhum documento anotado." message="Anote só o que ajuda a encontrar documentos importantes." actionLabel="Adicionar documento" onAction={() => router.push('/document/new')} />
        )}
      </View>
      <View style={styles.notice}>
        <AppText tone="muted" variant="small">Não guarde aqui senha, número completo de documento ou cópia de arquivos. O checklist não substitui um local seguro para os documentos originais.</AppText>
      </View>
      {error && documents.length > 0 ? <ScreenMessage tone="error" title="Os documentos podem estar desatualizados" message={error} actionLabel="Tentar novamente" onAction={() => void refresh()} /> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: 22, borderTopWidth: 1, borderTopColor: theme.colors.border },
  row: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  divider: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  checkTarget: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  check: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: theme.colors.muted, alignItems: 'center', justifyContent: 'center' },
  checked: { backgroundColor: theme.colors.forest, borderColor: theme.colors.forest },
  copy: { flex: 1, gap: 4 },
  remove: { minWidth: 56, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  confirmWrap: { width: '100%' },
  notice: { marginTop: 20, padding: 14, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface },
});
