/**
 * Export and Print Utilities for Revenue Reports
 */

export function exportToCsv(filename, headers, rows) {
  const escapeCell = (val) => {
    if (val == null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const csvContent = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => row.map(escapeCell).join(','))
  ].join('\r\n');

  // Prepend UTF-8 BOM for proper Excel encoding of rupee and special characters
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToExcel(filename, sheetName, headers, rows) {
  // Build standard Microsoft Excel XML Spreadsheet
  const headerXml = headers
    .map((h) => `<Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`)
    .join('');

  const rowsXml = rows
    .map(
      (row) =>
        `<Row>` +
        row
          .map((cell) => {
            const isNum = typeof cell === 'number' || (!isNaN(cell) && cell !== '' && typeof cell !== 'boolean');
            const type = isNum ? 'Number' : 'String';
            const value = isNum ? Number(cell) : escapeXml(cell != null ? String(cell) : '');
            return `<Cell><Data ss:Type="${type}">${value}</Data></Cell>`;
          })
          .join('') +
        `</Row>`
    )
    .join('\n');

  const excelTemplate = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
  </Style>
  <Style ss:ID="HeaderStyle">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#07564B"/>
   </Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#07564B" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${escapeXml(sheetName || 'Revenue Report')}">
  <Table>
   <Row ss:Height="24">
    ${headerXml}
   </Row>
   ${rowsXml}
  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.xls') ? filename : `${filename}.xls`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeXml(unsafe) {
  if (unsafe == null) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function printElement(elementId, title = 'Revenue Report') {
  const element = document.getElementById(elementId);
  if (!element) {
    window.print();
    return;
  }

  const printWindow = window.open('', '_blank', 'width=1100,height=800');
  if (!printWindow) {
    // If popups blocked, fall back to window.print()
    window.print();
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${escapeXml(title)}</title>
        <style>
          @page { size: landscape; margin: 15mm; }
          body {
            font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #1e293b;
            margin: 0;
            padding: 20px;
            background: #fff;
          }
          .print-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #07564B;
            padding-bottom: 12px;
            margin-bottom: 20px;
          }
          .print-header h1 {
            color: #07564B;
            margin: 0 0 4px 0;
            font-size: 22px;
          }
          .print-header p {
            margin: 0;
            color: #64748b;
            font-size: 12px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            margin-top: 10px;
          }
          th {
            background-color: #07564B;
            color: white;
            text-align: left;
            padding: 8px 10px;
            font-weight: 600;
          }
          td {
            padding: 8px 10px;
            border-bottom: 1px solid #e2e8f0;
          }
          tr:nth-child(even) td {
            background-color: #f8fafc;
          }
          .badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 9999px;
            font-weight: 600;
            font-size: 10px;
            text-transform: uppercase;
          }
          .badge-paid { background: #dcfce7; color: #15803d; }
          .badge-pending { background: #fef3c7; color: #b45309; }
          .badge-failed { background: #fee2e2; color: #b91c1c; }
          .badge-refunded { background: #f3e8ff; color: #7e22ce; }
          .no-print { display: none !important; }
        </style>
      </head>
      <body>
        <div class="print-header">
          <div>
            <h1>${escapeXml(title)}</h1>
            <p>Generated on ${new Date().toLocaleString('en-IN')}</p>
          </div>
          <div style="text-align: right;">
            <strong style="color: #07564B; font-size: 16px;">Sri Golds SaaS</strong>
            <p>Super Admin Financial Intelligence</p>
          </div>
        </div>
        ${element.innerHTML}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              window.close();
            }, 350);
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
