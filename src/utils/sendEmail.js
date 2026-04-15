const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { background-color: #f9f9f9; margin: 0; padding: 0; }
        .wrapper { width: 100%; table-layout: fixed; background-color: #f9f9f9; padding-bottom: 40px; }
        .main { background-color: #ffffff; margin: 0 auto; width: 100%; max-width: 600px; font-family: sans-serif; border-bottom: 8px solid #004a99; }
        .header { background-color: #004a99; padding: 20px; text-align: center; color: #ffffff; }
        .logo-text { color: #ffffff; font-size: 24px; font-weight: bold; text-decoration: none; }
        
        .content { padding: 40px 30px; text-align: center; color: #333333; }
        .icon-box { margin-bottom: 25px; }
        .icon-box img { width: 150px; } /* Qulf rasmi uchun */
        
        h1 { font-size: 22px; color: #444444; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px; }
        p { font-size: 15px; line-height: 1.5; color: #666666; margin-bottom: 20px; }
        
        .otp-container {
          display: inline-block;
          padding: 15px 40px;
          background-color: #ffffff;
          border: 2px solid #004a99;
          border-radius: 5px;
          color: #004a99;
          font-size: 32px;
          font-weight: bold;
          letter-spacing: 8px;
          text-decoration: none;
          margin: 20px 0;
        }
        
        .footer { padding: 20px; text-align: center; background-color: #004a99; color: #ffffff; font-size: 12px; }
        .footer a, .footer p { color: #ffffff; text-decoration: none; font-weight: bold; }
      </style>
    </head>
    <body>
      <center class="wrapper">
        <div class="main">
          <div class="header">
            <span class="logo-text">BOOK.UZ</span>
          </div>
          
          <div class="content">
            <div class="icon-box">
              <img src="https://cdn-icons-png.flaticon.com/512/6195/6195699.png" alt="Lock Icon">
            </div>
            
            <h1>Parolni unutdingizmi?</h1>
            <p>Assalomu alaykum!<br>Profilingiz parolini tiklash bo'yicha so'rov qabul qildik.</p>
            <p style="font-size: 14px; color: #ff0909ff;">Agar siz buni so'ramagan bo'lsangiz, ushbu xatga e'tibor bermang. Aks holda, quyidagi koddan foydalaning:</p>
            
            <div class="otp-container">
              ${options.otp}
            </div>

            <p style="margin-top: 25px; font-size: 13px;">Kodning amal qilish muddati: <b>5 daqiqa</b></p>
          </div>
          
          <div class="footer">
            <p>Savollaringiz bormi? Biz bilan bog'laning:</p>
            <p><a href="mailto:support@book.uz">support@book.uz</a> | +998 71 123-45-67</p>
            <p>&copy; 2026 Book.uz Online Store</p>
          </div>
        </div>
      </center>
    </body>
    </html>
  `;

  const message = {
    from: `"Book.uz Support" <${process.env.EMAIL_USER}>`,
    to: options.email,
    subject: options.subject,
    html: htmlContent,
  };

  await transporter.sendMail(message);
};

module.exports = sendEmail;