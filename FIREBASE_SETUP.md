# Firebase / Vercel setup

Firebase settings are optional. When they are not set, the app keeps using browser localStorage.

## Environment variables

Add these values to `.env.local` and Vercel Environment Variables when Firestore sharing is used:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

## Firestore collections

- `ubalog_records`
- `ubalog_realtime_offers`

## Temporary Firestore rules

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /ubalog_records/{docId} {
      allow read, write: if true;
    }
    match /ubalog_realtime_offers/{docId} {
      allow read, write: if true;
    }
    match /ubalog_news/{docId} {
      allow read, write: if true;
    }
  }
}
```

These rules are only for temporary development checks. `allow read, write: if true` means anyone who can reach the project can read and write data, so it is dangerous for public operation.

The app now performs basic client-side validation before writing records and realtime offers, but client-side checks are not a complete security boundary. Before serious production operation, tighten the rules and add Firebase Auth, App Check, Cloud Functions validation, or stricter Security Rules.

For a short test publish without Auth, keep the rules temporary and monitor the project closely. A minimal test-only rules shape can separate collections and keep the scope clear, but it still cannot fully protect writes without Auth:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /ubalog_records/{docId} {
      allow read: if true;
      allow write: if true;
    }
    match /ubalog_realtime_offers/{docId} {
      allow read: if true;
      allow write: if true;
    }
  }
}
```

## Production URL

GitHub is the source code location. The public app URL is the Vercel Production Deployment URL. Check Vercel Dashboard > Project > Deployments and use a Ready production URL. For a custom domain, add it from Vercel Project Settings > Domains.
