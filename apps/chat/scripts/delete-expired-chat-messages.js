const admin = require('firebase-admin');

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error('ERROR: FIREBASE_SERVICE_ACCOUNT environment variable is missing.');
  process.exit(1);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function deleteExpiredMessages() {
  console.log('Starting expired message cleanup...');
  const messagesRef = db.collectionGroup('messages');
  const now = admin.firestore.Timestamp.now();

  let totalDeleted = 0;
  let hasMore = true;

  while (hasMore) {
    const snapshot = await messagesRef.where('expireAt', '<', now).limit(500).get();

    if (snapshot.empty) {
      console.log('No more expired messages found.');
      hasMore = false;
      break;
    }

    console.log(`Found ${snapshot.size} expired messages in this batch. Deleting...`);
    const batch = db.batch();

    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    totalDeleted += snapshot.size;
    console.log(`Successfully deleted ${snapshot.size} messages.`);
  }

  console.log(`Cleanup complete. Total expired messages deleted: ${totalDeleted}`);
}

deleteExpiredMessages().catch((error) => {
  console.error('Fatal error during expired message deletion:', error);
  process.exit(1);
});
