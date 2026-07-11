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
export const addMedicine     = (d)  => addDoc(collection(db,"medicines"), {...d, avgCostPrice: d.costPrice||0, createdAt: serverTimestamp()});
export const updateMedicine  = (id,d) => updateDoc(doc(db,"medicines",id), d);
export const deleteMedicine  = (id)   => deleteDoc(doc(db,"medicines",id));

// ── Purchases ─────────────────────────────────────────────
export const watchPurchases = (cb) => onSnapshot(query(collection(db,"purchases"), orderBy("createdAt","desc")), s => cb(s.docs.map(d=>({id:d.id,...d.data()}))));

export async function createPurchase({ supplierName, supplierId, invoiceNo, orderCode, supplyDate, remarks, items, misc, createdBy }) {
  return runTransaction(db, async (tx) => {
    for (const item of items) {
      const ref  = doc(db,"medicines",item.id);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error(`${item.name} inventory mein nahi mila`);
      const d       = snap.data();
      const newStock = (d.stock||0) + item.qty;
      const newAvg   = newStock > 0 ? ((d.stock||0)*(d.avgCostPrice||d.costPrice||0) + item.qty*item.costPrice)/newStock : item.costPrice;
      tx.update(ref, { stock: newStock, costPrice: item.costPrice, avgCostPrice: Math.round(newAvg*100)/100, price: item.salePrice||d.price });
    }
    const pRef = doc(collection(db,"purchases"));
    tx.set(pRef, { supplierName:supplierName||"", supplierId:supplierId||null, invoiceNo:invoiceNo||"", orderCode:orderCode||"", supplyDate:supplyDate||"", remarks:remarks||"", misc:Number(misc||0), items, grandTotal: items.reduce((s,i)=>s+i.costPrice*i.qty,0)+Number(misc||0), createdBy:createdBy||null, createdAt:serverTimestamp() });
    return pRef.id;
  });
}

// ── Sales ─────────────────────────────────────────────────
export const watchSales = (cb) => onSnapshot(query(collection(db,"sales"), orderBy("createdAt","desc")), s => cb(s.docs.map(d=>({id:d.id,...d.data()}))));
export const GST_RATE   = 0.17;

export async function checkoutSale({ items, customerName, customerPhone, subtotal, flatDiscount, miscCharges, applyGst, total, paymentMethod, createdBy }) {
  return runTransaction(db, async (tx) => {
    for (const item of items) {
      const ref  = doc(db,"medicines",item.id);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error(`${item.name} nahi mila`);
      const cur = snap.data().stock||0;
      if (cur < item.qty) throw new Error(`${item.name}: sirf ${cur} units bachi hain`);
      tx.update(ref, { stock: cur - item.qty });
    }
    const sRef = doc(collection(db,"sales"));
    tx.set(sRef, { items, customerName:customerName||"Walk-in", customerPhone:customerPhone||"", subtotal:subtotal||0, flatDiscount:flatDiscount||0, miscCharges:miscCharges||0, applyGst:applyGst||false, gstAmount:applyGst?Math.round(subtotal*GST_RATE):0, total, paymentMethod:paymentMethod||"Cash", createdBy:createdBy||null, createdAt:serverTimestamp() });
    return sRef.id;
  });
}

// ── Returns / Refunds ─────────────────────────────────────
export const watchReturns = (cb) => onSnapshot(query(collection(db,"returns"), orderBy("createdAt","desc")), s => cb(s.docs.map(d=>({id:d.id,...d.data()}))));

export async function createReturn({ saleId, items, reason, refundAmount, refundMethod, createdBy }) {
  return runTransaction(db, async (tx) => {
    for (const item of items) {
      const ref  = doc(db,"medicines",item.id);
      const snap = await tx.get(ref);
      if (snap.exists()) tx.update(ref, { stock: (snap.data().stock||0) + item.qty });
    }
    const rRef = doc(collection(db,"returns"));
    tx.set(rRef, { saleId, items, reason:reason||"", refundAmount, refundMethod:refundMethod||"Cash", createdBy:createdBy||null, createdAt:serverTimestamp() });
    return rRef.id;
  });
}

// ── Credit Sales (Udhar) ──────────────────────────────────
export const watchCredits = (cb) => onSnapshot(query(collection(db,"credits"), orderBy("createdAt","desc")), s => cb(s.docs.map(d=>({id:d.id,...d.data()}))));

export async function checkoutCreditSale({ items, customerName, customerPhone, subtotal, flatDiscount, miscCharges, applyGst, total, createdBy }) {
  return runTransaction(db, async (tx) => {
    for (const item of items) {
      const ref  = doc(db,"medicines",item.id);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error(`${item.name} nahi mila`);
      const cur = snap.data().stock||0;
      if (cur < item.qty) throw new Error(`${item.name}: sirf ${cur} units`);
      tx.update(ref, { stock: cur - item.qty });
    }
    const cRef = doc(collection(db,"credits"));
    tx.set(cRef, { items, customerName:customerName||"", customerPhone:customerPhone||"", subtotal:subtotal||0, flatDiscount:flatDiscount||0, miscCharges:miscCharges||0, applyGst:applyGst||false, gstAmount:applyGst?Math.round(subtotal*GST_RATE):0, totalAmount:total, paidAmount:0, remaining:total, status:"pending", payments:[], createdBy:createdBy||null, createdAt:serverTimestamp() });
    return cRef.id;
  });
}

export async function addCreditPayment(creditId, amount, createdBy) {
  return runTransaction(db, async (tx) => {
    const ref  = doc(db,"credits",creditId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Credit record nahi mila");
    const d         = snap.data();
    const newPaid   = (d.paidAmount||0) + Number(amount);
    const remaining = Math.max(0, d.totalAmount - newPaid);
    const status    = remaining <= 0 ? "paid" : "partial";
    tx.update(ref, {
      paidAmount: newPaid, remaining, status,
      payments: [...(d.payments||[]), { amount: Number(amount), date: new Date().toISOString(), by: createdBy?.name||"" }],
    });
  });
}

// ── Backup Export ─────────────────────────────────────────
export async function fetchAllForBackup() {
  const cols = ["medicines","sales","purchases","credits","returns","suppliers"];
  const results = await Promise.all(cols.map(c => getDocs(collection(db, c))));
  const out = { exportedAt: new Date().toISOString() };
  cols.forEach((c, i) => { out[c] = results[i].docs.map(d => ({ id: d.id, ...d.data() })); });
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
