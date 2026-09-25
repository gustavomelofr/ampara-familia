# Ampara Família — preparação para a App Store

**Estado:** candidata a lançamento, ainda não enviada à App Review. Não escolher a build 1.0 (7.1), que mostra um alerta de desenvolvimento na interface.

## Bloqueios para submissão pública

- [ ] Compilar nova build em GitHub Actions, confirmar processamento no App Store Connect e instalar pelo TestFlight em iPhone real. Não há publicação automática neste workflow.
- [ ] Confirmar que nenhuma aba mostra o alerta `Expo Head`, inclusive após fechar/reabrir o app, atualizar a instalação existente e trocar a pessoa acompanhada.
- [ ] Testar Face ID/Touch ID e fallback para código do aparelho; fechar, colocar em segundo plano e reabrir; verificar reautenticação, bloqueio de captura e prévia de multitarefa em iPhone e Android; verificar acesso em aparelho com código configurado mas sem biometria.
- [ ] Com **dados inteiramente fictícios**, exportar backup cifrado, confirmar que foi salvo fora do app, restaurar em instalação limpa e via botão de restauração no onboarding, inclusive após reinstalação no iOS, com duas pessoas; verificar integridade, IDs, registros concluídos/inativos e pessoa ativa. Testar senha incorreta/arquivo danificado (nenhum dado atual deve mudar) e recriar lembretes. Sem esses testes nativos, não afirmar que há recuperação confiável.
- [ ] Validar em build nativa a migração transparente do banco SQLite anterior para SQLCipher, preservação dos registros, interrupção em cada fase de substituição, reaproveitamento do temporário cifrado, chave no armazenamento seguro e restauração do arquivo de recuperação persistente. O Android está configurado para excluir dados de backup automático; verificar e documentar o comportamento de backup do arquivo temporário no iOS.
- [ ] Com dados fictícios, testar a recuperação independente do banco quando a chave SQLCipher estiver ausente/incompatível: senha errada não deve alterar o arquivo original; backup válido deve criar, conferir e só então substituir o banco, inclusive após interrupção em cada fase. Confirmar também que os lembretes antigos são tratados e recriados.
- [ ] Substituir os campos em `PRIVACY_POLICY_DRAFT.md`, revisar o texto e disponibilizá-lo numa URL HTTPS pública e estável. Informar ao App Store Connect a URL da política e uma URL pública de suporte com meio de contato real.
- [ ] Revisar a declaração de App Privacy com base na build real: dados inseridos localmente, compartilhamento iniciado pelo usuário, backup cifrado exportado pelo sistema e bibliotecas instaladas. Não presumir automaticamente “nenhum dado coletado” sem verificar SDKs e fluxos.
- [ ] Reavaliar no App Store Connect a declaração de conformidade de exportação/criptografia: a build contém SQLCipher/AES para o banco e AES-GCM para backup exportado. O app não fixa `ITSAppUsesNonExemptEncryption` em `false`; responda ao questionário da Apple com a classificação correta e forneça documentação se necessário.
- [ ] Capturar telas reais do **novo app** com nomes, medicamentos, consultas e despesas totalmente fictícios. Conferir as dimensões aceitas para iPhone no App Store Connect; não usar capturas de dados de teste pessoais nem do alerta.
- [ ] Preencher descrição, subtítulo, palavras-chave, categoria, URLs, classificação etária, direitos e demais metadados exigidos, com linguagem de organização familiar (não fazer promessas clínicas). Rever a marca e o ícone.
- [ ] Na seção de revisão, marcar **sem login obrigatório** se a opção ainda estiver ativada: o app não tem conta. Informar ao revisor como iniciar com um perfil fictício e o propósito apenas organizacional das telas de medicamentos.
- [ ] Escolher exclusivamente a build corrigida para a versão 1.0, configurar distribuição **gratuita no Brasil** e liberação **manual após aprovação**.
- [ ] Fazer revisão final com o titular dos URLs, do contato e dos metadados. Só então enviar à App Review; após aprovação, confirmar separadamente a liberação manual.

## Texto de loja (rascunho a aprovar)

**Subtítulo sugerido:** Agenda e tarefas para a família

**Descrição sugerida:**

> Organize no seu iPhone as consultas, prazos e tarefas de cuidado de até duas pessoas da família. Anote gastos, registre onde encontrar documentos e mantenha uma lista informativa de medicamentos. Veja o que vem a seguir na tela Hoje e escolha exatamente o que incluir antes de compartilhar um resumo.
>
> Seus registros ficam no aparelho. O Ampara não cria conta nem sincroniza dados entre celulares. Você pode criar um backup protegido por senha e restaurá-lo quando precisar.
>
> O aplicativo ajuda a organizar informações fornecidas pela família. Não faz diagnósticos, não recomenda tratamentos, não calcula doses e não substitui profissionais de saúde ou serviços de emergência. Lembretes locais são auxiliares e podem não ser entregues pelo sistema operacional.

**Nota para a revisão (rascunho):** Sem login ou backend. No primeiro uso, cadastre uma pessoa fictícia para explorar as funções. O app exige a autenticação configurada no aparelho; não solicita conta do desenvolvedor. As telas de medicamentos apenas exibem anotações incluídas pelo usuário; não há dosagem, prescrição ou confirmação de administração. Não há sincronização entre aparelhos.

Confirmar cada afirmação do texto acima na build final antes de copiá-lo para a loja. Não preencher contatos, URLs ou declarações legais com valores inventados.
