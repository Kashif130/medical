"use client";

const DEFAULT_ADDRESS = "Chak No.128/9L, Near Govt Girls High School";
const DEFAULT_PHONE   = "03116126145";

function buildQrData(bill, storeName) {
  const date = bill.date instanceof Date ? bill.date : new Date();
  const inv  = (bill.id||"").slice(-8).toUpperCase();
  return `${storeName}\nInvoice #${inv}\nDate: ${date.toLocaleDateString()}\nTotal: Rs.${Math.round(bill.total||0)}`;
}

export default function Receipt({ bill, storeName = "Umer Din Medical Store", storeAddress = DEFAULT_ADDRESS, storePhone = DEFAULT_PHONE }) {
  if (!bill) return null;

  const date = bill.date || new Date();
  const qrSrc = `https://chart.googleapis.com/chart?chs=110x110&cht=qr&chl=${encodeURIComponent(buildQrData(bill, storeName))}&choe=UTF-8`;
  // Fallback: derive discount from items if the bill object doesn't carry a saved totalDiscount
  const itemsDiscount = (bill.items||[]).reduce((s,i)=>s+(Number(i.discount)||0)*(i.qty||0), 0);
  const totalDiscount = (bill.totalDiscount && bill.totalDiscount > 0) ? bill.totalDiscount : itemsDiscount;

  return (
    <div className="receipt-print hidden">
      <div className="receipt-paper">
        <div className="receipt-header">
          <p className="receipt-store">{storeName}</p>
          {storeAddress && <p className="receipt-meta">{storeAddress}</p>}
          {storePhone && <p className="receipt-meta">Ph: {storePhone}</p>}
        </div>

        <div className="receipt-divider" />

        <div className="receipt-meta-row">
          <span>{date.toLocaleDateString()} {date.toLocaleTimeString()}</span>
          <span>Bill #{bill.id ? bill.id.slice(-6).toUpperCase() : "------"}</span>
        </div>
        <div className="receipt-meta-row">
          <span>Customer: {bill.customerName || "Walk-in"}</span>
          <span>{bill.paymentMethod}</span>
        </div>
        {bill.soldBy && (
          <div className="receipt-meta-row">
            <span>Sold by: {bill.soldBy}</span>
          </div>
        )}

        <div className="receipt-divider" />

        <table className="receipt-table">
          <thead>
            <tr>
              <th align="left">Item</th>
              <th align="center">Qty</th>
              <th align="right">Price</th>
              <th align="right">Disc</th>
              <th align="right">Total</th>
            </tr>
          </thead>
          <tbody>
            {bill.items.map((i) => {
              const disc    = Number(i.discount||0);
              const netUnit = Math.max(0, i.price - disc);
              const lineDiscTotal = disc*i.qty;
              return (
                <tr key={i.id}>
                  <td>{i.name}</td>
                  <td align="center">{i.qty}</td>
                  <td align="right">{i.price}</td>
                  <td align="right">{disc>0 ? lineDiscTotal.toFixed(0) : "-"}</td>
                  <td align="right">{(netUnit * i.qty).toFixed(0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="receipt-divider" />

        <div className="receipt-totals">
          <div><span>Subtotal</span><span>Rs. {(bill.subtotal||0).toFixed(0)}</span></div>
          {(totalDiscount||0) > 0 && (
            <div><span>Total Discount</span><span>- Rs. {totalDiscount.toFixed(0)}</span></div>
          )}
          {(bill.gstAmount||0) > 0 && (
            <div><span>GST (17%)</span><span>Rs. {bill.gstAmount.toFixed(0)}</span></div>
          )}
          {(bill.miscCharges||0) > 0 && (
            <div><span>Misc</span><span>Rs. {bill.miscCharges.toFixed(0)}</span></div>
          )}
          <div className="receipt-grand"><span>Total</span><span>Rs. {(bill.total||0).toFixed(0)}</span></div>
        </div>

        <div className="receipt-divider" />
        <div className="receipt-qr">
          <img src={qrSrc} width={90} height={90} alt="Bill QR"/>
          <p className="receipt-qr-label">Scan to verify bill</p>
        </div>
        <div className="receipt-divider" />
        <p className="receipt-footer">Shukriya! Sehat mand rahein.</p>
      </div>

      <style jsx global>{`
        .receipt-print { display: none; }
        @media print {
          body * { visibility: hidden; }
          .receipt-print, .receipt-print * { visibility: visible; }
          .receipt-print {
            display: block !important;
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
          }
        }
        .receipt-paper {
          width: 300px;
          margin: 0 auto;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 12px;
          color: #10211C;
          padding: 16px;
        }
        .receipt-header { text-align: center; margin-bottom: 6px; }
        .receipt-store { font-weight: 700; font-size: 14px; }
        .receipt-meta { font-size: 11px; color: #444; }
        .receipt-divider { border-top: 1px dashed #888; margin: 8px 0; }
        .receipt-meta-row { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 2px; }
        .receipt-table { width: 100%; border-collapse: collapse; font-size: 11px; }
        .receipt-table th { font-size: 10px; text-transform: uppercase; padding-bottom: 4px; }
        .receipt-table td { padding: 2px 0; }
        .receipt-totals div { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 2px; }
        .receipt-grand { font-weight: 700; font-size: 14px; margin-top: 4px; }
        .receipt-qr { text-align: center; }
        .receipt-qr-label { font-size: 9px; color: #666; margin-top: 3px; }
        .receipt-footer { text-align: center; font-size: 11px; margin-top: 8px; }
      `}</style>
    </div>
  );
}
