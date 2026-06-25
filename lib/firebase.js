import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// ---------- Auth ----------
export function loginWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

export function logout() {
  return firebaseSignOut(auth);
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function ensureUserProfile(firebaseUser) {
  const ref = doc(db, "users", firebaseUser.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return { id: firebaseUser.uid, ...snap.data() };
  }
  const profile = {
    name: firebaseUser.email.split("@")[0],
    email: firebaseUser.email,
    role: "staff",
    createdAt: serverTimestamp(),
  };
  await setDoc(ref, profile);
  return { id: firebaseUser.uid, ...profile };
}

export function watchUsers(callback) {
  const q = query(collection(db, "users"), orderBy("name"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function updateUserProfile(uid, data) {
  return updateDoc(doc(db, "users", uid), data);
}

// ---------- Suppliers ----------
export function watchSuppliers(callback) {
  const q = query(collection(db, "suppliers"), orderBy("name"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function addSupplier(data) {
  return addDoc(collection(db, "suppliers"), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

export async function updateSupplier(id, data) {
  return updateDoc(doc(db, "suppliers", id), data);
}

export async function deleteSupplier(id) {
  return deleteDoc(doc(db, "suppliers", id));
}

// ---------- Inventory ----------
export function watchInventory(callback) {
  const q = query(collection(db, "medicines"), orderBy("name"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function addMedicine(data) {
  return addDoc(collection(db, "medicines"), {
    ...data,
    avgCostPrice: data.costPrice || 0,
    createdAt: serverTimestamp(),
  });
}

export async function updateMedicine(id, data) {
  return updateDoc(doc(db, "medicines", id), data);
}

export async function deleteMedicine(id) {
  return deleteDoc(doc(db, "medicines", id));
}

// ---------- Purchases (Stock In) ----------
export function watchPurchases(callback) {
  const q = query(collection(db, "purchases"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

// Creates a purchase entry and increments stock + recalculates avg cost price
export async function createPurchase({
  supplierName,
  supplierId,
  invoiceNo,
  orderCode,
  supplyDate,
  remarks,
  items, // [{ id, name, qty, costPrice, salePrice }]
  misc,
  createdBy,
}) {
  return runTransaction(db, async (tx) => {
    for (const item of items) {
      const ref = doc(db, "medicines", item.id);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error(`${item.name} inventory mein nahi mila`);
      const d = snap.data();
      const oldStock = d.stock || 0;
      const oldAvg = d.avgCostPrice || d.costPrice || 0;
      const newStock = oldStock + item.qty;
      // Weighted average cost price
      const newAvg = newStock > 0
        ? (oldStock * oldAvg + item.qty * item.costPrice) / newStock
        : item.costPrice;

      tx.update(ref, {
        stock: newStock,
        costPrice: item.costPrice,
        avgCostPrice: Math.round(newAvg * 100) / 100,
        price: item.salePrice || d.price,
      });
    }

    const purchaseRef = doc(collection(db, "purchases"));
    tx.set(purchaseRef, {
      supplierName: supplierName || "",
      supplierId: supplierId || null,
      invoiceNo: invoiceNo || "",
      orderCode: orderCode || "",
      supplyDate: supplyDate || "",
      remarks: remarks || "",
      misc: Number(misc || 0),
      items,
      grandTotal: items.reduce((s, i) => s + i.costPrice * i.qty, 0) + Number(misc || 0),
      createdBy: createdBy || null,
      createdAt: serverTimestamp(),
    });

    return purchaseRef.id;
  });
}

// ---------- Sales ----------
export function watchSales(callback) {
  const q = query(collection(db, "sales"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

// GST rate constant (17% Pakistan standard — change if needed)
export const GST_RATE = 0.17;

export async function checkoutSale({
  items,
  customerName,
  customerPhone,
  subtotal,
  flatDiscount,
  miscCharges,
  applyGst,
  total,
  paymentMethod,
  createdBy,
}) {
  return runTransaction(db, async (tx) => {
    for (const item of items) {
      const ref = doc(db, "medicines", item.id);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error(`${item.name} no longer exists in inventory`);
      const currentStock = snap.data().stock || 0;
      if (currentStock < item.qty) {
        throw new Error(`${item.name} ke paas sirf ${currentStock} units stock hai`);
      }
      tx.update(ref, { stock: currentStock - item.qty });
    }

    const saleRef = doc(collection(db, "sales"));
    tx.set(saleRef, {
      items,
      customerName: customerName || "Walk-in",
      customerPhone: customerPhone || "",
      subtotal: subtotal || 0,
      flatDiscount: flatDiscount || 0,
      miscCharges: miscCharges || 0,
      applyGst: applyGst || false,
      gstAmount: applyGst ? Math.round(subtotal * GST_RATE) : 0,
      total,
      paymentMethod: paymentMethod || "Cash",
      createdBy: createdBy || null,
      createdAt: serverTimestamp(),
    });

    return saleRef.id;
  });
}

// ---------- Helpers ----------
export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  const target = new Date(dateStr);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

export function expiryStatus(dateStr) {
  const d = daysUntil(dateStr);
  if (d === null) return "unknown";
  if (d < 0) return "expired";
  if (d <= 60) return "warning";
  return "safe";
}
