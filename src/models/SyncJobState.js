const mongoose = require("mongoose");

const SyncJobStateSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true, trim: true },
    nextRunAt: { type: Date, required: true, default: Date.now },
    lastStartedAt: Date,
    lastSucceededAt: Date,
    lastFailedAt: Date,
    lastError: String,
    lockedBy: String,
    lockUntil: Date,
  },
  { timestamps: true },
);

module.exports = mongoose.model("SyncJobState", SyncJobStateSchema);
