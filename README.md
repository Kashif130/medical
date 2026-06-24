# Umer Din Medical Store — POS

Next.js + Firebase (Firestore + Auth) par bana hua production-ready POS system,
partnership ke liye accountability built-in:

- **Login required** — koi bhi page bina login khul nahi sakta
- **Two roles** — `admin` (partners) aur `staff` (counter staff)
- **Billing/Cart** — checkout par stock automatically Firestore transaction se kam hota hai
- **Inventory** — add/edit sab kar sakte hain, lekin **delete sirf admin (partner)** kar sakta hai
- **Expiry tracking** — har row par color strip: green (safe), amber (60 din mein expire), red (expired)
- **Sales History** — har bill ke saath "Sold by" — pata chalta hai kis staff member ne bill banaya
- **Print-friendly receipt** — checkout ke baad "Print receipt" button
- **Reports (admin only)** — daily revenue, cost, net profit — dono partners dekh sakein
- **Staff & Roles (admin only)** — partners staff ko admin/staff role assign kar sakte hain

## 1. Firebase setup

1. [firebase.google.com](https://firebase.google.com) → new project banayein.
2. **Authentication** → Sign-in method → **Email/Password** ko enable karein.
3. Authentication → Users tab → "Add user" se sab staff/partner accounts manually banayein
   (email + temporary password). Yeh password baad mein staff khud change kar sakte hain
   (Firebase console se ya app mein "forgot password" add karwa kar).
4. **Firestore Database** → Create database → production mode.
5. Firestore → Rules tab → is repo ki `firestore.rules` file ka content paste karein → Publish.
6. Project Settings → General → "Your apps" → Web app (`</>`) add karein, config keys copy karein.
7. Root mein `.env.local` banayein (`.env.local.example` copy karein) aur keys daal dein.

## 2. Pehla partner/admin account banana (zaroori)

Naya account by default **staff** role ke saath banta hai (security ke liye — koi khud
ko admin nahin bana sakta). Dono partners ko admin banane ke liye:

1. Apna account Firebase Console (Authentication) se bana lein aur app mein ek baar login
   karein — is se Firestore mein `users/{your-uid}` doc apne aap ban jayega.
2. Firestore Console → `users` collection → apna document open karein → `role` field ko
   `"staff"` se `"admin"` mein manually edit karein.
3. Doosre partner ke saath bhi yehi step repeat karein.
4. Iske baad partners app ke "Staff & Roles" page se baqi sab (naye staff) ko role assign
   kar sakte hain — Firestore console kholne ki zaroorat nahi rahegi.

## 3. Naya staff member add karna (roz-mara)

1. Firebase Console → Authentication → "Add user" (email + password).
2. Us staff member se kahein ek baar app mein login karein.
3. Unka naam "Staff & Roles" page mein dikh jayega (default role: staff).

## 4. Local run

```bash
npm install
npm run dev
```

`http://localhost:3000` khol lein — login screen aayega, apne account se login karein.

## 5. Deploy to Vercel

1. Folder GitHub repo bana kar push karein.
2. Vercel → "Import Project" → repo select karein.
3. Environment Variables mein wahi 6 `NEXT_PUBLIC_FIREBASE_*` keys daalein.
4. Deploy.

## How partnership-safety features work

- **Audit trail**: har sale `createdBy` (uid + name) ke saath save hoti hai — Sales History
  mein "Sold by" column se hamesha pata chalega kis ne kya bill bana.
- **Delete protection**: Firestore rules level par bhi enforce hai (sirf code mein nahi) —
  koi staff account directly Firestore se bhi medicine delete nahi kar sakta, sirf admin role wala account.
- **Sales records lock**: ek baar bill ban jaye to staff use edit/delete nahi kar sakta,
  sirf admin (disputed transaction correct karne ke liye).
- **Reports page**: sirf admin role dekh sakta hai, taake daily profit/cost dono partners
  ke liye transparent rahe lekin counter staff ke saamne na ho.

## Notes

- Profit calculation Inventory ke "Cost price" field se aata hai — har medicine add karte
  waqt cost price zaroor bharein, warna Reports page profit ko galat dikhayega.
- `firestore.rules` already secure hain (auth + role required) — yeh sirf demo nahi hai,
  production ke liye ready hai.
- Receipt store name/address/phone `components/Receipt.js` mein top par change kar sakte hain.
