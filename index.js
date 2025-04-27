const { Crypto } = require("@peculiar/webcrypto");
globalThis.crypto = new Crypto();

const { useMultiFileAuthState, makeWASocket } = require("@whiskeysockets/baileys");
const pino = require("pino");
const readline = require("readline");

// Configuration
const usePairingCode = true;
const sessionPath = "./session";

// Initialize question function
const question = (text) => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise((resolve) => rl.question(text, (answer) => {
        rl.close();
        resolve(answer);
    }));
};

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const bot = makeWASocket({
        logger: pino({ level: "silent" }),
        printQRInTerminal: !usePairingCode,
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
    });

    if (usePairingCode && !bot.authState.creds.registered) {
        const phoneNumber = await question("Masukkan Nomor yang Aktif (awali dengan 62): ");
        const code = await bot.requestPairingCode(phoneNumber.trim());
        console.log(`Pairing code: ${code}`);
    }

    bot.ev.on("connection.update", (update) => {
        const { connection } = update;
        if (connection === "open") {
            console.log("✅ Bot WhatsApp siap digunakan!");
            try {
                const main = require('./main.js');
                if (typeof main === 'function') {
                    main(bot, saveCreds);
                } else {
                    console.error("Error: main.js harus mengekspor fungsi");
                }
            } catch (err) {
                console.error("Gagal memuat main.js:", err.message);
            }
        } else if (connection === "close") {
            console.log("⚠️ Koneksi terputus, mencoba menyambungkan kembali...");
            setTimeout(connectToWhatsApp, 5000);
        }
    });

    bot.ev.on("creds.update", saveCreds);
}

connectToWhatsApp().catch(err => {
    console.error("Gagal terkoneksi:", err.message);
    setTimeout(connectToWhatsApp, 5000);
});