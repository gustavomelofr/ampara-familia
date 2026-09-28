# Ampara Família — simplificação e App Store

**Estado:** build-ponte **1.0 (9.1)** enviada ao TestFlight pelo workflow `36436758125`; confirmar processamento e instalar em todos os aparelhos controlados antes da versão final. A build anterior 8.1 contém SQLCipher e dados cifrados. Não enviar uma build SQLite-only diretamente a aparelhos que ainda tenham esses dados.

**Rascunho no App Store Connect:** salvei o subtítulo, descrição, palavras-chave e notas de revisão simplificadas; desmarquei “Início de sessão obrigatório” e deixei selecionado “Não coletamos dados” como rascunho. Não publiquei essa declaração nem submeti a versão à App Review; revisar tudo contra a build final.

## Plano em duas builds

### Build-ponte TestFlight

- [x] Remover Face ID/código próprio, bloqueio de captura, telas de backup/restauração e respetivos textos/dependências no código-ponte.
- [ ] Manter SQLCipher invisível apenas para abrir 8.1 e migrar, no mesmo aparelho, a base completa para SQLite local sem SQLCipher.
- [ ] Em dispositivos com base 7.1 em SQLite simples, manter os dados e atualizar o esquema normalmente.
- [ ] Não substituir a base até comparar esquema, IDs, linhas, pessoa ativa, `sqlite_sequence` e integridade; manter a origem cifrada até reabrir e conferir a base simples.
- [ ] Distribuir **somente pelo TestFlight**; não submeter à App Review ainda.
- [ ] Instalar a ponte sobre a 8.1 em todos os aparelhos controlados, sem desinstalar. Usar dados fictícios e conferir as sete tabelas de usuário, os dois perfis, IDs/sequências, itens concluídos/inativos, perfil ativo e lembretes.

### Build final SQLite-only

- [ ] Só depois de confirmar em cada aparelho que a ponte abriu todos os registros, criar outra build removendo o plugin/biblioteca SQLCipher e SecureStore relacionado à chave. Manter no código um erro não destrutivo para arquivos não migrados; nunca criar silenciosamente uma base vazia.
- [ ] Não prometer recuperação ao desinstalar ou trocar de aparelho: esta versão não terá backup/restauração nem sincronização. Avisar que limpar dados ou desinstalar pode apagar os registros.
- [ ] Repetir os testes em dispositivo real e confirmar que o alerta `Expo Head` continua ausente.

## Requisitos da App Store (continuam obrigatórios)

- [ ] Publicar a política de privacidade em URL HTTPS estável, preenchendo responsável, contato e data em `PRIVACY_POLICY_DRAFT.md`.
- [ ] Fornecer URL pública de suporte e um e-mail de contato real.
- [ ] Definir a categoria, classificação etária e direitos de conteúdo da listagem; a categoria e a classificação ainda não estão concluídas no App Store Connect.
- [ ] Capturar telas da **build final** com informações inteiramente fictícias e dimensões aceitas no App Store Connect.
- [ ] Completar descrição, subtítulo, palavras-chave, categoria, classificação etária, direitos, URLs e notas de revisão sem promessas clínicas.
- [ ] Revisar App Privacy e responder ao questionário de exportação/criptografia de acordo com a build final. Não reutilizar as declarações antigas de SQLCipher/AES sem revisão.
- [ ] Selecionar apenas a build final, configurar gratuita no Brasil e liberação manual após aprovação. Enviar à App Review somente depois dos itens acima.

## Texto de loja (rascunho)

**Subtítulo sugerido:** Agenda e tarefas para a família

**Descrição sugerida:**

> Organize neste aparelho as consultas, prazos e tarefas de cuidado de até duas pessoas da família. Anote gastos, registre onde encontrar documentos e mantenha uma lista informativa de medicamentos. Veja o que vem a seguir na tela Hoje e escolha exatamente o que incluir antes de compartilhar um resumo.
>
> O Ampara não cria conta nem sincroniza dados entre celulares. Os registros ficam neste aparelho e podem ser perdidos se o app for desinstalado ou se os dados forem apagados. Esta versão não oferece backup próprio.
>
> O aplicativo ajuda a organizar informações fornecidas pela família. Não faz diagnósticos, não recomenda tratamentos, não calcula doses e não substitui profissionais de saúde ou serviços de emergência. Lembretes locais são auxiliares e podem não ser entregues pelo sistema operacional.

Confirmar o texto com a build final. Não inventar URL, contato nem declaração legal.
