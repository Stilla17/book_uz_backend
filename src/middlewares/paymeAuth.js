const paymeConfig = require("../config/payme");

const unauthorized = (req, res, data = "authorization") =>
  res.json({
    id: req.body?.id || null,
    error: {
      code: -32504,
      message: "Access denied.",
      data,
    },
  });

const paymeAuth = (req, res, next) => {
  try {
    const auth = req.headers["authorization"];

    if (!paymeConfig.KASSA_ID || !paymeConfig.PASSWORD) {
      return unauthorized(req, res, "payme_credentials");
    }

    if (!auth || !auth.toLowerCase().startsWith("basic ")) {
      return unauthorized(req, res, "Invalid auth credentials");
    }

    const base64 = auth.slice(6).trim();
    const decoded = Buffer.from(base64, "base64").toString("utf-8");
    const separatorIndex = decoded.indexOf(":");
    const login = separatorIndex >= 0 ? decoded.slice(0, separatorIndex) : "";
    const password = separatorIndex >= 0 ? decoded.slice(separatorIndex + 1) : "";
    const allowedLogins = [
      ...new Set([paymeConfig.LOGIN, "Paycom", paymeConfig.KASSA_ID].filter(Boolean)),
    ];

    if (!allowedLogins.includes(login) || password !== paymeConfig.PASSWORD) {
      console.warn("[payme] invalid credentials", {
        login: login || null,
        hasPassword: Boolean(password),
        allowedLogins,
      });
      return unauthorized(req, res, "Invalid auth credentials");
    }

    next();
  } catch (error) {
    console.error("[payme] auth error", error);
    return unauthorized(req, res, "Invalid auth credentials");
  }
};

module.exports = paymeAuth;
