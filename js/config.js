// Settings for the "Dasman Members" join form.
// Both keys are public by design and safe to keep in this public repo.
window.DASMAN_CONFIG = {
  // Web3Forms access key. Create it at https://web3forms.com with Dasman_sa@hotmail.com:
  // the key is emailed to that inbox, and every registration is delivered there.
  web3formsKey: "742c46ad-034f-4228-b353-08a13656c7d6",

  // Firebase project that stores the registered-members counter
  // (Firestore document "stats/members" with a number field "count").
  // Copy apiKey and projectId from Firebase console > Project settings > Your apps.
  // Leave them empty to hide the counter.
  firebase: {
    apiKey: "AIzaSyDrIyYY2RAAu6p6UqQYvhtWhsy6mw-Vl_A",
    projectId: "dasman-48189",
  },
};
