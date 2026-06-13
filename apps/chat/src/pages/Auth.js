// src/pages/Auth.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, setupRecaptcha, sendOTP, verifyOTP } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';

const Auth = () => {
    const [step, setStep] = useState(1); // 1 = Phone Input, 2 = OTP Input
    const [phoneNumber, setPhoneNumber] = useState('');
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    // Check if user is already logged in
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                navigate('/'); // Send straight to chat if already logged in
            }
        });
        return () => unsubscribe();
    }, [navigate]);

    // Setup reCAPTCHA on load
    useEffect(() => {
        setupRecaptcha('recaptcha-container');
    }, []);

    const handleSendOTP = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // Ensure number has country code (Assuming India +91 as default for Aksh Studio, change if needed)
        const formattedNumber = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;

        const success = await sendOTP(formattedNumber);
        if (success) {
            setStep(2);
        } else {
            setError('Failed to send OTP. Ensure number is valid and try again.');
        }
        setLoading(false);
    };

    const handleVerifyOTP = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await verifyOTP(otp);
            // On success, Firebase Auth state changes, triggering the useEffect above to navigate to '/'
        } catch (err) {
            setError('Invalid OTP code. Please try again.');
            setLoading(false);
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <div style={styles.header}>
                    <span className="material-symbols-rounded" style={styles.icon}>chat</span>
                    <h1 style={styles.title}>Aksh Chat</h1>
                    <p style={styles.subtitle}>Enter your phone number to continue</p>
                </div>

                {error && <div style={styles.errorBanner}>{error}</div>}

                {step === 1 ? (
                    <form onSubmit={handleSendOTP} style={styles.form}>
                        <label style={styles.label}>Phone Number</label>
                        <input 
                            type="tel" 
                            placeholder="e.g. 9876543210" 
                            value={phoneNumber} 
                            onChange={(e) => setPhoneNumber(e.target.value)} 
                            style={styles.input}
                            required
                        />
                        <button type="submit" disabled={loading} style={styles.button}>
                            {loading ? "Sending..." : "Send Verification Code"}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleVerifyOTP} style={styles.form}>
                        <label style={styles.label}>6-Digit OTP</label>
                        <input 
                            type="text" 
                            placeholder="Enter code" 
                            value={otp} 
                            onChange={(e) => setOtp(e.target.value)} 
                            style={styles.input}
                            maxLength="6"
                            required
                        />
                        <button type="submit" disabled={loading} style={styles.button}>
                            {loading ? "Verifying..." : "Verify & Login"}
                        </button>
                        <button type="button" onClick={() => setStep(1)} style={styles.linkButton}>
                            Use a different number
                        </button>
                    </form>
                )}

                {/* Firebase requires this div for the invisible security captcha */}
                <div id="recaptcha-container"></div>
            </div>
        </div>
    );
};

// Inline premium styles for the Auth screen
const styles = {
    container: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--app-bg)',
        padding: '20px'
    },
    card: {
        backgroundColor: 'var(--card-bg)',
        padding: '40px',
        borderRadius: '24px',
        boxShadow: 'var(--shadow-lg)',
        width: '100%',
        maxWidth: '400px',
        border: '1px solid var(--border)'
    },
    header: {
        textAlign: 'center',
        marginBottom: '30px'
    },
    icon: {
        fontSize: '48px',
        color: 'var(--primary)',
        marginBottom: '10px'
    },
    title: {
        fontSize: '24px',
        fontWeight: '700',
        marginBottom: '5px',
        color: 'var(--text-main)'
    },
    subtitle: {
        fontSize: '14px',
        color: 'var(--text-muted)'
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: '15px'
    },
    label: {
        fontSize: '12px',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        color: 'var(--text-muted)'
    },
    input: {
        padding: '14px',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        fontSize: '16px',
        backgroundColor: 'var(--app-bg)',
        color: 'var(--text-main)',
        outline: 'none'
    },
    button: {
        backgroundColor: 'var(--primary)',
        color: 'white',
        border: 'none',
        padding: '15px',
        borderRadius: '12px',
        fontSize: '16px',
        fontWeight: '600',
        cursor: 'pointer',
        marginTop: '10px'
    },
    linkButton: {
        background: 'none',
        border: 'none',
        color: 'var(--primary)',
        fontWeight: '600',
        cursor: 'pointer',
        marginTop: '10px',
        fontSize: '14px'
    },
    errorBanner: {
        backgroundColor: '#fee2e2',
        color: '#dc2626',
        padding: '12px',
        borderRadius: '8px',
        fontSize: '13px',
        marginBottom: '20px',
        textAlign: 'center',
        fontWeight: '500'
    }
};

export default Auth;
