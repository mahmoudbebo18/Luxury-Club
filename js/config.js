// Settings for the "Dasman Members" join form.
// Both keys are public by design and safe to keep in this public repo.
window.DASMAN_CONFIG = {
  // Web3Forms access key. Create it at https://web3forms.com with Dasman_sa@hotmail.com:
  // the key is emailed to that inbox, and every registration is delivered there.
  web3formsKey: "26a9c872-cb03-40ed-9ce4-984a972b910b",

  // Firebase project that stores the registered-members counter
  // (Firestore document "stats/members" with a number field "count").
  // Copy apiKey and projectId from Firebase console > Project settings > Your apps.
  // Leave them empty to hide the counter.
  firebase: {
    apiKey: "AIzaSyDrIyYY2RAAu6p6UqQYvhtWhsy6mw-Vl_A",
    projectId: "dasman-48189",
  },
};
