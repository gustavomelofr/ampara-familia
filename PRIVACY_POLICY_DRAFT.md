# Política de privacidade — Ampara Família (rascunho)

> **Não publicar sem substituir os campos em colchetes, revisar juridicamente e confirmar o comportamento da build final.** Esta página ainda não é uma URL pública para a App Store.

**Responsável e contato:** [NOME DO RESPONSÁVEL OU EMPRESA] · [EMAIL DE SUPORTE]

## Dados no aparelho

O Ampara Família organiza, no próprio aparelho, os nomes das pessoas acompanhadas e as informações que o usuário decidir registrar: compromissos, tarefas, gastos, localização de documentos e anotações informativas sobre medicamentos. O aplicativo não exige conta, não sincroniza esses registros entre aparelhos e não envia automaticamente essas informações para um servidor do desenvolvedor. Não há anúncios nem ferramentas de análise de terceiros integradas nesta versão.

Os lembretes são agendados localmente pelo sistema operacional. Eles são auxiliares e não confirmam que uma consulta ou atividade ocorreu. O aplicativo não oferece diagnóstico, prescrição, cálculo de doses ou orientação médica.

## Acesso e compartilhamento

O app não exige Face ID, Touch ID nem código próprio para abrir. O usuário deve manter o bloqueio de tela do aparelho ativo; o app não bloqueia capturas de tela nem garante ocultar a prévia nas telas recentes. Nesta versão simplificada, os registros ficam em SQLite local sem criptografia SQLCipher pelo Ampara. Uma versão-ponte mantém temporariamente suporte a SQLCipher apenas para migrar, no mesmo aparelho, os registros cifrados da versão 8.1 para SQLite.

O usuário pode visualizar uma prévia e escolher as seções de um resumo antes de abrir a folha de compartilhamento do sistema. Nada é enviado pelo Ampara automaticamente. Ao escolher outro aplicativo ou serviço para compartilhar, o tratamento dos dados passa a depender do destino escolhido.

## Backup, restauração e perda do aparelho

Esta versão não oferece backup ou restauração próprios e não sincroniza registros entre aparelhos. Se desinstalar o app, limpar os dados do aparelho ou trocar de dispositivo, os registros podem ser perdidos. As atualizações devem ser instaladas no mesmo aparelho sem desinstalar a versão existente.

Durante a migração da versão 8.1, o banco SQLCipher original pode permanecer temporariamente como arquivo técnico de recuperação na pasta privada do app até a conferência do banco SQLite. Essa cópia não é um backup selecionável pelo usuário. Depois da migração, os novos registros são armazenados sem criptografia SQLCipher pelo Ampara.

## Exclusão e retenção

Os registros permanecem no dispositivo até que o usuário os exclua pelo aplicativo, remova o app ou limpe os dados do sistema. A seção **Dados e privacidade** oferece uma ação para apagar os perfis e registros locais. Resumos compartilhados manualmente passam a ser tratados pelo aplicativo ou serviço escolhido como destino.

## Solicitações e atualizações

Para dúvidas sobre privacidade, entre em contato pelo endereço [EMAIL DE SUPORTE]. Esta política poderá ser atualizada quando o funcionamento do app mudar; a data da revisão publicada deve ser indicada abaixo.

**Última revisão:** [DATA DE PUBLICAÇÃO]
