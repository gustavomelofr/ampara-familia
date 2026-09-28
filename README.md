# Ampara Família

Aplicativo de organização familiar para acompanhar consultas, tarefas e pequenas informações de cuidado. O nome provisório “Ampara” não estava disponível como nome de loja; o registro App Store Connect foi criado como “Ampara Família”. Marca e textos finais ainda devem ser revisados antes da publicação.

## Iniciar

```sh
npm install
npx expo start
```

O projeto usa Expo SDK 57, React Native, TypeScript, Expo Router e Expo SQLite. Os dados do protótipo são gravados localmente no aparelho. Não há login, backend ou sincronização entre aparelhos.

## Estado do protótipo

- Cadastro local da pessoa acompanhada.
- Até dois perfis separados de pai/mãe ou familiares.
- Hoje: próximo compromisso e tarefas em aberto.
- Agenda: consultas, exames, prazos e lembretes locais opcionais.
- Tarefas: responsável indicado por texto, sem notificação ou atribuição remota.
- Despesas, documentos e lista informativa de medicamentos.
- Prévia de resumo e compartilhamento manual por seção.
- Apagar todos os dados a partir da tela de privacidade.

Uma versão-ponte simplifica a interface e migra, uma única vez, os bancos SQLCipher da build TestFlight 8.1 para SQLite local sem criptografia própria. O leitor SQLCipher permanece temporariamente apenas para essa migração; depois de confirmar todos os aparelhos atualizados, será removido numa build seguinte. Os registros não têm sincronização nem backup próprio: permanecem no aparelho e podem ser perdidos se o app/dados forem removidos ou se trocar de aparelho.

## Cuidados de produto

O aplicativo organiza informações inseridas pela família. Não diagnostica, prescreve, calcula dose, confirma que um medicamento foi administrado, monitora sinais vitais nem substitui profissionais ou serviços de emergência. Notificações são auxiliares e podem não ser entregues pelo sistema operacional.

Consultas e medicamentos podem conter dados pessoais sensíveis. Não inserir dados reais em capturas de tela, demonstrações ou testes compartilhados. A versão simplificada não bloqueia o app com Face ID/código nem oferece backup/restauração. Consulte `APP_STORE_RELEASE.md` antes de distribuir publicamente e revise as declarações de privacidade e armazenamento.

## Verificações

```sh
npm run typecheck
npm test
npx expo install --check
```

## Publicação

O diretório é separado de `estagia`; o registro “Ampara Família” do App Store Connect já existe, usando o bundle ID `com.gustavo.ampara`. Antes de uma distribuição pública, revisar a marca, adicionar uma política de privacidade pública e finalizar os textos de loja.

### Build iOS pelo GitHub Actions (sem EAS)

O workflow `.github/workflows/ios-testflight.yml` usa um runner macOS hospedado pelo GitHub, gera o projeto nativo com Expo Prebuild, compila e assina com Xcode e envia o `.ipa` ao TestFlight com Fastlane. Não usa EAS Build, EAS Submit nem requer `EXPO_TOKEN`. O envio é manual, exige marcar explicitamente a confirmação de upload e gera um número de build único por execução.

Configure estes secrets em **Settings → Secrets and variables → Actions** no repositório:

- `IOS_DISTRIBUTION_CERTIFICATE_BASE64`: certificado Apple Distribution e chave privada em `.p12`, codificados em Base64.
- `IOS_DISTRIBUTION_CERTIFICATE_PASSWORD`: senha que protege o `.p12`.
- `IOS_APP_STORE_PROFILE_BASE64`: perfil App Store Connect `.mobileprovision`, codificado em Base64 e correspondente ao bundle ID `com.gustavo.ampara` e ao certificado acima.
- `ASC_API_KEY_BASE64`: chave de equipe App Store Connect `.p8`, codificada em Base64.
- `ASC_API_KEY_ID`: ID da chave `.p8`.
- `ASC_API_ISSUER_ID`: Issuer ID da equipe no App Store Connect.

Os arquivos de assinatura e as chaves privadas não devem ser versionados nem enviados pelo chat. O `.p12` e o perfil devem ser criados/baixados no Apple Developer Portal e armazenados somente como secrets do repositório. A chave de equipe do App Store Connect precisa ter acesso ao app e papel **App Manager** para upload e metadados do TestFlight.

O App ID tem a capability **Push Notifications** habilitada porque o plugin `expo-notifications` inclui a entitlement APNs no projeto nativo gerado. O protótipo usa notificações locais agendadas; não registra tokens nem envia notificações remotas.

Para publicar um build: abra **Actions → Build and upload iOS to TestFlight → Run workflow**, informe uma mensagem e marque a confirmação. O workflow só faz upload para processamento no TestFlight; a distribuição a grupos de testers e a publicação pública continuam sendo controladas no App Store Connect.
