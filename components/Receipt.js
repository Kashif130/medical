"use client";

export default function Receipt({ bill, storeName = "Umer Din Medical Store", storeAddress = "", storePhone = "" }) {
  if (!bill) return null;

  const date = bill.date || new Date();

  return (
    <div className="receipt-print hidden">
      <div className="receipt-paper">
        <div className="receipt-header">
          <p className="receipt-store">{storeName}</p>
          {storeAddress && <p className="receipt-meta">{storeAddress}</p>}
          {storePhone && <p className="receipt-meta">{storePhone}</p>}
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
              <th align="right">Total</th>
            </tr>
          </thead>
          <tbody>
            {bill.items.map((i) => (
              <tr key={i.id}>
                <td>{i.name}</td>
                <td align="center">{i.qty}</td>
                <td align="right">{i.price}</td>
                <td align="right">{(i.price * i.qty).toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="receipt-divider" />

        <div className="receipt-totals">
          <div><span>Subtotal</span><span>Rs. {bill.subtotal.toFixed(0)}</span></div>
          <div><span>Discount</span><span>- Rs. {bill.discount.toFixed(0)}</span></div>
          <div className="receipt-grand"><span>Total</span><span>Rs. {bill.total.toFixed(0)}</span></div>
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
        .receipt-footer { text-align: center; font-size: 11px; margin-top: 8px; }
      `}</style>
    </div>
  );
}
