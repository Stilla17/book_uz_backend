const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") }); // 1. Barcha o'zgaruvchilardan oldin turishi shart
const dns = require("dns");

// Node DNS'ni majburan Cloudflare'ga o'rnatamiz
dns.setServers(["1.1.1.1", "1.0.0.1"]);

// IPv4ni birinchi qo'yish
dns.setDefaultResultOrder("ipv4first");

const http = require("http");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

// TELEGRAM BOT KOMMENTGA OLINDI:
// const { initTelegramBot } = require('./utils/sendTelegram');

const connectDB = require("./config/db");
const { errorHandler } = require("./middlewares/error");
const { initSocket } = require("./sockets/socket");

const routes = require("./routes/index");

// 1. Ma'lumotlar bazasiga ulanish
connectDB();

const app = express();

/**
 * 2. GLOBAL MIDDLEWARES
 */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        const msg =
          "The CORS policy for this site does not allow access from the specified Origin.";
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: ["Set-Cookie"],
    optionsSuccessStatus: 200,
  }),
);

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// TELEGRAM BOT KOMMENTGA OLINDI:
// initTelegramBot();

/**
 * 3. ROUTES INTEGRATION
 */
app.use("/api/v1", routes);

app.get("/", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Online Book Store API is running...",
    version: "1.0.0",
  });
});

/**
 * 4. SOCKET.IO INTEGRATION
 */
const server = http.createServer(app);
initSocket(server);

/**
 * 5. ERROR HANDLING
 */
app.use(errorHandler);

/**
 * 6. SERVER START
 */
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`
    *****************************************
    🚀 Server ${PORT}-portda muvaffaqiyatli yurgizildi
    🌐 API: http://localhost:${PORT}/api/v1
    📖 Documentation: Swagger yoki Postman orqali ko'ring
    *****************************************
  `);
});
