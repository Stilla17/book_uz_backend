const { KASSA_ID, PASSWORD } = require("../config/payme");

const unauthorized = (req, res, message) =>
  res.json({
    jsonrpc: "2.0",
    id: req.body?.id || null,
    error: {
      code: -32504,
      message: typeof message === "string" ? message : "Unauthorized",
      data: null,
    },
    result: null,
  });

const paymeAuth = (req, res, next) => {
  const auth = req.headers["authorization"];

  if (!KASSA_ID || !PASSWORD) {
    return unauthorized(req, res, "Payme credentials are not configured");
  }

  if (!auth || !auth.startsWith("Basic ")) {
    return unauthorized(req, res, "Unauthorized");
  }

  const base64 = auth.replace("Basic ", "");
  const decoded = Buffer.from(base64, "base64").toString("utf-8");
  // Payme sends Paycom:PASSWORD. Some test tools may use KASSA_ID:PASSWORD.
  const separatorIndex = decoded.indexOf(":");
  const kid = separatorIndex >= 0 ? decoded.slice(0, separatorIndex) : "";
  const pwd = separatorIndex >= 0 ? decoded.slice(separatorIndex + 1) : "";

  if (!["Paycom", KASSA_ID].includes(kid) || pwd !== PASSWORD) {
    return unauthorized(req, res, "Invalid credentials");
  }

  next();
};

module.exports = paymeAuth;
