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

// Fetches the /users/{uid} profile doc. If it doesn't exist yet (first ever
// login for this account), creates it with the default "staff" role.
// Partners should promote themselves to "admin" once via Firestore console
// (see README) — this keeps account creation simple without a backend.
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

// ---------- Inventory ----------
export function watchInventory(callback) {
  const q = query(collection(db, "medicines"), orderBy("name"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, (error) => {
    // If index missing or permission error, fallback without orderBy
    console.error("watchInventory error:", error);
    const fallback = query(collection(db, "medicines"));
    onSnapshot(fallback, (snap) => {
      const sorted = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      callback(sorted);
    });
  });
}

export async function addMedicine(data) {
  return addDoc(collection(db, "medicines"), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

export async function updateMedicine(id, data) {
  return updateDoc(doc(db, "medicines", id), data);
}

export async function deleteMedicine(id) {
  return deleteDoc(doc(db, "medicines", id));
}

// ---------- Sales ----------
export function watchSales(callback) {
  const q = query(collection(db, "sales"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, (error) => {
    console.error("watchSales error:", error);
    const fallback = query(collection(db, "sales"));
    onSnapshot(fallback, (snap) => {
      const sorted = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() || 0;
          const tb = b.createdAt?.toMillis?.() || 0;
          return tb - ta;
        });
      callback(sorted);
    });
  });
}

// Creates a sale and decrements stock for each cart item in one transaction
export async function checkoutSale({ items, customerName, customerPhone, total, discount, paymentMethod, createdBy }) {
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
      total,
      discount: discount || 0,
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
