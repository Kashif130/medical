import { initializeApp, getApps } from "firebase/app";
import {
  getAuth, signInWithEmailAndPassword, signOut as firebaseSignOut, onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc,
  deleteDoc, onSnapshot, query, orderBy, serverTimestamp, runTransaction,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db   = getFirestore(app);
export const auth = getAuth(app);

// ── Auth ──────────────────────────────────────────────────
export const loginWithEmail = (e, p) => signInWithEmailAndPassword(auth, e.trim(), p);
export const logout         = ()     => firebaseSignOut(auth);
export const watchAuth      = (cb)   => onAuthStateChanged(auth, cb);

export async function ensureUserProfile(u) {
  const ref  = doc(db, "users", u.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return { id: u.uid, ...snap.data() };
  const profile = { name: u.email.split("@")[0], email: u.email, role: "staff", createdAt: serverTimestamp() };
  await setDoc(ref, profile);
  return { id: u.uid, ...profile };
}

export const watchUsers        = (cb) => onSnapshot(query(collection(db,"users"), orderBy("name")), s => cb(s.docs.map(d=>({id:d.id,...d.data()}))));
export const updateUserProfile = (uid, data) => updateDoc(doc(db,"users",uid), data);

// ── Suppliers ─────────────────────────────────────────────
export const watchSuppliers  = (cb) => onSnapshot(query(collection(db,"suppliers"), orderBy("name")), s => cb(s.docs.map(d=>({id:d.id,...d.data()}))));
export const addSupplier     = (d)  => addDoc(collection(db,"suppliers"), {...d, createdAt: serverTimestamp()});
export const updateSupplier  = (id,d) => updateDoc(doc(db,"suppliers",id), d);
export const deleteSupplier  = (id)   => deleteDoc(doc(db,"suppliers",id));

// ── Inventory ─────────────────────────────────────────────
export const watchInventory  = (cb) => onSnapshot(query(collection(db,"medicines"), orderBy("name")), s => cb(s.docs.map(d=>({id:d.id,...d.data()}))));
export const addMedicine     = (d)  => addDoc(collection(db,"medicines"), {...d, genericName:d.genericName||"", avgCostPrice:d.costPrice||0, createdAt:serverTimestamp()});
export const updateMedicine  = (id,d) => updateDoc(doc(db,"medicines",id), d);
export const deleteMedicine  = (id)   => deleteDoc(doc(db,"medicines",id));

// ── Purchases ─────────────────────────────────────────────
export const watchPurchases = (cb) => onSnapshot(query(collection(db,"purchases"), orderBy("createdAt","desc")), s => cb(s.docs.map(d=>({id:d.id,...d.data()}))));

export async function createPurchase({ supplierName, supplierId, invoiceNo, orderCode, supplyDate, remarks, items, misc, createdBy }) {
  return runTransaction(db, async (tx) => {
    // ── READS FIRST ──
    const snaps = await Promise.all(items.map(item => tx.get(doc(db,"medicines",item.id))));

    // ── WRITES AFTER ──
    snaps.forEach((snap, i) => {
      const item = items[i];
      if (!snap.exists()) throw new Error(`${item.name} inventory mein nahi mila`);
      const d        = snap.data();
      const newStock = (d.stock||0) + item.qty;
      const newAvg   = newStock>0 ? ((d.stock||0)*(d.avgCostPrice||d.costPrice||0)+item.qty*item.costPrice)/newStock : item.costPrice;
      tx.update(doc(db,"medicines",item.id), {
        stock:newStock, costPrice:item.costPrice,
        avgCostPrice:Math.round(newAvg*100)/100,
        price:item.salePrice||d.price,
      });
    });

    const pRef = doc(collection(db,"purchases"));
    tx.set(pRef, {
      supplierName:supplierName||"", supplierId:supplierId||null,
      invoiceNo:invoiceNo||"", orderCode:orderCode||"",
      supplyDate:supplyDate||"", remarks:remarks||"",
      misc:Number(misc||0), items,
      grandTotal:items.reduce((s,i)=>s+i.costPrice*i.qty,0)+Number(misc||0),
      createdBy:createdBy||null, createdAt:serverTimestamp(),
    });
    return pRef.id;
  });
}

// ── Sales ─────────────────────────────────────────────────
export const watchSales = (cb) => onSnapshot(query(collection(db,"sales"), orderBy("createdAt","desc")), s => cb(s.docs.map(d=>({id:d.id,...d.data()}))));
export const GST_RATE   = 0.17;

export async function checkoutSale({ items, customerName, customerPhone, subtotal, flatDiscount, miscCharges, applyGst, total, paymentMethod, createdBy }) {
  return runTransaction(db, async (tx) => {
    // ── ALL READS FIRST ──
    const snaps = await Promise.all(items.map(item => tx.get(doc(db,"medicines",item.id))));

    // ── VALIDATE ──
    snaps.forEach((snap, i) => {
      const item = items[i];
      if (!snap.exists()) throw new Error(`${item.name} nahi mila`);
      const cur = snap.data().stock||0;
      if (cur < item.qty) throw new Error(`${item.name}: sirf ${cur} units bachi hain`);
    });

    // ── ALL WRITES AFTER ──
    snaps.forEach((snap, i) => {
      const item = items[i];
      const cur  = snap.data().stock||0;
      tx.update(doc(db,"medicines",item.id), { stock: cur - item.qty });
    });

    const sRef = doc(collection(db,"sales"));
    tx.set(sRef, {
      items, customerName:customerName||"Walk-in", customerPhone:customerPhone||"",
      subtotal:subtotal||0, flatDiscount:flatDiscount||0, miscCharges:miscCharges||0,
      applyGst:applyGst||false, gstAmount:applyGst?Math.round(subtotal*GST_RATE):0,
      total, paymentMethod:paymentMethod||"Cash",
      returnedAmount:0, returnedItems:[], hasReturn:false,
      createdBy:createdBy||null, createdAt:serverTimestamp(),
    });
    return sRef.id;
  });
}

// ── Returns ───────────────────────────────────────────────
export const watchReturns = (cb) => onSnapshot(query(collection(db,"returns"), orderBy("createdAt","desc")), s => cb(s.docs.map(d=>({id:d.id,...d.data()}))));

export async function createReturn({ saleId, items, reason, refundAmount, refundMethod, createdBy }) {
  return runTransaction(db, async (tx) => {
    // ── ALL READS FIRST ──
    const medSnaps  = await Promise.all(items.map(item => tx.get(doc(db,"medicines",item.id))));
    const saleSnap  = (saleId && !saleId.startsWith("OFFLINE"))
      ? await tx.get(doc(db,"sales",saleId))
      : null;

    // ── ALL WRITES AFTER ──
    medSnaps.forEach((snap, i) => {
      if (snap.exists()) {
        tx.update(doc(db,"medicines",items[i].id), { stock: (snap.data().stock||0) + items[i].qty });
      }
    });

    if (saleSnap?.exists()) {
      const sd      = saleSnap.data();
      const newRet  = (sd.returnedAmount||0) + refundAmount;
      tx.update(doc(db,"sales",saleId), {
        returnedAmount: newRet,
        netTotal: (sd.total||0) - newRet,
        hasReturn: true,
        returnedItems: [...(sd.returnedItems||[]), ...items.map(i=>({...i, refundedAt:new Date().toISOString()}))],
      });
    }

    const rRef = doc(collection(db,"returns"));
    tx.set(rRef, {
      saleId, items, reason:reason||"", refundAmount,
      refundMethod:refundMethod||"Cash",
      createdBy:createdBy||null, createdAt:serverTimestamp(),
    });
    return rRef.id;
  });
}

// ── Credits ───────────────────────────────────────────────
export const watchCredits = (cb) => onSnapshot(query(collection(db,"credits"), orderBy("createdAt","desc")), s => cb(s.docs.map(d=>({id:d.id,...d.data()}))));

export async function checkoutCreditSale({ items, customerName, customerPhone, subtotal, flatDiscount, miscCharges, applyGst, total, createdBy }) {
  return runTransaction(db, async (tx) => {
    // ── ALL READS FIRST ──
    const snaps = await Promise.all(items.map(item => tx.get(doc(db,"medicines",item.id))));

    // ── VALIDATE ──
    snaps.forEach((snap, i) => {
      const item = items[i];
      if (!snap.exists()) throw new Error(`${item.name} nahi mila`);
      const cur = snap.data().stock||0;
      if (cur < item.qty) throw new Error(`${item.name}: sirf ${cur} units`);
    });

    // ── ALL WRITES AFTER ──
    snaps.forEach((snap, i) => {
      tx.update(doc(db,"medicines",items[i].id), { stock: (snap.data().stock||0) - items[i].qty });
    });

    const cRef = doc(collection(db,"credits"));
    tx.set(cRef, {
      items, customerName:customerName||"", customerPhone:customerPhone||"",
      subtotal:subtotal||0, flatDiscount:flatDiscount||0, miscCharges:miscCharges||0,
      applyGst:applyGst||false, gstAmount:applyGst?Math.round(subtotal*GST_RATE):0,
      totalAmount:total, paidAmount:0, remaining:total, status:"pending", payments:[],
      returnedAmount:0, hasReturn:false,
      createdBy:createdBy||null, createdAt:serverTimestamp(),
    });
    return cRef.id;
  });
}

export async function addCreditPayment(creditId, amount, createdBy) {
  return runTransaction(db, async (tx) => {
    // ── READ FIRST ──
    const snap = await tx.get(doc(db,"credits",creditId));
    if (!snap.exists()) throw new Error("Credit record nahi mila");

    // ── WRITE AFTER ──
    const d         = snap.data();
    const newPaid   = (d.paidAmount||0) + Number(amount);
    const remaining = Math.max(0, d.totalAmount - newPaid);
    tx.update(doc(db,"credits",creditId), {
      paidAmount:newPaid, remaining,
      status:remaining<=0?"paid":"partial",
      payments:[...(d.payments||[]),{amount:Number(amount),date:new Date().toISOString(),by:createdBy?.name||""}],
    });
  });
}

// ── Profit per medicine ───────────────────────────────────
export async function fetchProfitPerMedicine() {
  const [salesSnap, medsSnap] = await Promise.all([
    getDocs(collection(db,"sales")),
    getDocs(collection(db,"medicines")),
  ]);
  const medMap = {};
  medsSnap.docs.forEach(d => { medMap[d.id] = { id:d.id, ...d.data() }; });
  const profit = {};
  salesSnap.docs.forEach(d => {
    const s = d.data();
    (s.items||[]).forEach(item => {
      if (!profit[item.id]) profit[item.id] = { id:item.id, name:item.name, totalQty:0, totalRevenue:0, totalCost:0 };
      profit[item.id].totalQty     += item.qty;
      profit[item.id].totalRevenue += item.price * item.qty;
      profit[item.id].totalCost    += (item.costPrice||0) * item.qty;
    });
  });
  return Object.values(profit).map(p => ({
    ...p,
    totalProfit: p.totalRevenue - p.totalCost,
    margin: p.totalRevenue>0 ? ((p.totalRevenue-p.totalCost)/p.totalRevenue*100).toFixed(1) : "0",
    currentStock: medMap[p.id]?.stock ?? "—",
    category:     medMap[p.id]?.category || "",
  })).sort((a,b) => b.totalProfit - a.totalProfit);
}

// ── Practitioner services (checkup, injection, dressing etc.) ──
export const watchPractitionerServices = (cb) => onSnapshot(query(collection(db,"practitionerServices"), orderBy("name")), s => cb(s.docs.map(d=>({id:d.id,...d.data()}))));
export const addPractitionerService    = (d)  => addDoc(collection(db,"practitionerServices"), {...d, active:true, createdAt:serverTimestamp()});
export const updatePractitionerService = (id,d) => updateDoc(doc(db,"practitionerServices",id), d);
export const deletePractitionerService = (id)   => deleteDoc(doc(db,"practitionerServices",id));

// ── Practitioner visits ──────────────────────────────────
export const watchPractitionerVisits = (cb) => onSnapshot(query(collection(db,"practitionerVisits"), orderBy("createdAt","desc")), s => cb(s.docs.map(d=>({id:d.id,...d.data()}))));

export async function addPractitionerVisit({ patientName, patientPhone, services, discount, paymentMethod, notes, createdBy }) {
  const subtotal = services.reduce((s,i) => s + Number(i.fee||0), 0);
  const total    = Math.max(0, subtotal - Number(discount||0));
  return addDoc(collection(db,"practitionerVisits"), {
    patientName: patientName||"Walk-in",
    patientPhone: patientPhone||"",
    services, subtotal, discount:Number(discount||0), total,
    paymentMethod: paymentMethod||"Cash",
    notes: notes||"",
    createdBy: createdBy||null,
    createdAt: serverTimestamp(),
  });
}

export const updatePractitionerVisit = (id,d) => updateDoc(doc(db,"practitionerVisits",id), d);
export const deletePractitionerVisit = (id)   => deleteDoc(doc(db,"practitionerVisits",id));

// ── Backup ────────────────────────────────────────────────
export async function fetchAllForBackup() {
  const cols    = ["medicines","sales","purchases","credits","returns","suppliers"];
  const results = await Promise.all(cols.map(c => getDocs(collection(db,c))));
  const out     = { exportedAt: new Date().toISOString() };
  cols.forEach((c,i) => { out[c] = results[i].docs.map(d=>({id:d.id,...d.data()})); });
  return out;
}

// ── Helpers ───────────────────────────────────────────────
export function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / (1000*60*60*24));
}
export function expiryStatus(dateStr) {
  const d = daysUntil(dateStr);
  if (d===null) return "unknown";
  if (d<0)      return "expired";
  if (d<=60)    return "warning";
  return "safe";
}
