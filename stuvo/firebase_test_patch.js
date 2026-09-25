// Add to firebase.js - test auth mode
// This creates a mock user for testing Study Hub without real Firebase auth
window.__testAuthUid = null;
window.__testAuthUser = null;

// Override signInWithPopup to use mock auth
const _origSignInWithPopup = signInWithPopup;
signInWithPopup = async function(provider) {
  if (window.__forceMockAuth) {
    const uid = 'testuser_student_001';
    const user = { uid, email: 'teststudent@example.com', displayName: 'Test Student', role: 'student' };
    window.__testAuthUid = uid;
    window.__testAuthUser = user;
    return { user };
  }
  return _origSignInWithPopup(provider);
};
