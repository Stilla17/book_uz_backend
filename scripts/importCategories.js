const mongoose = require("mongoose");
const axios = require("axios");
const Category = require("../src/models/Category");

require("dotenv").config();
async function importCategories() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const res = await axios.get(`${process.env.OLD_SITE}/`);


  } catch (error) {}
}
