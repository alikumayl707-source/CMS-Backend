// routes/report.routes.js

const express = require('express');
const ExcelJS = require('exceljs');
const axios = require('axios');
const authorize = require("../../middleware/authorize.middleware");
const router = express.Router();

router.get('/generate', async (req, res) => {
  try {
    const claimsResponse = await axios.get(
      'http://localhost:3000/api/claims?page=1&pageSize=10000',
      {
        headers: {
          authorization: req.headers.authorization
        }
      }
    );

    const claims = claimsResponse.data?.data || [];

    if (!claims.length) {
      return res.status(404).json({
        success: false,
        message: 'No data found'
      });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Claims');

    const excelData = claims.map((claim) => {
   

      return {
        claimNumber: claim.claimNumber || 'Not Assigned',
        claimType: claim.claimType?.name || '',
        status: claim.status,
        amount: claim.amount,
        statge:claim.trackingStage,
        assignedApprover: claim.assignedApprover?.name || '',
        requiredApproverRole: claim.requiredApproverRole || '',
        createdDate: new Date(claim.createdAt).toLocaleDateString('en-GB'),
        createdTime: new Date(claim.createdAt).toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit'
        }),
   
      };
    });

    // Collect all available columns
    const allKeys = [
      ...new Set(
        excelData.flatMap((row) => Object.keys(row))
      )
    ];

    worksheet.columns = allKeys.map((key) => ({
      header: key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (str) => str.toUpperCase()),
      key,
      width: 35
    }));

    worksheet.addRows(excelData);


    const headerRow = worksheet.getRow(1);

    headerRow.font = {
      bold: true,
      color: { argb: 'FFFFFF' }
    };

    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '1F4E78' }
    };



    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );


    res.setHeader(
      'Content-Disposition',
      'attachment; filename=claims-report.xlsx'
    );

    console.log("Excel Report ",claims)
    await workbook.xlsx.write(res);

    res.end();

  } catch (error) {
    console.error('REPORT ERROR:', error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;