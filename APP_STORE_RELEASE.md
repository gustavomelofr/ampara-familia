# Ampara Família — simplificação e App Store

**Estado:** Gustavo confirmou que a ponte **1.0 (10.1)** migrou os aparelhos e preservou os registros. O código final SQLite-only está no commit `9d1b983`; SQLCipher está desativado no config nativo iOS/Android, o banco é validado antes de qualquer migração e as chaves SQLCipher antigas são removidas somente após validação. A build final **1.0 (11.1)** foi enviada ao TestFlight, está pronta para teste e foi anexada ao rascunho da versão na App Store; ainda não há instalações registradas da 11.1.

**App Store Connect:** subtítulo, descrição, palavras-chave, notas, Copyright e contato da revisão salvos; “Início de sessão obrigatório” desmarcado. A declaração “Dados não coletados” foi publicada e as URLs públicas de política e suporte estão cadastradas. Categoria **Estilo de vida**, classificação **+4**, direitos de conteúdo sem terceiros, preço gratuito e disponibilidade somente no Brasil. A build 11.1 está anexada ao rascunho, mas faltam capturas da build final. Nada foi submetido à App Review.

## Plano em duas builds

### Build-ponte TestFlight

- [x] Remover Face ID/código próprio, bloqueio de captura, telas de backup/restauração e respetivos textos/dependências no código-ponte.
- [x] Manter SQLCipher invisível apenas para abrir 8.1 e migrar, no mesmo aparelho, a base completa para SQLite local sem SQLCipher.
- [x] Em dispositivos com base 7.1 em SQLite simples, manter os dados e atualizar o esquema normalmente.
- [x] Não substituir a base até comparar esquema, IDs, linhas, pessoa ativa, `sqlite_sequence` e integridade; manter a origem cifrada até reabrir e conferir a base simples.
- [x] Distribuir **somente pelo TestFlight**; não submeter à App Review ainda.
- [x] Gustavo confirmou instalação da ponte sobre a versão existente e conferência dos registros nos aparelhos controlados.
- [x] Corrigir a splash nativa para ocultá-la depois que o layout React renderizar; manter o feedback de carregamento/erro visível durante a abertura do banco.

### Build final SQLite-only

- [x] Após confirmar a migração em todos os aparelhos, remover o plugin/biblioteca SQLCipher e eliminar as chaves SQLCipher antigas do SecureStore após validar o SQLite. Arquivos inválidos ou ainda cifrados falham sem sobrescrita nem criação silenciosa de base vazia.
- [x] Não oferecer backup/restauração nem sincronização; avisar que limpar dados ou desinstalar pode apagar os registros.
- [x] Gerar e enviar ao TestFlight a build final SQLite-only **1.0 (11.1)**.
- [ ] Instalar 11.1 como atualização, sem desinstalar, e confirmar abertura e dados em dispositivo real.
- [ ] Confirmar que o alerta `Expo Head` continua ausente na build final.

## Requisitos da App Store (continuam obrigatórios)

- [x] Publicar política de privacidade em HTTPS: https://gustavomelofr.github.io/ampara-legal/privacidade.html (contato: `gustavodemelo34@gmail.com`; última revisão: 28/09/2026).
- [x] Publicar URL pública de suporte em HTTPS: https://gustavomelofr.github.io/ampara-legal/suporte.html.
- [x] Inserir e salvar a URL da política de privacidade no App Store Connect.
- [x] Salvar a URL de suporte na versão 1.0 e completar o contato de revisão (Gustavo de Melo Ferreira, `gustavodemelo34@gmail.com`, telefone fornecido).
- [x] Definir categoria primária **Estilo de vida**, classificação etária **+4** e declarar que o app não contém conteúdo de terceiros.
- [x] Definir preço gratuito (R$ 0,00 como preço de referência; tabela atualizada para 175 países/regiões) e disponibilidade somente no Brasil.
- [ ] Capturar telas da **build final** com informações inteiramente fictícias e dimensões aceitas no App Store Connect.
- [x] Salvar Copyright e revisar descrição, subtítulo, palavras-chave e notas de revisão.
- [x] Publicar a declaração App Privacy “Dados não coletados” e responder à conformidade de exportação para a build final 11.1 (sem algoritmos de criptografia implementados pelo app).
- [x] Anexar somente a build final 11.1 ao rascunho, com preço gratuito no Brasil e lançamento manual após aprovação.
- [ ] Submeter à App Review somente depois de instalar/testar a 11.1 e carregar capturas da build final.

## Texto de loja (rascunho)

**Subtítulo sugerido:** Agenda e tarefas para a família

**Descrição sugerida:**

> Organize neste aparelho as consultas, prazos e tarefas de cuidado de até duas pessoas da família. Anote gastos, registre onde encontrar documentos e mantenha uma lista informativa de medicamentos. Veja o que vem a seguir na tela Hoje e escolha exatamente o que incluir antes de compartilhar um resumo.
>
> O Ampara não cria conta nem sincroniza dados entre celulares. Os registros ficam neste aparelho e podem ser perdidos se o app for desinstalado ou se os dados forem apagados. Esta versão não oferece backup próprio.
>
> O aplicativo ajuda a organizar informações fornecidas pela família. Não faz diagnósticos, não recomenda tratamentos, não calcula doses e não substitui profissionais de saúde ou serviços de emergência. Lembretes locais são auxiliares e podem não ser entregues pelo sistema operacional.

Confirmar o texto com a build final. Não inventar URL, contato nem declaração legal.
