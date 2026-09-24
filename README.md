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

Este protótipo não tem backup/restore manual nem bloqueio próprio. A cópia automática do aparelho depende do sistema operacional e das configurações de quem usa; isso deve ser considerado antes de convidar famílias a guardar informações importantes.

## Cuidados de produto

O aplicativo organiza informações inseridas pela família. Não diagnostica, prescreve, calcula dose, confirma que um medicamento foi administrado, monitora sinais vitais nem substitui profissionais ou serviços de emergência. Notificações são auxiliares e podem não ser entregues pelo sistema operacional.

Consultas e medicamentos podem conter dados pessoais sensíveis. Não inserir dados reais em capturas de tela, demonstrações ou testes compartilhados. Rever armazenamento seguro, exportação e recuperação de dados, política de privacidade, termos e avisos antes de uma distribuição pública.

## Verificações

```sh
npm run typecheck
npm test
npx expo install --check
```

## Publicação

O diretório é separado de `estagia`; o projeto EAS e o registro “Ampara Família” do App Store Connect já existem, usando o bundle ID `com.gustavo.ampara`. Antes de uma distribuição pública, revisar a marca, adicionar uma política de privacidade pública e finalizar os textos de loja. A assinatura iOS ainda precisa ser configurada/validada no EAS. O ambiente atual é Linux, portanto uma build nativa é feita no EAS remoto; validação no simulador do Xcode requer macOS.

### Build manual via GitHub Actions

O workflow `.github/workflows/ios-testflight.yml` é manual (`workflow_dispatch`) e só inicia se a opção de confirmação de upload estiver marcada. Depois de conectar este diretório a um repositório GitHub, configure os secrets `EXPO_TOKEN`, `ASC_API_KEY_BASE64`, `ASC_API_KEY_ID` e `ASC_API_ISSUER_ID`. O `.p8` deve ser convertido para Base64 localmente e cadastrado diretamente como secret, nunca versionado.

O certificado de distribuição e o perfil de provisionamento precisam estar configurados no EAS antes de rodar o workflow. Uma configuração inicial interativa de assinatura Apple ainda é necessária; GitHub Actions não substitui esse passo. O workflow apenas envia o build ao TestFlight, não submete a versão para publicação pública.
