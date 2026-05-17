const admin = require('firebase-admin');
const axios = require('axios');

// =========================================
// CONFIGURAÇÕES
// =========================================
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const FIREBASE_CONFIG = process.env.FIREBASE_CONFIG;

// IDs das coleções/tabelas no Firebase
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
// INICIALIZAR FIREBASE
// =========================================
function inicializarFirebase() {
  try {
    if (!FIREBASE_CONFIG) {
      throw new Error('FIREBASE_CONFIG não configurado!');
    }

    // Parse do JSON de configuração
    const serviceAccount = JSON.parse(FIREBASE_CONFIG);

    // Inicializar Firebase Admin
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: serviceAccount.databaseURL || `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`
    });

    console.log('✅ Firebase inicializado com sucesso!');
    return admin.database(); // Retorna referência do Realtime Database
  } catch (error) {
    console.error('❌ Erro ao inicializar Firebase:', error.message);
    process.exit(1);
  }
}

// =========================================
// VERIFICAR CONFIGURAÇÕES
// =========================================
function verificarConfiguracoes() {
  const erros = [];
  
  if (!FIREBASE_CONFIG) {
    erros.push('❌ FIREBASE_CONFIG não configurado!');
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
    // Você pode implementar Firebase Cloud Messaging aqui
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
// FUNÇÃO PARA BUSCAR DADOS DO FIREBASE
// =========================================
async function buscarDadosFirebase(db, caminhoSetor) {
  try {
    const snapshot = await db.ref(caminhoSetor).once('value');
    const dados = snapshot.val();
    
    if (!dados) {
      return [];
    }
    
    // Converter objeto para array
    if (Array.isArray(dados)) {
      return dados;
    }
    
    // Se for objeto, converter para array
    return Object.keys(dados).map(key => ({
      id: key,
      ...dados[key]
    }));
  } catch (error) {
    console.error(`❌ Erro ao buscar dados do Firebase:`, error.message);
    return [];
  }
}

// =========================================
// FUNÇÃO PARA VERIFICAR SETOR
// =========================================
async function verificarSetor(db, nomeSetor, setorId) {
  try {
    console.log(`🔍 Verificando setor: ${nomeSetor.toUpperCase()} (ID: ${setorId})`);
    
    // Buscar dados do Firebase
    // Ajuste o caminho de acordo com sua estrutura no Firebase
    // Exemplos de caminhos possíveis:
    // - `/setores/${setorId}/produtos`
    // - `/produtos/${setorId}`
    // - `/estoque/${nomeSetor}`
    const caminho = `/setores/${setorId}/produtos`; // Ajuste conforme sua estrutura
    const items = await buscarDadosFirebase(db, caminho);
    
    if (items.length === 0) {
      console.log(`   ⚠️  Nenhum item encontrado no setor ${nomeSetor}`);
      return;
    }
    
    console.log(`   📦 ${items.length} itens encontrados`);
    
    let alertasSetor = 0;
    
    for (const item of items) {
      // Adapte os nomes dos campos de acordo com sua estrutura no Firebase
      const vencimento = item.VENCIMENTO || item.vencimento || item.dataVencimento;
      const produto = item.produto || item.nome || item.nomeProduto || 'Sem nome';
      const quantidade = item.quantidade || item.qtd || item.estoque || 0;
      
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
    
    // Inicializar Firebase
    const db = inicializarFirebase();
    
    console.log(`📅 Data: ${new Date().toLocaleDateString('pt-BR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })}\n`);
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Verificar cada setor
    for (const [nome, setorId] of Object.entries(SHELVES)) {
      await verificarSetor(db, nome, setorId);
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
    
    // Fechar conexão Firebase
    await admin.app().delete();
    
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
