const axios = require('axios');

// =========================================
// CONFIGURAÇÕES
// =========================================

const SHELVES = {
  bebida: '150731',
  macarrao: '656122',
  pesado: '656123',
  frios: '656124',
  biscoito: '656126',
};

// TOKEN BASEROW
const TOKEN = 'SEU_TOKEN_BASEROW';

// WEBHOOK DISCORD
const DISCORD_WEBHOOK = 'SEU_WEBHOOK_DISCORD';

// FIREBASE SERVER KEY
const FIREBASE_SERVER_KEY = 'SUA_FIREBASE_SERVER_KEY';

// TOKEN DO APP
const APP_TOKEN = 'TOKEN_DO_DISPOSITIVO';

const alerts = [];

// =========================================
// CALCULAR DIAS
// =========================================

function calcularDias(vencimento) {

  if (!vencimento) return null;

  const partes = vencimento.split('/');

  if (partes.length !== 3) return null;

  const dia = parseInt(partes[0]);
  const mes = parseInt(partes[1]) - 1;
  const ano = parseInt(partes[2]);

  const dataVencimento = new Date(ano, mes, dia);

  const hoje = new Date();

  hoje.setHours(0,0,0,0);
  dataVencimento.setHours(0,0,0,0);

  const diff = dataVencimento - hoje;

  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// =========================================
// ENVIAR DISCORD
// =========================================

async function enviarDiscord(mensagem) {

  try {

    await axios.post(DISCORD_WEBHOOK, {

      username: 'GEI - Controle Estoque',

      avatar_url: 'https://cdn-icons-png.flaticon.com/512/3081/3081559.png',

      content: mensagem
    });

  } catch (error) {

    console.log('Erro Discord:', error.message);
  }
}

// =========================================
// ENVIAR PUSH APP
// =========================================

async function enviarPush(titulo, mensagem) {

  try {

    await axios.post(
      'https://fcm.googleapis.com/fcm/send',
      {
        to: APP_TOKEN,

        notification: {
          title: titulo,
          body: mensagem,
          sound: 'default'
        },

        priority: 'high'
      },
      {
        headers: {
          Authorization: `key=${FIREBASE_SERVER_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {

    console.log('Erro Push:', error.message);
  }
}

// =========================================
// VERIFICAR TABELA
// =========================================

async function verificarTabela(nomeSetor, tableId) {

  try {

    const response = await axios.get(
      `https://api.baserow.io/api/database/rows/table/${tableId}/?user_field_names=true`,
      {
        headers: {
          Authorization: `Token ${TOKEN}`
        }
      }
    );

    const registros = response.data.results;

    for (const item of registros) {

      if (!item.VENCIMENTO) continue;

      const dias = calcularDias(item.VENCIMENTO);

      if (dias === null) continue;

      let status = '';

      if (dias === 0) {

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

        // PUSH APP
        await enviarPush(
          status,
          `${item.produto} - ${item.VENCIMENTO}`
        );
      }
    }

  } catch (error) {

    alerts.push(`
❌ ERRO NO SETOR: ${nomeSetor}

${error.message}

━━━━━━━━━━━━━━━━━━
`);
  }
}

// =========================================
// EXECUÇÃO PRINCIPAL
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
