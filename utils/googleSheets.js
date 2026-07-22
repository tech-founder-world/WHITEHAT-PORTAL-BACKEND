// backend/utils/googleSheets.js
const { google } = require("googleapis");
const path = require("path");

// ✅ LOAD CREDENTIALS DIRECTLY FROM THE JSON FILE
// This bypasses all .env formatting issues completely.
const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, "../credentials.json"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

async function addToSheet(application, placementTitle) {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  if (!spreadsheetId) {
    alert("❌ Google Sheet ID not configured in .env. Skipping.");
    return;
  }

  try {
    const values = [
      [
        new Date().toISOString().split("T")[0],
        placementTitle || "N/A",
        application.studentName,
        application.studentEmail,
        application.studentPhone,
        application.studentId,
        application.branch,
        application.year,
        application.semester,
        application.cgpa,
        (application.skills || []).join(", "),
        application.experience || "N/A",
        application.resumeLink || "N/A",
        application.additionalInfo || "N/A",
      ],
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Sheet1!A:N",
      valueInputOption: "USER_ENTERED",
      resource: { values },
    });
  } catch (error) {
    console.error("❌ Error adding to Google Sheet:", error.message);
  }
}

async function initializeSheet() {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  if (!spreadsheetId) return;

  try {
    const headers = [
      [
        "Date",
        "Placement",
        "Student Name",
        "Email",
        "Phone",
        "Student ID",
        "Branch",
        "Year",
        "Semester",
        "CGPA",
        "Skills",
        "Experience",
        "Resume Link",
        "Additional Info",
      ],
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Sheet1!A1:N1",
      valueInputOption: "USER_ENTERED",
      resource: { values: headers },
    });
  } catch (error) {
    console.error("❌ Error initializing Google Sheet:", error.message);
  }
}

module.exports = { addToSheet, initializeSheet };
