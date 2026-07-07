const ExcelJS = require("exceljs");
const User = require("../../models/User");
const AmoContact = require("../../models/AmoContact");

const exportUsersExcel = async (req, res, next) => {
  try {
    const users = await User.find()
      .select(
        "name email phone telegramUsername source ordersCount createdAt birthDate",
      )
      .lean();

    const amoContacts = await AmoContact.find({ normalizedPhones: /^\d{12}$/ })
      .select(
        "name firstName lastName emails phones telegramUsername salesCount createdAt birthDate",
      )
      .lean();

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Mijozlar");

    sheet.columns = [
      { header: "Ism", key: "name", width: 30 },
      { header: "Telegram", key: "telegramUsername", width: 30 },
      { header: "Telefon", key: "phone", width: 30 },
      { header: "Manba", key: "source", width: 30 },
      { header: "Buyurtmalar", key: "ordersCount", width: 15 },
      { header: "Ro'yxatdan o'tgan", key: "createdAt", width: 18 },
      { header: "Tug'ilgan sana", key: "birthDate", width: 18 },
    ];

    const bookUsers = users.map((user) => ({
      name: user.name || "",
      telegramUsername: user.telegramUsername || "",
      phone: user.phone || "",
      source: "BOOK_UZ",
      ordersCount: user.ordersCount || 0,
      createdAt: user.createdAt,
      birthDate: user.birthDate,
    }));

    const amoUsers = amoContacts.map((contact) => ({
      name:
        contact.name ||
        [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
        "",
      telegramUsername: contact.telegramUsername || "",
      phone: contact.phones?.[0] || "",
      email: contact.emails?.[0] || "",
      source: "AMO_CRM",
      ordersCount: contact.salesCount || 0,
      createdAt: contact.createdAt,
      birthDate: contact.birthDate,
    }));

    const allUsers = [...bookUsers, ...amoUsers];

    allUsers.forEach((user) => {
      sheet.addRow({
        ...user,
        createdAt: user.createdAt
          ? new Date(user.createdAt).toLocaleDateString("uz-UZ")
          : "",
        birthDate: user.birthDate
          ? new Date(user.birthDate).toLocaleDateString("uz-UZ")
          : "",
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );

    res.setHeader(
      "Content-Disposition",
      "attachment; filename=foydalanuvchilar.xlsx",
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
};

module.exports = { exportUsersExcel };
