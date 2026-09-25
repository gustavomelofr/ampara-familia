# Política de privacidade — Ampara Família (rascunho)

> **Não publicar sem substituir os campos em colchetes, revisar juridicamente e confirmar o comportamento da build final.** Esta página ainda não é uma URL pública para a App Store.

**Responsável e contato:** [NOME DO RESPONSÁVEL OU EMPRESA] · [EMAIL DE SUPORTE]

## Dados no aparelho

O Ampara Família organiza, no próprio aparelho, os nomes das pessoas acompanhadas e as informações que o usuário decidir registrar: compromissos, tarefas, gastos, localização de documentos e anotações informativas sobre medicamentos. O aplicativo não exige conta, não sincroniza esses registros entre aparelhos e não envia automaticamente essas informações para um servidor do desenvolvedor. Não há anúncios nem ferramentas de análise de terceiros integradas nesta versão.

Os lembretes são agendados localmente pelo sistema operacional. Eles são auxiliares e não confirmam que uma consulta ou atividade ocorreu. O aplicativo não oferece diagnóstico, prescrição, cálculo de doses ou orientação médica.

## Acesso e compartilhamento

No iOS e Android, o acesso pela interface exige autenticação do aparelho (Face ID, Touch ID ou código de desbloqueio). O banco local usa SQLCipher e a chave aleatória fica no armazenamento seguro do sistema, protegida enquanto o aparelho está bloqueado. O app também bloqueia capturas de tela e aplica proteção às prévias de multitarefa compatíveis com o sistema operacional. Essas configurações ainda precisam ser validadas na build final, inclusive na recuperação e migração dos dados já existentes.

O usuário pode visualizar uma prévia e escolher as seções de um resumo antes de abrir a folha de compartilhamento do sistema. Nada é enviado pelo Ampara automaticamente. Ao escolher outro aplicativo ou serviço para compartilhar, o tratamento dos dados passa a depender do destino escolhido.

## Exportação e restauração

O usuário pode criar um arquivo de backup cifrado com AES-256-GCM, usando uma senha definida por ele. O app não armazena nem recupera essa senha. O arquivo é entregue à opção escolhida na folha de compartilhamento do sistema; o desenvolvedor não recebe uma cópia. O usuário deve confirmar que guardou o arquivo e a senha em locais seguros e distintos. Restaurar um arquivo substitui os registros atuais após confirmação; há também um fluxo separado de recuperação se o banco cifrado não puder ser aberto. Os lembretes do arquivo devem ser recriados manualmente. O arquivo e o banco local usam mecanismos de proteção distintos.

Durante a migração de uma versão antiga, o banco original pode permanecer temporariamente como arquivo técnico de recuperação na pasta privada do app até que a nova versão cifrada seja reaberta e validada. Esse arquivo não usa a senha do backup nem é uma cópia pessoal escolhida pelo usuário. Cópias de arquivos do app mantidas em serviços de backup do dispositivo devem ser geridas pelo usuário.

## Exclusão e retenção

Os registros permanecem no dispositivo até que o usuário os exclua pelo aplicativo, desinstale o app ou restaure outro backup. A seção **Dados e privacidade** oferece uma ação para apagar os perfis e registros locais. Cópias exportadas, compartilhadas ou mantidas por backups do sistema devem ser geridas separadamente nos respectivos destinos.

## Solicitações e atualizações

Para dúvidas sobre privacidade, entre em contato pelo endereço [EMAIL DE SUPORTE]. Esta política poderá ser atualizada quando o funcionamento do app mudar; a data da revisão publicada deve ser indicada abaixo.

**Última revisão:** [DATA DE PUBLICAÇÃO]
