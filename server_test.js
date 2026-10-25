const http = require('http');
const fs = require('fs');
const path = require('path');

// Simple test endpoint that creates a user in Firestore
const TEST_UID = 'testuser_student_001';

// Create user document via Firebase REST API
const firebaseConfig = {
  apiKey: "AIzaSyCvhZBrlpM1xYgTumGq7uesMTsvAhlRWK8",
  authDomain: "stuvo-2adff.firebaseapp.com",
  projectId: "stuvo-2adff",
};

async function createTestUser() {
  // Create user in Firestore using REST API
  const userDoc = {
    grade: '10',
    stream: 'Science',
    classIds: ['class1'],
    role: 'student',
    displayName: 'Test Student',
    email: 'teststudent@example.com',
    languagePreference: 'en',
    createdAt: { __firestore__: { serverTimestamps: [null] } }
  };
  
  // Create streak document
  const streakDoc = {
    count: 5,
    updatedAt: { __firestore__: { serverTimestamps: [null] } }
  };
  
  console.log('Test user would be created with UID:', TEST_UID);
  console.log('User doc:', JSON.stringify(userDoc));
  console.log('Streak doc:', JSON.stringify(streakDoc));
}

createTestUser();
