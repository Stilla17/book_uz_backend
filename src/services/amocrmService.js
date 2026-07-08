const axios = require("axios");
const AmoToken = require("../models/AmoToken");

const baseURL = `https://${process.env.AMOCRM_SUBDOMAIN}.amocrm.ru`;

function getLongLivedToken() {
  return process.env.AMOCRM_LONG_LIVED_TOKEN || process.env.AMOCRM_LONG_TOKEN;
}

async function refreshAccessToken(token) {
  const { data } = await axios.post(`${baseURL}/oauth2/access_token`, {
    client_id: process.env.AMOCRM_CLIENT_ID,
    client_secret: process.env.AMOCRM_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: token.refreshToken,
    redirect_uri: process.env.AMOCRM_REDIRECT_URI,
  });

  token.accessToken = data.access_token;
  token.refreshToken = data.refresh_token;
  token.expiresAt = new Date(Date.now() + data.expires_in * 1000);

  await token.save();

  return token.accessToken;
}

async function getAccessToken() {
  const longLivedToken = getLongLivedToken();

  if (longLivedToken) {
    return longLivedToken;
  }

  const token = await AmoToken.findOne();

  if (!token) {
    throw new Error("amoCRM tokenlari bazadan topilmadi");
  }

  const expiresSoon = token.expiresAt.getTime() <= Date.now() + 5 * 60 * 1000;

  if (expiresSoon) {
    return refreshAccessToken(token);
  }

  return token.accessToken;
}

async function amoRequest(config) {
  const accessToken = await getAccessToken();

  const response = await axios({
    baseURL,
    ...config,
    headers: {
      ...config.headers,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  return response.data;
}

async function findContactByPhone(phone) {
  const normalizedPhone = phone.replace(/\D/g, "");

  const data = await amoRequest({
    method: "GET",
    url: "/api/v4/contacts",
    params: {
      query: normalizedPhone,
      limit: 1,
    },
  });

  return data?._embedded?.contacts?.[0] || null;
}

async function getAllContacts() {
  const contacts = [];
  let page = 1;

  while (true) {
    const data = await amoRequest({
      method: "GET",
      url: "/api/v4/contacts",
      params: {
        page,
        limit: 250,
        with: "leads",
      },
    });

    const currentContacts = data?._embedded?.contacts || [];

    contacts.push(...currentContacts);

    if (currentContacts.length < 250) {
      break;
    }

    page += 1;
  }

  return contacts;
}

module.exports = {
  amoRequest,
  getAccessToken,
  findContactByPhone,
  getAllContacts,
};
