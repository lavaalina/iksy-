// /api/webhook.js — принимает вебхук от Telegram, шлёт заказ Алине.
// Работает как serverless-функция: просыпается только когда приходит апдейт,
// ничего не крутится 24/7, поэтому бесплатно на Vercel Hobby-плане.

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

function formatOrder(payload) {
  const lines = payload.items.map((i) => {
    let line = `• ${i.category} — ${Number(i.total_rub).toLocaleString('ru-RU')} ₽`;
    if (i.link) line += `\n  ${i.link}`;
    if (i.size) line += `\n  размер: ${i.size}`;
    return line;
  });
  lines.push(`\nитого: ${Number(payload.total_rub).toLocaleString('ru-RU')} ₽`);
  return lines.join('\n');
}

async function sendTelegramMessage(chatId, text) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(200).send('ok');
    return;
  }

  try {
    const update = req.body;
    const message = update && update.message;

    if (message && message.web_app_data) {
      const payload = JSON.parse(message.web_app_data.data);
      const summary = formatOrder(payload);
      const author = message.from.username ? `@${message.from.username}` : message.from.first_name;

      await sendTelegramMessage(
        message.chat.id,
        `расчёт получен:\n\n${summary}\n\nсвяжусь, чтобы подтвердить детали`
      );

      if (ADMIN_CHAT_ID) {
        await sendTelegramMessage(ADMIN_CHAT_ID, `новый расчёт от ${author}:\n\n${summary}`);
      }
    }

    if (message && message.text === '/start') {
      await sendTelegramMessage(message.chat.id, 'привет! жми на кнопку с калькулятором, чтобы рассчитать заказ');
    }
  } catch (err) {
    console.error(err);
  }

  res.status(200).send('ok');
}
