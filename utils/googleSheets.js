// utils/googleSheets.js
const { google } = require('googleapis');

// Initialize Google Sheets API
const auth = new google.auth.GoogleAuth({
  keyFile: 'credentials.json', // Download this from Google Cloud Console
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

async function addToSheet(application, placementTitle) {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) {
      console.log('Google Sheet ID not configured, skipping sheet update');
      return;
    }

    // Prepare data for Google Sheets
    const values = [[
      new Date().toISOString(),
      placementTitle || 'N/A',
      application.studentName,
      application.studentEmail,
      application.studentPhone,
      application.studentId,
      application.branch,
      application.year,
      application.semester,
      application.cgpa,
      application.skills.join(', '),
      application.experience || 'N/A',
      application.resumeLink || 'N/A',
      application.additionalInfo || 'N/A'
    ]];

    // Get the current sheet data to find the next empty row
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Sheet1!A:A',
    });

    const rows = response.data.values || [];
    const nextRow = rows.length + 1;

    // Append data to Google Sheet
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Sheet1!A${nextRow}`,
      valueInputOption: 'USER_ENTERED',
      resource: { values },
    });

    console.log('Data added to Google Sheet successfully');
  } catch (error) {
    console.error('Error adding to Google Sheet:', error.message);
    // Don't throw error - we want the application to save even if sheet fails
  }
}

// Function to create header row in Google Sheet
async function initializeSheet() {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) return;

    const headers = [[
      'Application Date',
      'Placement Title',
      'Student Name',
      'Student Email',
      'Student Phone',
      'Student ID',
      'Branch',
      'Year',
      'Semester',
      'CGPA',
      'Skills',
      'Experience',
      'Resume Link',
      'Additional Info'
    ]];

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Sheet1!A1:N1',
      valueInputOption: 'USER_ENTERED',
      resource: { values: headers },
    });

    console.log('Google Sheet headers initialized');
  } catch (error) {
    console.error('Error initializing Google Sheet:', error.message);
  }
}

module.exports = { addToSheet, initializeSheet };