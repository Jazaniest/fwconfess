import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);

// Test simple confession
bot.command('testconfess', async (ctx) => {
  console.log('Test confess command triggered by:', ctx.from.id);
  
  try {
    await ctx.reply('Test confession working!');
    console.log('Reply sent successfully');
  } catch (error) {
    console.error('Error sending reply:', error);
  }
});

// Test text handler
bot.on('text', async (ctx) => {
  const text = ctx.message.text;
  console.log('Text received:', text);
  
  if (text.includes('#test')) {
    try {
      await ctx.reply('Text handler working! Received: ' + text);
      console.log('Text handler response sent');
    } catch (error) {
      console.error('Error in text handler:', error);
    }
  }
});

bot.launch().then(() => {
  console.log('Test bot started');
}).catch(console.error);

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));