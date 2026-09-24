---
name: Ampara Família
description: Uma visão serena e prática para organizar o cuidado em família.
colors:
  ink: "#263238"
  paper: "#F5F2EA"
  surface: "#FFFCF6"
  muted: "#65716B"
  border: "#DED9CE"
  forest: "#496B57"
  forest-soft: "#E7EEE7"
  clay: "#B9654B"
  clay-soft: "#F4E6DF"
  success: "#3F7155"
  warning: "#7D511F"
  danger: "#A84945"
typography:
  display:
    fontFamily: "System, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: "36px"
  body:
    fontFamily: "System, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "23px"
  label:
    fontFamily: "System, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: "20px"
rounded:
  sm: "10px"
  md: "14px"
  lg: "18px"
spacing:
  xs: "8px"
  sm: "14px"
  md: "20px"
  lg: "26px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    height: "56px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "54px"
---

# Design System: Ampara Família

## Norte criativo: “Cuidar sem carregar tudo na cabeça”

**Cena de uso:** um filho adulto revisa a agenda da mãe numa mesa de cozinha, à luz clara da manhã, antes de sair para o trabalho; precisa encontrar a próxima tarefa depressa e sentir que o cuidado está organizado, sem um painel hospitalar.

Uma paleta de papel quente, tinta mineral, verde de percurso e argila discreta separa o produto de códigos clínicos frios. A cor indica ação, seleção e estado, não decoração. Superfícies simples, bordas suaves e sistema tipográfico nativo dão familiaridade e boa leitura.

## Intenção de cor

As cores são escolhidas em OKLCH; `src/theme.ts` mantém seus equivalentes sRGB hexadecimais para compatibilidade com os componentes nativos do React Native.

- Papel: `oklch(0.961 0.011 89.7)` → `#F5F2EA`
- Superfície: `oklch(0.992 0.009 84.6)` → `#FFFCF6`
- Tinta: `oklch(0.309 0.019 229.8)` → `#263238`
- Texto secundário: `oklch(0.537 0.017 164.3)` → `#65716B`
- Verde de ação: `oklch(0.495 0.051 158.1)` → `#496B57`
- Argila de apoio: `oklch(0.598 0.115 38.0)` → `#B9654B`
- Aviso acessível: `oklch(0.474 0.087 66.0)` → `#7D511F`

## Hierarquia

- Título de tela: 30/36, peso 700.
- Título de seção: 20/26, peso 700.
- Corpo: 16/23, peso 400.
- Label: 14/20, peso 600.
- Metadados: 13/18, contraste suficiente e sem ser a única fonte de informação.

## Superfícies e componentes

- Fundo papel `#F5F2EA`; superfície de conteúdo `#FFFCF6`; tinta `#263238`.
- Verde `#496B57` para a ação primária e estado selecionado; argila `#B9654B` para um acento raro.
- Bordas de 1px e mudanças tonais antes de sombras.
- Ações principais com altura mínima de 56px; controles interativos com alvo de pelo menos 44px.
- Listas e divisores para informação repetida; reservar superfícies distintas para o próximo compromisso e conteúdo que precise de foco. Evitar cartões repetidos e cartão dentro de cartão.
- Ícones nativos apenas quando ajudam a reconhecer a ação, sempre acompanhados de label quando o significado puder ser ambíguo.

## Acessibilidade e movimento

Usar labels persistentes, ordem de leitura lógica, papéis acessíveis e estados textuais. Não comunicar urgência apenas com vermelho. Animação não é necessária para entender a interface; transições devem ser curtas e respeitar redução de movimento.
