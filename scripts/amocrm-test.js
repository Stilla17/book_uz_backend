require("dotenv").config();
const axios = require("axios");

async function testConnection() {
  try {
    const url = `https://${process.env.AMOCRM_SUBDOMAIN}.amocrm.ru/api/v4/account`;
    const { data } = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${process.env.AMOCRM_ACCESS_TOKEN}`,
      },
    });
    console.log("amoCRM ulandi:", data.name);
  } catch (error) {
    console.error(error.response?.data || error.message);
  }
}
testConnection();
