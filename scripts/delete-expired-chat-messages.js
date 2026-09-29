const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

// Parse the service account credentials passed from GitHub Secrets
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

// Initialize Firebase Admin using the v12+ modular syntax
initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function deleteExpiredMessages() {
  const now = Timestamp.now();
  console.log("Starting expired message cleanup...");

  const snapshot = await db.collectionGroup("messages")
    .where("expireAt", "<=", now)
    .limit(500)
    .get();

  if (snapshot.empty) {
    console.log("No expired messages found.");
    return;
  }

  const batch = db.batch();
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });

  await batch.commit();
  console.log(`Successfully deleted ${snapshot.size} expired messages.`);
}

deleteExpiredMessages()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Cleanup error:", err);
    process.exit(1);
  });
