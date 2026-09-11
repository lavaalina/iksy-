// /api/webhook.js — отвечает на /start. Приём заказов теперь идёт через
// /api/submit-order.js напрямую из мини-аппа (не зависит от способа запуска).

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

async function sendTelegramMessage(chatId, text, extra) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, ...extra }),
  });
  const data = await res.json();
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

  try {
    const update = req.body;
    const message = update && update.message;

    if (message && message.text === '/start') {
      await sendTelegramMessage(
        message.chat.id,
        'Добро пожаловать в ИКСЫ! Здесь вы можете рассчитать стоимость вашего заказа и оформить его.\n\nЧтобы начать, откройте калькулятор через кнопку меню внизу чата.',
        { reply_markup: { remove_keyboard: true } }
      );
    }
  } catch (err) {
    console.error('[iksy] HANDLER ERROR:', err && err.stack ? err.stack : err);
  }

  res.status(200).send('ok');
}
