require("dotenv").config();
const axios = require("axios");

async function authorize() {
  try {
    const url = `https://${process.env.AMOCRM_SUBDOMAIN}.amocrm.ru/oauth2/access_token`;

    const { data } = await axios.post(url, {
      client_id: process.env.AMOCRM_CLIENT_ID,
      client_secret: process.env.AMOCRM_CLIENT_SECRET,
      grant_type: "authorization_code",
      code: process.env.AMOCRM_AUTH_CODE,
      redirect_uri: process.env.AMOCRM_REDIRECT_URI,
    });
    console.log("ACCESS TOKEN:", data.access_token);
    console.log("REFRESH TOKEN:", data.refresh_token);
    console.log("EXPIRES IN:", data.expires_in);
  } catch (error) {
    console.error(error.response?.data || error.message);
  }
}
authorize();
