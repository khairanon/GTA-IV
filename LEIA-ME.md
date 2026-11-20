# Pink Finance — app de finanças pessoais (PWA para Android)

Aplicativo web instalável (PWA), feito para o Chrome do Samsung Galaxy S26. Depois de instalado, ele ganha ícone na tela inicial, abre em tela cheia, funciona offline e envia notificações.

## Como colocar no celular (uma vez só)

Um PWA precisa estar num endereço **HTTPS** para ser instalado. Escolha uma das opções gratuitas:

**Opção A — Netlify Drop (mais rápida, pelo computador)**
1. Descompacte o `pinkfinance.zip`.
2. Acesse https://app.netlify.com/drop e arraste a pasta `pinkfinance` para a página.
3. Crie a conta gratuita quando for pedido, para o endereço não expirar.
4. Abra o endereço gerado (`https://algum-nome.netlify.app`) no **Chrome do Galaxy**.

**Opção B — GitHub Pages**
1. Crie um repositório e envie o conteúdo da pasta `pinkfinance`.
2. Em Settings → Pages, publique a branch principal.
3. Abra `https://seu-usuario.github.io/nome-do-repo/` no Chrome do Galaxy.

**Instalar:** no Chrome, toque em ⋮ → **Adicionar à tela inicial** → **Instalar**.
Depois, em Perfil → Notificações, ative os lembretes. Em Perfil → Segurança, crie o PIN e ative a biometria.

> Dica: em Configurações → Aplicativos → Chrome → Bateria, deixe "Sem restrições" para os lembretes em segundo plano chegarem com mais regularidade.

## O que tem no app

- **Início**: saldo total (com botão de ocultar), patrimônio líquido, recebido/gasto no mês, investido, guardado em metas, próximos vencimentos, metas, orçamento e 5 gráficos (categorias, entradas × saídas, patrimônio, gastos mensais, bancos).
- **Contas**: Mercado Pago, Nubank e Viacredi já cadastrados, com saldo individual e total, entradas e saídas, histórico, cartão de crédito (limite, faturas abertas e pagas, fechamento e vencimento), transferências, ajuste de saldo e contas novas.
- **Movimentações**: receitas, despesas e transferências com categoria, data, banco, forma de pagamento, recorrência e observações. Pesquisa, filtros por período, tipo, categoria, banco e forma de pagamento. Edição, duplicação e exclusão.
- **Metas**: valor desejado, acumulado, prazo, contribuição mensal, dia do aporte, categoria, ícone ou imagem. Calcula quanto guardar por mês e a previsão no seu ritmo.
- **Desafios e conquistas**: XP, 5 níveis (Iniciante → Mestre das Finanças), 12 medalhas, 4 desafios, sequência de dias, calendário de atividade e histórico de XP. O XP tem limite diário e nunca premia gastar ou investir mais.
- **Perfil**: investimentos (aplicação, aporte, resgate proporcional, atualização de valor, rentabilidade, liquidez, vencimento, objetivo e lembretes), contas a pagar com status por cores e lembretes de 7, 3, 1 dia e no dia, calendário financeiro, orçamento com alertas de 70, 90 e 100%, relatórios mensal e anual com exportação para **PDF** e **Excel**, importação de extrato **CSV/OFX**, backup e restauração, PIN e biometria, tema claro ou escuro.

## Como os cálculos funcionam

- Valores guardados em centavos inteiros, sem erro de arredondamento.
- Compra no **crédito** não mexe no saldo da conta: ela entra na fatura e conta como gasto na data da compra. O **pagamento da fatura** reduz o saldo, mas não é contado de novo como despesa.
- **Transferências**, aportes em metas e aplicações movem dinheiro entre lugares. Elas não viram receita nem despesa, e o patrimônio não muda.
- Patrimônio líquido = saldos das contas + investimentos + metas − faturas de cartão em aberto.
- Lançamentos com data futura aparecem como "agendado" e só entram no saldo no dia.

## Dados de exemplo
Na primeira abertura você escolhe entre explorar com exemplos ou começar do zero. Os exemplos ficam marcados e podem ser apagados em Perfil → Dados de exemplo, sem afetar o que você cadastrou.

## Limitações honestas de um PWA
- **Notificações em segundo plano**: com o app fechado, quem decide quando verificar é o Chrome (intervalo mínimo de cerca de 12h). Com o app aberto, os lembretes saem na hora.
- **Open Finance**: sincronização bancária automática exige servidor próprio e contrato com um provedor autorizado pelo Banco Central. Por isso esta versão usa lançamento manual e importação de extratos. O app nunca pede senha de banco.
- **Armazenamento**: os dados ficam só no aparelho, no armazenamento do Chrome. Faça backup de vez em quando (Perfil → Backup).
- O PIN protege a abertura do app, mas os dados não ficam criptografados. Mantenha também o bloqueio de tela do celular.

## Estrutura do código
```
index.html, styles.css, manifest.webmanifest, sw.js, icons/
js/core.js      utilidades, dinheiro, datas, estado e cálculos (saldos, faturas, patrimônio)
js/game.js      XP, níveis, conquistas, desafios, sequência
js/sample.js    dados de exemplo (removíveis)
js/ui.js        avisos, folhas, formulários, gráficos SVG
js/actions.js   operações: lançar, transferir, pagar, metas, investimentos
js/screens*.js  telas
js/system.js    PIN/biometria, notificações, importação CSV/OFX, PDF e XLSX nativos, backup
js/app.js       roteador, ações de interface, inicialização
```
Não usa bibliotecas externas nem servidor e funciona 100% offline.
