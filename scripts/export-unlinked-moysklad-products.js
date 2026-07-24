const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const ExcelJS = require("exceljs");
const mongoose = require("mongoose");
const Product = require("../src/models/Product");

const OUTPUT_DIRECTORY = path.resolve(__dirname, "../exports");
const OUTPUT_FILE = path.join(
  OUTPUT_DIRECTORY,
  "moysklad-bilan-boglanmagan-kitoblar.xlsx",
);

const cleanBarcode = (value) =>
  String(value || "")
    .replace(/\D/g, "")
    .trim();

const getReason = (product) => {
  if (!cleanBarcode(product.barcode)) {
    return "ISBN yo'q";
  }

  return "MoySklad mahsulotiga aniq bog'lanmagan";
};

const styleWorksheet = (worksheet) => {
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.autoFilter = {
    from: "A1",
    to: "N1",
  };

  worksheet.getRow(1).height = 32;
  worksheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F4E78" },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
  });

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    row.alignment = { vertical: "top", wrapText: true };
    if (rowNumber % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF3F6F9" },
        };
      });
    }
  });
};

const main = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI topilmadi");
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const products = await Product.find({
    $or: [
      { moyskladId: { $exists: false } },
      { moyskladId: null },
      { moyskladId: "" },
    ],
  })
    .select("_id title slug barcode price stock")
    .sort({ "title.uz": 1, _id: 1 })
    .lean();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Book.uz";
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet("Bog'lanmagan kitoblar");
  worksheet.columns = [
    { header: "№", key: "number", width: 8 },
    { header: "Book.uz ID", key: "bookuzId", width: 28 },
    { header: "Nomi (UZ)", key: "titleUz", width: 42 },
    { header: "Nomi (RU)", key: "titleRu", width: 42 },
    { header: "Nomi (EN)", key: "titleEn", width: 42 },
    { header: "ISBN / Barcode", key: "barcode", width: 22 },
    { header: "Tozalangan ISBN", key: "cleanedBarcode", width: 20 },
    { header: "Joriy narx", key: "price", width: 16 },
    { header: "Joriy qoldiq", key: "stock", width: 14 },
    { header: "Sabab", key: "reason", width: 38 },
    { header: "To'g'rilangan nom", key: "correctedTitle", width: 42 },
    { header: "To'g'rilangan ISBN", key: "correctedBarcode", width: 22 },
    { header: "MoySklad ID", key: "correctedMoyskladId", width: 38 },
    { header: "Izoh", key: "notes", width: 36 },
  ];

  products.forEach((product, index) => {
    worksheet.addRow({
      number: index + 1,
      bookuzId: product._id.toString(),
      titleUz: product.title?.uz || "",
      titleRu: product.title?.ru || "",
      titleEn: product.title?.en || "",
      barcode: product.barcode || "",
      cleanedBarcode: cleanBarcode(product.barcode),
      price: Number(product.price || 0),
      stock: Number(product.stock || 0),
      reason: getReason(product),
      correctedTitle: "",
      correctedBarcode: "",
      correctedMoyskladId: "",
      notes: "",
    });
  });

  worksheet.getColumn("price").numFmt = '#,##0" so‘m"';
  worksheet.getColumn("stock").numFmt = "0";
  styleWorksheet(worksheet);

  const instructions = workbook.addWorksheet("Qo'llanma");
  instructions.columns = [
    { header: "Ustun", key: "column", width: 28 },
    { header: "Qanday to'ldiriladi", key: "description", width: 90 },
  ];
  instructions.addRows([
    {
      column: "To'g'rilangan nom",
      description:
        "Book.uz yoki MoySklad tomonda kitob nomi xato bo'lsa, to'g'ri nomni yozing.",
    },
    {
      column: "To'g'rilangan ISBN",
      description:
        "ISBN xato yoki bo'sh bo'lsa, faqat raqamlar bilan to'g'ri ISBNni kiriting.",
    },
    {
      column: "MoySklad ID",
      description:
        "Aniq MoySklad mahsuloti ma'lum bo'lsa, uning UUID qiymatini kiriting.",
    },
    {
      column: "Izoh",
      description:
        "Dublikat, o'chirilishi kerak yoki boshqa muhim ma'lumotni yozing.",
    },
  ]);
  styleWorksheet(instructions);
  instructions.autoFilter = undefined;

  fs.mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
  await workbook.xlsx.writeFile(OUTPUT_FILE);

  console.log(
    JSON.stringify(
      {
        outputFile: OUTPUT_FILE,
        exported: products.length,
        withoutIsbn: products.filter(
          (product) => !cleanBarcode(product.barcode),
        ).length,
      },
      null,
      2,
    ),
  );
};

main()
  .catch((error) => {
    console.error("Excel export xatosi:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
