import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';

import { AppScreen } from '@/src/components/AppScreen';
import { AppText } from '@/src/components/AppText';
import { ActivePersonNotice } from '@/src/components/ActivePersonNotice';
import { PageHeader } from '@/src/components/PageHeader';
import { SectionTitle } from '@/src/components/SectionTitle';
import { theme } from '@/src/theme';

const links: { title: string; description: string; route: '/expenses' | '/documents' | '/medications' | '/share-summary' | '/privacy' | '/care-profile'; group: 'Registros' | 'Privacidade e pessoas'; symbol: SymbolViewProps['name'] }[] = [
  { title: 'Despesas', description: 'Gastos anotados pela família', route: '/expenses' as const, group: 'Registros', symbol: { ios: 'dollarsign.circle', android: 'payments', web: 'payments' } },
  { title: 'Documentos', description: 'Checklist e onde encontrar', route: '/documents' as const, group: 'Registros', symbol: { ios: 'doc.text', android: 'description', web: 'description' } },
  { title: 'Medicamentos', description: 'Uma lista informativa', route: '/medications' as const, group: 'Registros', symbol: { ios: 'pills', android: 'medication', web: 'medication' } },
  { title: 'Compartilhar resumo', description: 'Revise antes de enviar', route: '/share-summary' as const, group: 'Privacidade e pessoas', symbol: { ios: 'square.and.arrow.up', android: 'share', web: 'share' } },
  { title: 'Dados e privacidade', description: 'Informações guardadas neste aparelho', route: '/privacy' as const, group: 'Privacidade e pessoas', symbol: { ios: 'hand.raised', android: 'shield', web: 'shield' } },
  { title: 'Pessoas acompanhadas', description: 'Alternar ou adicionar até duas pessoas', route: '/care-profile' as const, group: 'Privacidade e pessoas', symbol: { ios: 'person.2', android: 'group', web: 'group' } },
];

export default function MoreScreen() {
  const router = useRouter();
  return (
    <AppScreen>
      <PageHeader eyebrow="AMPARA FAMÍLIA" title="Outras informações." subtitle="Detalhes para consultar quando fizerem falta." />
      <ActivePersonNotice />
      {(['Registros', 'Privacidade e pessoas'] as const).map((group) => (
        <View key={group}>
          <SectionTitle title={group} />
          <View style={styles.links}>
            {links.filter((link) => link.group === group).map((link, index) => (
              <Pressable
                key={link.route}
                accessibilityRole="button"
                accessibilityLabel={link.title}
                accessibilityHint={`Abre ${link.title.toLocaleLowerCase('pt-BR')}`}
                onPress={() => router.push(link.route)}
                style={({ pressed }) => [styles.row, index > 0 && styles.divider, pressed && styles.pressed]}>
                <View style={styles.symbol}><SymbolView name={link.symbol} tintColor={theme.colors.forest} size={20} /></View>
                <View style={styles.copy}>
                  <AppText variant="label">{link.title}</AppText>
                  <AppText tone="muted" variant="small">{link.description}</AppText>
                </View>
                <AppText tone="muted" variant="title">›</AppText>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
      <View style={styles.note}>
        <AppText variant="label">Sem sincronização nesta versão</AppText>
        <AppText tone="muted" variant="small">As anotações são locais. Um nome escrito como responsável por uma tarefa não recebe notificação nem acesso ao app.</AppText>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  links: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 72, gap: 14 },
  divider: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  symbol: { width: 42, height: 42, borderRadius: 14, backgroundColor: theme.colors.forestSoft, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 4 },
  note: { marginTop: 30, padding: 16, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface, gap: 6 },
  pressed: { opacity: 0.7 },
});
