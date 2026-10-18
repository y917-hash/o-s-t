const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { exec } = require('child_process');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let lastSmsId = null;

// Mengirimkan file statis dari folder public
app.use(express.static(path.join(__dirname, 'public')));

// Fungsi untuk mengeksekusi ADB command dan membaca SMS
function pollSMS() {
  // Query 1 SMS terbaru dari inbox Android via ADB
  const command = 'adb shell content query --uri content://sms/inbox --projection _id,address,body --sort "date DESC LIMIT 1"';

  exec(command, (err, stdout) => {
    if (err) return; // Mengabaikan error jika HP terputus sementara

    const idMatch = stdout.match(/_id=(\d+)/);
    const addressMatch = stdout.match(/address=([^,]+)/);
    const bodyMatch = stdout.match(/body=(.*)/);

    if (idMatch && bodyMatch) {
      const currentId = idMatch[1];
      const sender = addressMatch ? addressMatch[1] : 'Unknown';
      const fullText = bodyMatch[1];

      // Jika ID SMS berbeda dengan SMS terakhir, berarti ada SMS baru
      if (currentId !== lastSmsId) {
        lastSmsId = currentId;

        // Ekstraksi 4-6 digit angka untuk OTP
        const otpMatch = fullText.match(/\b\d{4,6}\b/);
        const otpCode = otpMatch ? otpMatch[0] : '-';

        const payload = {
          sender,
          fullText,
          otpCode,
          time: new Date().toLocaleTimeString('id-ID')
        };

        // Broadcast data ke semua klien web yang aktif
        io.emit('new_otp', payload);
      }
    }
  });
}

// Cek SMS setiap 2 detik
setInterval(pollSMS, 2000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server aktif di http://localhost:${PORT}`);
});
