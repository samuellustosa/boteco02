// api/cron/send-alerts.js
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const TelegramBot = require('node-telegram-bot-api');
const { getEquipmentStatus, getDaysUntilNextCleaning, formatDate } = require('../../utils/equipmentUtils');

const PROJECT_URL = 'https://checklistcpd.vercel.app/';

// Suas variáveis de ambiente
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Conexão com o Supabase e o Telegram
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN);

module.exports = async (req, res) => {
  console.log('Iniciando a verificação de equipamentos...');
  try {
    const { data: equipment, error } = await supabase
      .from('equipment')
      .select('*');

    if (error) {
      console.error('Erro ao buscar equipamentos:', error);
      res.status(500).send('Erro ao buscar equipamentos.');
      return;
    }

    const alerts = equipment.filter(item => {
      const status = getEquipmentStatus(item);
      return status === 'warning' || status === 'overdue';
    });

    if (alerts.length > 0) {
      const overdueCount = alerts.filter(item => getEquipmentStatus(item) === 'overdue').length;
      const warningCount = alerts.filter(item => getEquipmentStatus(item) === 'warning').length;

      let message = `*Relatório diário de limpeza de equipamentos*\n\n`;
      message += `*Resumo do dia:*\n`;
      message += `🔴 *${overdueCount} equipamento(s) atrasado(s)*\n`;
      message += `🟡 *${warningCount} equipamento(s) em aviso*\n\n`;

      const responsibleSections = [];
      const groupedAlerts = alerts.reduce((acc, item) => {
        const responsible = item.responsible;
        if (!acc[responsible]) {
          acc[responsible] = [];
        }
        acc[responsible].push(item);
        return acc;
      }, {});

      for (const responsible in groupedAlerts) {
        const items = groupedAlerts[responsible].map(item => {
          const status = getEquipmentStatus(item);
          const days = getDaysUntilNextCleaning(item);
          
          let daysText;
          if (days < 0) {
            daysText = `Atrasado em ${Math.abs(days)} dias`;
          } else if (days === 0) {
            daysText = `Precisa ser limpo hoje`;
          } else if (days === 1) {
            daysText = `Falta 1 dia`;
          } else {
            daysText = `Faltam ${days} dias`;
          }

          const emoji = status === 'overdue' ? '🔴' : '🟡';
          
          return `${emoji} *${item.name}* (${item.sector})
- Status: *${status === 'warning' ? 'Aviso' : 'Atrasado'}*
- Prazo: ${daysText}
- Última limpeza: ${formatDate(item.last_cleaning)}
- Responsável: *${responsible}*`;
        });
        responsibleSections.push(items.join('\n\n'));
      }
      
      message += responsibleSections.join('\n\n');
      
      message += `\n\n[Acesse o painel web para mais detalhes](${PROJECT_URL})`;
      
      await bot.sendMessage(CHAT_ID, message, {
        parse_mode: 'Markdown'
      });
      
      console.log('Alertas enviados com sucesso!');
    } else {
      await bot.sendMessage(CHAT_ID, `Ótimo dia, galera do CPD!\n\nNenhum equipamento em alerta ou atrasado hoje. Continuem com o bom trabalho!\n\n[Acesse o painel web para mais detalhes](${PROJECT_URL})`, { parse_mode: 'Markdown' });
      console.log('Nenhum alerta para enviar.');
    }

    res.status(200).send('Cron job executado com sucesso.');
  } catch (err) {
    console.error('Erro geral ao enviar alertas:', err);
    res.status(500).send('Erro na execução do cron job.');
  }
};