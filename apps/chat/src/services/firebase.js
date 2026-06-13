// src/services/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your exact Aksh Studio Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAmxOwGXgffYiEP0O4o_cWvP0lg2SbJfhw",
    authDomain: "aksh-studio.firebaseapp.com",
    projectId: "aksh-studio"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Helper function to setup invisible reCAPTCHA (Required by Firebase to prevent spam)
export const setupRecaptcha = (containerId) => {
    if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
            'size': 'invisible',
            'callback': (response) => {
                // reCAPTCHA solved
            }
        });
    }
};

export const sendOTP = async (phoneNumber) => {
    const appVerifier = window.recaptchaVerifier;
    try {
        const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
        window.confirmationResult = confirmationResult;
        return true;
    } catch (error) {
        console.error("SMS not sent", error);
        return false;
    }
};

export const verifyOTP = async (otp) => {
    try {
        const result = await window.confirmationResult.confirm(otp);
        return result.user;
    } catch (error) {
        console.error("Bad verification code", error);
        throw error;
    }
};
