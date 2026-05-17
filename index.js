const axios = require('axios');

// =========================================
// CONFIGURAÇÕES
// =========================================
const BASEROW_API_URL = process.env.BASEROW_API_URL || 'https://api.baserow.io';
const BASEROW_TOKEN = process.env.BASEROW_TOKEN;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

// IDs das tabelas
const SHELVES = {
  bebida: '150731',
  macarrao: '656122',
  pesado: '656123',
  frios: '656124',
  biscoito: '656126',
};

// Array para armazenar alertas
const alerts = [];

// =========================================
// VERIFICAR CONFIGURAÇÕES
// =========================================
function verificarConfiguracoes() {
  const erros = [];
  
  if (!BASEROW_TOKEN) {
    erros.push('❌ BASEROW_TOKEN não configurado!');
  }
  
  if (!DISCORD_WEBHOOK_URL) {
    erros.push('❌ DISCORD_WEBHOOK_URL não configurado!');
  }
  
  if (erros.length > 0) {
    console.error('\n🚨 ERROS DE CONFIGURAÇÃO:\n');
    erros.forEach(erro => console.error(erro));
    console.error('\n📝 Configure os secrets no GitHub:');
    console.error('   Settings → Secrets and variables → Actions → New repository secret\n');
    process.exit(1);
  }
  
  console.log('✅ Configurações validadas com sucesso!\n');
}

// =========================================
// FUNÇÃO PARA ENVIAR MENSAGEM NO DISCORD
// =========================================
async function enviarDiscord(mensagem) {
  try {
    await axios.post(DISCORD_WEBHOOK_URL, {
      content: mensagem,
      username: 'Sistema de Alertas 🤖',
    });
    console.log('✅ Mensagem enviada ao Discord com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem ao Discord:', error.message);
  }
}

// =========================================
// FUNÇÃO PARA ENVIAR NOTIFICAÇÃO PUSH (OPCIONAL)
// =========================================
async function enviarPush(titulo, mensagem) {
  try {
    // Aqui você pode adicionar integração com OneSignal, Firebase Cloud Messaging, etc.
    console.log(`📱 Push Notification: ${titulo} - ${mensagem}`);
  } catch (error) {
    console.error('❌ Erro ao enviar push:', error.message);
  }
}

// =========================================
// FUNÇÃO PARA CALCULAR DIAS ATÉ VENCIMENTO
// =========================================
function calcularDias(dataVencimento) {
  try {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const vencimento = new Date(dataVencimento);
    vencimento.setHours(0, 0, 0, 0);
    
    const diffTime = vencimento - hoje;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  } catch (error) {
    console.error('❌ Erro ao calcular dias:', error.message);
    return null;
  }
}

// =========================================
// FUNÇÃO PARA BUSCAR DADOS DA TABELA
// =========================================
async function buscarDadosTabela(tableId) {
  try {
    const response = await axios.get(
      `${BASEROW_API_URL}/api/database/rows/table/${tableId}/`,
      {
        headers: {
          'Authorization': `Token ${BASEROW_TOKEN}`,
        },
        params: {
          user_field_names: true,
          size: 200, // Buscar até 200 registros
        }
      }
    );
    
    return response.data.results || [];
  } catch (error) {
    console.error(`❌ Erro ao buscar dados da tabela ${tableId}:`, error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    return [];
  }
}

// =========================================
// FUNÇÃO PARA VERIFICAR TABELA
// =========================================
async function verificarTabela(nomeSetor, tableId) {
  try {
    console.log(`🔍 Verificando setor: ${nomeSetor.toUpperCase()} (ID: ${tableId})`);
    
    const items = await buscarDadosTabela(tableId);
    
    if (items.length === 0) {
      console.log(`   ⚠️  Nenhum item encontrado no setor ${nomeSetor}`);
      return;
    }
    
    console.log(`   📦 ${items.length} itens encontrados`);
    
    let alertasSetor = 0;
    
    for (const item of items) {
      // Adapte os nomes dos campos de acordo com sua tabela Baserow
      const vencimento = item.VENCIMENTO || item.vencimento || item.Vencimento;
      const produto = item.produto || item.Produto || item.PRODUTO || 'Sem nome';
      const quantidade = item.quantidade || item.Quantidade || item.QUANTIDADE || 0;
      
      if (!vencimento) continue;
      
      const dias = calcularDias(vencimento);
      
      if (dias === null) continue;
      
      let status = null;
      let emoji = '';
      
      if (dias === 0) {
        status = '🔥 VENCE HOJE';
        emoji = '🔥';
      } else if (dias < 0) {
        status = '🚨 PRODUTO VENCIDO';
        emoji = '🚨';
      } else if (dias <= 7) {
        status = '⚠️ VENCE EM 7 DIAS';
        emoji = '⚠️';
      } else if (dias <= 15) {
        status = '⚠️ VENCE EM 15 DIAS';
        emoji = '⚠️';
      } else if (dias <= 30) {
        status = '⚠️ VENCE EM 30 DIAS';
        emoji = '⚠️';
      }
      
      if (status) {
        alertasSetor++;
        const mensagem = `
${status}
🏪 Setor: ${nomeSetor.toUpperCase()}
📦 Produto: ${produto}
📦 Quantidade: ${quantidade}
📅 Vencimento: ${vencimento}
⏳ Dias restantes: ${dias}
━━━━━━━━━━━━━━━━━━
`;
        alerts.push(mensagem);
        
        // Enviar notificação push individual (opcional)
        await enviarPush(status, `${produto} - ${vencimento}`);
      }
    }
    
    console.log(`   ${alertasSetor > 0 ? '⚠️' : '✅'} ${alertasSetor} alertas encontrados\n`);
    
  } catch (error) {
    console.error(`❌ Erro ao verificar setor ${nomeSetor}:`, error.message);
  }
}

// =========================================
// FUNÇÃO PRINCIPAL
// =========================================
async function run() {
  try {
    console.log('\n🚀 SISTEMA DE ALERTAS DE VENCIMENTOS\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Verificar configurações
    verificarConfiguracoes();
    
    console.log(`📅 Data: ${new Date().toLocaleDateString('pt-BR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })}\n`);
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Verificar cada setor
    for (const [nome, tableId] of Object.entries(SHELVES)) {
      await verificarTabela(nome, tableId);
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Montar mensagem final
    let mensagemFinal = `
📦 **RELATÓRIO AUTOMÁTICO DE VENCIMENTOS**
📅 ${new Date().toLocaleDateString('pt-BR')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
    
    if (alerts.length === 0) {
      mensagemFinal += '\n✅ **Nenhum produto vencido ou próximo do vencimento!**\n\n🎉 Todos os produtos estão dentro do prazo de validade.';
    } else {
      mensagemFinal += `\n⚠️ **${alerts.length} ALERTA(S) ENCONTRADO(S):**\n`;
      mensagemFinal += alerts.join('\n');
    }
    
    mensagemFinal += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    
    // Enviar relatório ao Discord
    await enviarDiscord(mensagemFinal);
    
    console.log('📊 RESUMO FINAL:');
    console.log(`   ✅ Setores verificados: ${Object.keys(SHELVES).length}`);
    console.log(`   ⚠️  Alertas encontrados: ${alerts.length}`);
    console.log('\n✅ Verificação concluída com sucesso!\n');
    
  } catch (error) {
    console.error('\n❌ ERRO FATAL:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// =========================================
// EXECUTAR
// =========================================
run();
