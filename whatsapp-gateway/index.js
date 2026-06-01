const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const express = require('express');
const cors = require('cors');
const pino = require('pino');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 9000;
let sock = null;
let qrCodeString = null;
let connectionStatus = 'disconnected';

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    // Fetch latest WhatsApp Web version to bypass version checks
    let version = [2, 3000, 1015000000];
    try {
        const latest = await fetchLatestBaileysVersion();
        if (latest && latest.version) {
            version = latest.version;
            console.log(`[WA Gateway] Menggunakan WhatsApp Web v${version.join('.')}`);
        }
    } catch (err) {
        console.log(`[WA Gateway] Gagal mengambil versi WA terbaru, menggunakan default v${version.join('.')}`);
    }

    sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ['Windows', 'Chrome', '120.0.0.0'] // Standard desktop client
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            qrCodeString = qr;
            console.log('\n--- SCAN QR CODE DI BAWAH DENGAN WHATSAPP ANDA ---');
            qrcode.generate(qr, { small: true });
            console.log('--------------------------------------------------\n');
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.log(`Koneksi terputus karena: ${lastDisconnect?.error?.message} (Status: ${statusCode}). Mencoba menyambung kembali dalam 5 detik: ${shouldReconnect}`);
            connectionStatus = 'disconnected';
            qrCodeString = null;
            
            if (shouldReconnect) {
                setTimeout(() => {
                    connectToWhatsApp();
                }, 5000);
            } else {
                console.log('Logged out dari WhatsApp. Silakan bersihkan folder auth_info_baileys untuk mengulang scan.');
            }
        } else if (connection === 'open') {
            console.log('✅ Koneksi WhatsApp berhasil terhubung dari nomor kedai!');
            connectionStatus = 'connected';
            qrCodeString = null;
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

// API Endpoints
app.get('/status', (req, res) => {
    res.json({ status: connectionStatus, hasQr: !!qrCodeString });
});

app.post('/send', async (req, res) => {
    const { phone, message } = req.body;
    
    if (connectionStatus !== 'connected') {
        return res.status(503).json({ error: 'Gateway WhatsApp belum terhubung. Silakan scan QR code terlebih dahulu.' });
    }

    if (!phone || !message) {
        return res.status(400).json({ error: 'Nomor telepon dan pesan harus diisi.' });
    }

    try {
        // Sanitize phone number to WA format (e.g. 628123456789@s.whatsapp.net)
        let sanitizedPhone = phone.replace(/\D/g, '');
        if (sanitizedPhone.startsWith('0')) {
            sanitizedPhone = '62' + sanitizedPhone.slice(1);
        }
        
        const recipientJid = `${sanitizedPhone}@s.whatsapp.net`;
        
        // Send message
        await sock.sendMessage(recipientJid, { text: message });
        
        console.log(`[WA Gateway] Pesan terkirim ke ${phone}`);
        res.json({ success: true, message: `Pesan berhasil dikirim ke ${phone}` });
    } catch (err) {
        console.error('Gagal mengirim pesan WhatsApp:', err);
        res.status(500).json({ error: 'Gagal mengirim pesan WhatsApp: ' + err.message });
    }
});

app.listen(PORT, () => {
    console.log(`[WA Gateway] Server berjalan di http://localhost:${PORT}`);
    connectToWhatsApp();
});
