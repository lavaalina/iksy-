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

async function sendTelegramMessage(chatId, text, extra) {
  console.log('[iksy] sending message to chat_id:', chatId);
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, ...extra }),
  });
  const data = await res.json();
  console.log('[iksy] telegram response:', JSON.stringify(data));
  if (!data.ok) {
    console.error('[iksy] telegram sendMessage FAILED:', data.description);
  }
  return data;
}

export default async function handler(req, res) {
  // GET — просто чтобы можно было открыть ссылку в браузере и проверить,
  // что переменные окружения вообще подхватились после деплоя
  if (req.method !== 'POST') {
    res.status(200).json({
      ok: true,
      bot_token_set: Boolean(BOT_TOKEN),
      admin_chat_id_set: Boolean(ADMIN_CHAT_ID),
    });
    return;
  }

  console.log('[iksy] === incoming update ===', JSON.stringify(req.body));

  try {
    const update = req.body;
    const message = update && update.message;
    const webAppUrl = `https://${req.headers['x-forwarded-host'] || req.headers.host}/`;

    if (message && message.web_app_data) {
      console.log('[iksy] web_app_data found, raw:', message.web_app_data.data);
      const payload = JSON.parse(message.web_app_data.data);
      const summary = formatOrder(payload);
      const author = message.from.username ? `@${message.from.username}` : message.from.first_name;
      console.log('[iksy] parsed order from', author, 'chat.id =', message.chat.id, 'ADMIN_CHAT_ID =', ADMIN_CHAT_ID);

      await sendTelegramMessage(
        message.chat.id,
        `расчёт получен:\n\n${summary}\n\nсвяжусь, чтобы подтвердить детали`
      );

      if (ADMIN_CHAT_ID) {
        await sendTelegramMessage(ADMIN_CHAT_ID, `новый расчёт от ${author}:\n\n${summary}`);
      } else {
        console.log('[iksy] ADMIN_CHAT_ID is empty, skipping admin copy');
      }
    }

    if (message && message.text === '/start') {
      await sendTelegramMessage(message.chat.id, 'привет! жми на кнопку, чтобы рассчитать заказ', {
        reply_markup: {
          keyboard: [[{ text: 'открыть калькулятор', web_app: { url: webAppUrl } }]],
          resize_keyboard: true,
        },
      });
    }
  } catch (err) {
    console.error('[iksy] HANDLER ERROR:', err && err.stack ? err.stack : err);
  }

  res.status(200).send('ok');
}
