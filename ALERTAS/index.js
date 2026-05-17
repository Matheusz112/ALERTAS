const axios = require('axios');

        status = '🔥 VENCE HOJE';
      }
      else if (dias < 0) {

        status = '🚨 PRODUTO VENCIDO';
      }
      else if (dias <= 7) {

        status = '⚠️ VENCE EM 7 DIAS';
      }
      else if (dias <= 15) {

        status = '⚠️ VENCE EM 15 DIAS';
      }
      else if (dias <= 30) {

        status = '⚠️ VENCE EM 30 DIAS';
      }

      if (status) {

        const mensagem = `
${status}

🏪 Setor: ${nomeSetor}
📦 Produto: ${item.produto || 'Sem nome'}
📦 Quantidade: ${item.quantidade || 0}
📅 Vencimento: ${item.VENCIMENTO}
⏳ Dias restantes: ${dias}

━━━━━━━━━━━━━━━━━━
`;

        alerts.push(mensagem);

        await enviarPush(
          status,
          `${item.produto} - ${item.VENCIMENTO}`
        );
      }
    }

  } catch (error) {

    console.log(error.message);
  }
}

// =========================================
// EXECUÇÃO
// =========================================

async function run() {

  for (const [nome, tableId] of Object.entries(SHELVES)) {

    await verificarTabela(nome, tableId);
  }

  let mensagemFinal = `
📦 RELATÓRIO AUTOMÁTICO DE VENCIMENTOS
📅 ${new Date().toLocaleDateString('pt-BR')}

━━━━━━━━━━━━━━━━━━
`;

  if (alerts.length === 0) {

    mensagemFinal += '\n✅ Nenhum produto vencido ou próximo do vencimento.';
  }
  else {

    mensagemFinal += alerts.join('\n');
  }

  await enviarDiscord(mensagemFinal);

  console.log(mensagemFinal);
}

run();