require('dotenv').config(); 
const express = require('express');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');
const { Connection, PublicKey } = require("@solana/web3.js");
const axios = require('axios');

const app = express();
const port = 3000;

const botToken = process.env.BOT_TOKEN;
const apiKey = process.env.SOLANA_API_KEY;

const bot = new TelegramBot(botToken, { polling: true });
const connection = new Connection("https://api.devnet.solana.com");
const tokenProgramId = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

// Express middleware
app.use(bodyParser.json());

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const welcomeMessage = 'Welcome to the Wallet Checker Bot!\n\nPlease choose an option:';
    const menuOptions = [
        { text: 'Check Solana Wallet', callback_data: 'checksolana' },
        { text: 'Check Sol Token Address', callback_data: 'checktoken' }
    ];
    const replyMarkup = {
        inline_keyboard: [menuOptions.map(option => ({ text: option.text, callback_data: option.callback_data }))]
    };
    bot.sendMessage(chatId, welcomeMessage, { reply_markup: replyMarkup });
});

const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;

// Handle button callbacks
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const buttonClicked = callbackQuery.data;

    if (buttonClicked === 'checksolana') {
        bot.sendMessage(chatId, 'Please enter Solana wallet address:');

        bot.once('message', async (msg) => {
            const walletAddress = msg.text;

            if (!base58Regex.test(walletAddress)) {
                bot.sendMessage(chatId, 'Invalid Solana wallet address.');
                return;
            }

            try {
                let response;
                let message;

                response = await axios.get(`https://solana-gateway.moralis.io/account/mainnet/${walletAddress}/portfolio`, {
                    headers: {
                        'accept': 'application/json',
                        'X-API-Key': apiKey
                    }
                });

                const responseData = response.data;
                const tokens = responseData.tokens.slice(0, 10);

                message = 'Solana Wallet Information:\n\n';
                message += `Address: ${walletAddress}\n\n`;
                message += 'Tokens:\n';

                for (const token of tokens) {
                    message += `\nName: ${token.name}\n`;
                    message += `Symbol: ${token.symbol}\n`;
                    message += `Balance: ${token.amount} ${token.symbol}\n`;
                    message += `Decimals: ${token.decimals}\n`;
                    message += `Mint: ${token.mint}\n`;
                    message += `Associated Token Address: ${token.associatedTokenAddress}\n`;

                }

                bot.sendMessage(chatId, message);
            } catch (error) {
                console.error('Error:', error);
                bot.sendMessage(chatId, 'An error occurred. Please confirm that the address is valid and try again.');
            }
        });
    } else if (buttonClicked === 'checktoken') {
        bot.sendMessage(chatId, 'Please enter Solana token mint address:');

        bot.once('message', async (msg) => {
            const mintAddress = msg.text;
            const publicKey = new PublicKey(mintAddress);

            try {
                const largestAccounts = await connection.getTokenLargestAccounts(publicKey);

                const tokenHolders = largestAccounts.value.map((account) => ({
                    address: account.address.toBase58(),
                }));

                bot.sendMessage(chatId, `Top 50 token holders:\n\n\n${tokenHolders.map(holder => `${holder.address}`).join("\n")}`);

                console.log("Top 20 largest token holders:");
                console.log(tokenHolders);
            } catch (error) {
                console.error("Error fetching largest token accounts:", error);
                bot.sendMessage(chatId, 'Failed to fetch token holders. Ensure the mint address is correct.');
            }
        });
    }
});

// Start the Express server
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
