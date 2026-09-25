// Firebase compat SDK — loaded via plain <script> tags in index.html BEFORE this file:
//   firebase-app-compat.js, firebase-auth-compat.js, firebase-firestore-compat.js
// Uses the namespaced API: firebase.initializeApp / firebase.auth() / firebase.firestore()

// Firebase configuration — Stuvo production project
const firebaseConfig = {
    apiKey: "AIzaSyCvhZBrlpM1xYgTumGq7uesMTsvAhlRWK8",
    authDomain: "stuvo-2adff.firebaseapp.com",
    projectId: "stuvo-2adff",
    storageBucket: "stuvo-2adff.firebasestorage.app",
    messagingSenderId: "29760452841",
    appId: "1:29760452841:web:b5cc80456e749825001878"
};

let app, auth, db;
let GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut;
let doc, getDoc, setDoc, collection, collectionGroup, query, where, getDocs, updateDoc, addDoc, deleteDoc;
let serverTimestamp, arrayUnion, arrayRemove, orderBy, limit, Timestamp, onSnapshot;

try {
    app = firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();

    GoogleAuthProvider = firebase.auth.GoogleAuthProvider;
    signInWithPopup = (authInstance, provider) => authInstance.signInWithPopup(provider);
    onAuthStateChanged = (authInstance, callback) => authInstance.onAuthStateChanged(callback);
    signOut = (authInstance) => authInstance.signOut();

    doc = (dbInstance, ...segments) => dbInstance.doc(segments.join('/'));
    getDoc = (ref) => ref.get();
    setDoc = (ref, data, options) => ref.set(data, options);
    collection = (dbInstance, ...segments) => dbInstance.collection(segments.join('/'));
    collectionGroup = (dbInstance, name) => dbInstance.collectionGroup(name);
    query = (ref, ...constraints) => constraints.reduce((q, c) => c(q), ref);
    where = (fieldPath, op, value) => (q) => q.where(fieldPath, op, value);
    getDocs = (q) => q.get();
    updateDoc = (ref, data) => ref.update(data);
    addDoc = (colRef, data) => colRef.add(data);
    deleteDoc = (ref) => ref.delete();
    serverTimestamp = () => firebase.firestore.FieldValue.serverTimestamp();
    arrayUnion = (...values) => firebase.firestore.FieldValue.arrayUnion(...values);
    arrayRemove = (...values) => firebase.firestore.FieldValue.arrayRemove(...values);
    orderBy = (fieldPath, direction) => (q) => q.orderBy(fieldPath, direction);
    limit = (n) => (q) => q.limit(n);
    Timestamp = firebase.firestore.Timestamp;
    onSnapshot = (ref, callback) => ref.onSnapshot(callback);
} catch (e) {
    console.warn("Firebase config is mock/invalid. App will not function correctly without real config.");
}
