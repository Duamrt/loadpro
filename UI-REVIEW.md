# LoadPro -- Auditoria Mobile UI

**Auditada:** 2026-03-28
**Baseline:** Padroes abstratos de 6 pilares (sem UI-SPEC.md)
**Screenshots:** Nao capturados (sem dev server ativo)
**Foco:** Responsividade mobile e usabilidade em telas pequenas

---

## Pillar Scores

| Pilar | Score | Achado Principal |
|-------|-------|------------------|
| 1. Copywriting | 3/4 | Copy em portugues consistente, CTAs claros, empty states presentes |
| 2. Visuals | 2/4 | Agenda 7 colunas ilegivel no mobile, chat 50/50 split inutilizavel |
| 3. Color | 3/4 | Design system coerente via CSS vars, sem cores hardcoded nos componentes |
| 4. Typography | 3/4 | Escala tipografica enxuta e consistente, h1 mobile reduzido |
| 5. Spacing | 2/4 | Muitos valores arbitrarios inline, padding insuficiente em telas <375px |
| 6. Experience Design | 2/4 | Touch targets abaixo de 48px, modais com grid inutilizavel no mobile, sem confirmacao destrutiva |

**Overall: 15/24**

---

## Top 3 Priority Fixes

1. **Agenda 7 colunas no mobile** -- Grid repeat(7,1fr) fica com colunas de ~45px em tela de 375px, texto e botoes ficam ilegiveis e intocaveis -- Trocar para layout de lista vertical ou scroll horizontal no @media (max-width: 768px), mostrando 1 dia por vez ou lista empilhada
2. **Chat split 50/50 no mobile** -- grid-2 com height:calc(100vh - 140px) no mobile vira 2 paineis empilhados -- Implementar padrao master-detail: mobile mostra so lista, ao clicar mostra so conversa com botao de voltar
3. **Touch targets abaixo de 48px** -- Botoes de deletar horario na agenda (12x12px), serie-check no treino do aluno (36x36px), meal-check na dieta (28x28px), modal-close (padding 4px), tabs da ficha do aluno (~38px) -- Aumentar todos para minimo 44x44px (ideal 48px)

---

## Detailed Findings

### Pilar 1: Copywriting (3/4)

**Positivo:**
- CTAs especificos e orientados a acao: "Comecar 7 dias gratis", "Salvar e Convidar", "Iniciar Treino", "Finalizar Treino"
- Empty states com mensagens contextuais: "Nenhum aluno encontrado" com acao de cadastro, "Sem treino programado para hoje. Descanse!"
- Erro de login traduzido: "Email ou senha incorretos" em vez do original do Supabase
- Copy da landing coerente com o publico: "Chega de ficha de papel, planilha e 500 mensagens no WhatsApp"

**Problemas menores:**
- login.html:91 -- mensagem de erro generica err.message cai no fallback
- personal/agenda.html:128 -- "Horario adicionado!" poderia dizer qual aluno/dia
- aluno/treino.html:307 -- toast de finalizacao mostra "series" (tecnico)

### Pilar 2: Visuals (2/4)

**CRITICO -- Agenda 7 colunas:**
- personal/agenda.html:20 -- grid-template-columns:repeat(7,1fr) sem breakpoint mobile
- Em 375px: cada coluna ~45px, texto truncado, botao deletar 12x12px impossivel de tocar
- css/style.css:270 -- .grid-2,.grid-3,.grid-4 cai pra 1fr mas grid inline da agenda nao e afetado

**CRITICO -- Chat split layout:**
- personal/chat.html:24 -- grid-2 com height calc no mobile vira 2 paineis empilhados
- Sem padrao master-detail com navegacao entre paineis

**Problemas visuais mobile:**
- personal/exercicios.html:18 -- header search+2selects+botao empilha 4 linhas
- personal/alunos.html:18-32 -- search+select+botao empilha desorganizado
- personal/aluno-detalhe.html:35-43 -- 7 tabs scroll horizontal sem indicador
- personal/configuracoes.html:149-165 -- checkbox+4 time inputs+vagas: time inputs minusculos

**Hierarquia visual -- OK:**
- Dashboard personal: KPIs 2rem, cards claros
- Dashboard aluno: treino com borda primaria, stats grid-2, agua progress bar
- Landing: hero h1 3.5rem (2.2rem mobile)

### Pilar 3: Color (3/4)

**Positivo:**
- Design system completo em CSS vars (css/style.css:8-36)
- Paleta: --primary #f97316, semanticas success/warning/danger
- Accent com moderacao

**Problemas menores:**
- aluno/dashboard.html:53-54 -- cor azul #3b82f6 hardcoded inline, fora do design system
- Falta variavel --info ou --blue

### Pilar 4: Typography (3/4)

**Escala:** 16 tamanhos (de .7rem a 3.5rem), concentrados .8rem-1rem
**Pesos:** 400,500,600,700,800,900 em uso

**Problemas:**
- css/style.css:87 -- .form-control font-size .9rem (14.4px) -- iOS zoom automatico (precisa 16px)
- personal/configuracoes.html:157 -- time inputs .85rem (13.6px)
- aluno/dieta.html:22-25 -- labels macros .7rem (11.2px) muito pequeno

### Pilar 5: Spacing (2/4)

**Inline styles excessivos:** 100+ ocorrencias de spacing inline
**Valores sem escala:** padding 20/24/32/40px, mb 8/12/16/20/24px, gap 8/10/12/16/20/24px

**Problemas mobile:**
- css/style.css:278 -- .modal margin 10px no 480px insuficiente para modais grandes
- personal/medidas.html:106-118 -- grid-3 de 12 campos circunferencia dentro de modal
- personal/dieta.html:117 -- grid-4 macros no modal refeicao

### Pilar 6: Experience Design (2/4)

**Touch targets abaixo do minimo (48px):**
- personal/agenda.html:110 -- deletar: icone 12x12px = ~20px
- aluno/treino.html:12 -- .serie-check 36x36px
- aluno/dieta.html:11 -- .meal-check 28x28px
- css/style.css:186 -- .modal-close padding 4px = ~32px
- css/style.css:194 -- .tab padding 10px 20px = ~38px

**Loading states -- bom:** Skeletons + spinners presentes
**Error states -- parcial:** Auth com alert, toast CRUD, falta fallback global
**Empty states -- bom:** Em todas as listagens com icone+titulo+descricao+acao
**Confirmacao destrutiva -- AUSENTE:** deletarHorario() sem confirm

**Form usability:** .form-control 14.4px causa zoom iOS
**Navegacao:** Personal sidebar, Aluno bottom-nav, Admin sidebar -- todos corretos

---

## Files Audited

**CSS:** css/style.css (380 linhas) | **JS:** js/sidebar.js

**Personal (11):** dashboard, alunos, aluno-detalhe, exercicios, treinos, dieta, medidas, agenda, chat, configuracoes, admin

**Aluno (5):** dashboard, treino, dieta, medidas, perfil

**Auth (3):** login, cadastro, recuperar | **Landing:** index.html

---

## Recomendacoes Adicionais

4. **Font-size inputs 16px mobile** -- css/style.css:87
5. **meal-check e serie-check para 44px** -- aluno/dieta.html:11, aluno/treino.html:12
6. **modal-close padding 12px** -- css/style.css:186
7. **Confirmacao deletar** -- personal/agenda.html:132
8. **Horarios trabalho empilhado mobile** -- personal/configuracoes.html:149
9. **Inline styles para classes** -- reduzir 100+ style= para classes utilitarias
10. **Landing nav z-index** -- css/style.css:377
